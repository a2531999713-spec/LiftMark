import type { HistoryRepository, ListHistoryItemsInput } from '@/data/repositories/historyRepository';
import type { HistoryCycleOption, HistoryListItem } from '@/domain/history/history.types';
import type { TrainingReportSessionType } from '@/domain/report/trainingReport.types';
import { FREE_TRAINING_PLAN_ID } from '@/domain/workout/workout.types';

import { getGroupAccountScope, getRequiredCurrentUserId } from '../accountScope';
import type { DatabaseProvider } from './base';

type HistoryRow = {
  completed_sets: number;
  cycle_name: string | null;
  cycle_status: HistoryListItem['cycleStatus'] | null;
  date: string;
  duration_seconds: number;
  exercise_count: number;
  has_manual_marker: number;
  has_report: number;
  id: string;
  main_exercise_names: string | null;
  owner_user_id: string;
  participant_names: string | null;
  plan_cycle_id: string | null;
  plan_id: string;
  plan_name: string | null;
  title: string;
  total_reps: number;
  total_volume: number;
  week: number;
  weekday: number;
};

function getSessionType(row: HistoryRow): TrainingReportSessionType {
  if (row.has_manual_marker === 1) return 'manual';
  if (row.plan_id === FREE_TRAINING_PLAN_ID) return 'free';
  return 'planned';
}

function splitAggregate(value: string | null): string[] {
  return value ? value.split(',').map((item) => item.trim()).filter(Boolean).slice(0, 3) : [];
}

export class SQLiteHistoryRepository implements HistoryRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async listHistoryItems(input: ListHistoryItemsInput) {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const scope = getGroupAccountScope(ownerUserId, 'groups');
    const clauses = [
      'ws.owner_user_id = ?',
      'ws.group_id = ?',
      "ws.status = 'completed'",
      'ws.date BETWEEN ? AND ?',
      'ws.deleted_at IS NULL',
      'groups.deleted_at IS NULL',
      scope.where,
    ];
    const params: (number | string)[] = [
      ownerUserId,
      input.groupId,
      input.fromDate,
      input.toDate,
      ...scope.params,
    ];
    if (input.memberId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM workout_sets member_filter
        WHERE member_filter.session_id = ws.id AND member_filter.owner_user_id = ?
          AND member_filter.member_id = ? AND member_filter.deleted_at IS NULL
      )`);
      params.push(ownerUserId, input.memberId);
    }
    if (input.filter.kind === 'current_cycle') {
      if (!input.currentPlanCycleId) return { filter: input.filter, items: [] };
      clauses.push('ws.plan_cycle_id = ?');
      params.push(input.currentPlanCycleId);
    } else if (input.filter.kind === 'cycle') {
      if (!input.filter.planCycleId) return { filter: input.filter, items: [] };
      clauses.push('ws.plan_cycle_id = ?');
      params.push(input.filter.planCycleId);
    } else if (input.filter.kind === 'free') {
      clauses.push('ws.plan_id = ?');
      params.push(FREE_TRAINING_PLAN_ID);
      clauses.push(`NOT EXISTS (
        SELECT 1 FROM workout_exercise_records manual_record
        WHERE manual_record.session_id = ws.id AND manual_record.owner_user_id = ws.owner_user_id
          AND manual_record.deleted_at IS NULL
          AND manual_record.notes LIKE '%历史补录%'
      )`);
    } else if (input.filter.kind === 'manual') {
      clauses.push(`EXISTS (
        SELECT 1 FROM workout_exercise_records manual_record
        WHERE manual_record.session_id = ws.id AND manual_record.owner_user_id = ws.owner_user_id
          AND manual_record.deleted_at IS NULL
          AND manual_record.notes LIKE '%历史补录%'
      )`);
    }

    const rows = await db.getAllAsync<HistoryRow>(
      `SELECT
         ws.id, ws.owner_user_id, ws.plan_id, ws.plan_cycle_id, ws.date, ws.week, ws.weekday, ws.title,
         pt.name AS plan_name, pc.name AS cycle_name, pc.status AS cycle_status,
         COALESCE((SELECT COUNT(*) FROM workout_sets completed
           WHERE completed.session_id = ws.id AND completed.owner_user_id = ws.owner_user_id
             AND completed.completed = 1 AND completed.skipped = 0 AND completed.deleted_at IS NULL), 0) AS completed_sets,
         COALESCE((SELECT SUM(COALESCE(reps.actual_reps, reps.planned_reps, 0)) FROM workout_sets reps
           WHERE reps.session_id = ws.id AND reps.owner_user_id = ws.owner_user_id
             AND reps.completed = 1 AND reps.skipped = 0 AND reps.deleted_at IS NULL), 0) AS total_reps,
         COALESCE((SELECT SUM(COALESCE(volume.actual_weight, volume.planned_weight, 0)
             * COALESCE(volume.actual_reps, volume.planned_reps, 0)) FROM workout_sets volume
           WHERE volume.session_id = ws.id AND volume.owner_user_id = ws.owner_user_id
             AND volume.completed = 1 AND volume.skipped = 0 AND volume.deleted_at IS NULL), 0) AS total_volume,
         COALESCE((SELECT COUNT(DISTINCT exercise_record.exercise_id)
           FROM workout_exercise_records exercise_record
           WHERE exercise_record.session_id = ws.id AND exercise_record.owner_user_id = ws.owner_user_id
             AND exercise_record.deleted_at IS NULL), 0) AS exercise_count,
         (SELECT GROUP_CONCAT(DISTINCT ex.name)
           FROM workout_exercise_records names_record
           INNER JOIN exercises ex ON ex.id = names_record.exercise_id
           WHERE names_record.session_id = ws.id AND names_record.owner_user_id = ws.owner_user_id
             AND names_record.deleted_at IS NULL) AS main_exercise_names,
         (SELECT GROUP_CONCAT(DISTINCT gm.display_name)
           FROM workout_sets participant_set
           INNER JOIN group_members gm ON gm.id = participant_set.member_id
             AND gm.group_id = ws.group_id AND gm.deleted_at IS NULL
           WHERE participant_set.session_id = ws.id AND participant_set.owner_user_id = ws.owner_user_id
             AND participant_set.deleted_at IS NULL) AS participant_names,
         COALESCE((SELECT report.duration_seconds FROM training_reports report
           WHERE report.workout_session_id = ws.id AND report.owner_user_id = ws.owner_user_id
             AND report.deleted_at IS NULL ORDER BY report.updated_at DESC LIMIT 1),
           CASE WHEN ws.started_at IS NOT NULL AND ws.finished_at IS NOT NULL
             THEN MAX(0, CAST((julianday(ws.finished_at) - julianday(ws.started_at)) * 86400 AS INTEGER)) ELSE 0 END
         ) AS duration_seconds,
         CASE WHEN EXISTS (SELECT 1 FROM training_reports report
           WHERE report.workout_session_id = ws.id AND report.owner_user_id = ws.owner_user_id
             AND report.deleted_at IS NULL) THEN 1 ELSE 0 END AS has_report,
         CASE WHEN EXISTS (SELECT 1 FROM workout_exercise_records marker
           WHERE marker.session_id = ws.id AND marker.owner_user_id = ws.owner_user_id
             AND marker.deleted_at IS NULL AND marker.notes LIKE '%历史补录%') THEN 1 ELSE 0 END AS has_manual_marker
       FROM workout_sessions ws
       INNER JOIN groups ON groups.id = ws.group_id
       LEFT JOIN plan_templates pt ON pt.id = ws.plan_id
         AND pt.owner_user_id = ws.owner_user_id AND pt.deleted_at IS NULL
       LEFT JOIN plan_cycles pc ON pc.id = ws.plan_cycle_id
         AND pc.owner_user_id = ws.owner_user_id AND pc.deleted_at IS NULL
       WHERE ${clauses.join(' AND ')}
       ORDER BY ws.date DESC, ws.updated_at DESC
       LIMIT ?`,
      ...params,
      input.limit ?? 100,
    );
    return {
      filter: input.filter,
      items: rows.map((row): HistoryListItem => ({
        completedSets: row.completed_sets,
        cycleName: row.cycle_name ?? undefined,
        cycleStatus: row.cycle_status ?? undefined,
        date: row.date,
        durationSeconds: row.duration_seconds,
        exerciseCount: row.exercise_count,
        hasCompleteReport: row.has_report === 1,
        id: row.id,
        mainExerciseNames: splitAggregate(row.main_exercise_names),
        ownerUserId: row.owner_user_id,
        participantNames: splitAggregate(row.participant_names),
        planCycleId: row.plan_cycle_id ?? undefined,
        planName: row.plan_name ?? undefined,
        sessionType: getSessionType(row),
        title: row.title,
        totalReps: row.total_reps,
        totalVolume: row.total_volume,
        week: row.week,
        weekday: row.weekday,
      })),
    };
  }

  async listHistoryCycleOptions(groupId: string): Promise<HistoryCycleOption[]> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const scope = getGroupAccountScope(ownerUserId, 'groups');
    const rows = await db.getAllAsync<{
      cycle_id: string;
      cycle_name: string;
      end_date: string | null;
      plan_name: string;
      session_count: number;
      start_date: string;
      status: HistoryCycleOption['status'];
    }>(
      `SELECT pc.id AS cycle_id, pc.name AS cycle_name, pc.start_date, pc.end_date, pc.status,
         COALESCE(pt.name, '训练计划') AS plan_name,
         COUNT(DISTINCT CASE WHEN ws.status = 'completed' AND ws.deleted_at IS NULL THEN ws.id END) AS session_count
       FROM plan_cycles pc
       INNER JOIN groups ON groups.id = pc.group_id
       LEFT JOIN plan_templates pt ON pt.id = pc.plan_id
         AND pt.owner_user_id = pc.owner_user_id AND pt.deleted_at IS NULL
       LEFT JOIN workout_sessions ws ON ws.plan_cycle_id = pc.id AND ws.owner_user_id = ?
       WHERE pc.owner_user_id = ? AND pc.group_id = ? AND pc.deleted_at IS NULL
         AND groups.deleted_at IS NULL AND ${scope.where}
       GROUP BY pc.id, pc.name, pc.start_date, pc.end_date, pc.status, pt.name
       ORDER BY CASE pc.status WHEN 'active' THEN 0 WHEN 'completed' THEN 1 WHEN 'archived' THEN 2 ELSE 3 END,
         pc.start_date DESC`,
      ownerUserId,
      ownerUserId,
      groupId,
      ...scope.params,
    );
    return rows.map((row) => ({
      cycleId: row.cycle_id,
      cycleName: row.cycle_name,
      endDate: row.end_date ?? undefined,
      planName: row.plan_name,
      sessionCount: row.session_count,
      startDate: row.start_date,
      status: row.status,
    }));
  }
}
