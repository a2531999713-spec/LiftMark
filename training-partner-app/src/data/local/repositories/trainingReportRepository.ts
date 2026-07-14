import type { TrainingReportRepository } from '@/data/repositories/trainingReportRepository';
import { FREE_TRAINING_PLAN_ID } from '@/domain/workout/workout.types';
import type {
  TrainingIntensityLevel,
  TrainingReport,
  TrainingReportExerciseSource,
  TrainingReportSessionType,
  TrainingReportSource,
} from '@/domain/report/trainingReport.types';

import { getGroupAccountScope, getRequiredCurrentUserId } from '../accountScope';
import type { DatabaseProvider } from './base';

type ReportSessionRow = {
  cycle_name: string | null;
  finished_at: string | null;
  group_id: string;
  has_manual_marker: number;
  plan_cycle_id: string | null;
  plan_day_id: string | null;
  plan_id: string;
  plan_name: string | null;
  report_created_at: string | null;
  report_date: string | null;
  report_duration_seconds: number | null;
  report_estimated_calories: number | null;
  report_estimated_calories_max: number | null;
  report_estimated_calories_min: number | null;
  report_exercise_count: number | null;
  report_id: string | null;
  report_intensity_level: TrainingIntensityLevel | null;
  report_notes: string | null;
  report_total_reps: number | null;
  report_total_sets: number | null;
  report_total_volume: number | null;
  report_updated_at: string | null;
  session_date: string;
  session_id: string;
  session_title: string;
  started_at: string | null;
  week: number;
  weekday: number;
};

type ReportSetRow = {
  actual_reps: number | null;
  actual_weight: number | null;
  completed: number | null;
  exercise_id: string;
  exercise_name: string | null;
  member_id: string | null;
  member_name: string | null;
  notes: string | null;
  planned_reps: number | null;
  planned_weight: number | null;
  record_id: string;
  replaced_from_exercise_name: string | null;
  set_number: number | null;
  skipped: number | null;
};

function getSessionType(row: ReportSessionRow): TrainingReportSessionType {
  if (row.has_manual_marker === 1) return 'manual';
  if (row.plan_id === FREE_TRAINING_PLAN_ID) return 'free';
  return 'planned';
}

function mapReport(row: ReportSessionRow, ownerUserId: string): TrainingReport | undefined {
  if (!row.report_id) return undefined;
  return {
    createdAt: row.report_created_at ?? row.report_updated_at ?? new Date(0).toISOString(),
    durationSeconds: row.report_duration_seconds ?? 0,
    estimatedCalories: row.report_estimated_calories ?? 0,
    estimatedCaloriesMax: row.report_estimated_calories_max ?? 0,
    estimatedCaloriesMin: row.report_estimated_calories_min ?? 0,
    exerciseCount: row.report_exercise_count ?? 0,
    groupId: row.group_id,
    id: row.report_id,
    intensityLevel: row.report_intensity_level ?? 'medium',
    notes: row.report_notes ?? undefined,
    ownerUserId,
    planCycleId: row.plan_cycle_id ?? undefined,
    planId: row.plan_id,
    reportDate: row.report_date ?? row.session_date,
    totalReps: row.report_total_reps ?? 0,
    totalSets: row.report_total_sets ?? 0,
    totalVolume: row.report_total_volume ?? 0,
    updatedAt: row.report_updated_at ?? row.report_created_at ?? new Date(0).toISOString(),
    workoutSessionId: row.session_id,
  };
}

export class SQLiteTrainingReportRepository implements TrainingReportRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getTrainingReportSource(sessionId: string): Promise<TrainingReportSource | null> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const scope = getGroupAccountScope(ownerUserId, 'groups');
    const session = await db.getFirstAsync<ReportSessionRow>(
      `SELECT
         ws.id AS session_id, ws.group_id, ws.plan_id, ws.plan_cycle_id, ws.plan_day_id,
         ws.date AS session_date, ws.week, ws.weekday, ws.title AS session_title,
         ws.started_at, ws.finished_at, pt.name AS plan_name, pc.name AS cycle_name,
         CASE WHEN EXISTS (
           SELECT 1 FROM workout_exercise_records marker
           WHERE marker.session_id = ws.id AND marker.owner_user_id = ws.owner_user_id
             AND marker.deleted_at IS NULL AND marker.notes LIKE '%历史补录%'
         ) THEN 1 ELSE 0 END AS has_manual_marker,
         tr.id AS report_id, tr.report_date, tr.duration_seconds AS report_duration_seconds,
         tr.total_volume AS report_total_volume, tr.total_sets AS report_total_sets,
         tr.total_reps AS report_total_reps, tr.exercise_count AS report_exercise_count,
         tr.estimated_calories AS report_estimated_calories,
         tr.estimated_calories_min AS report_estimated_calories_min,
         tr.estimated_calories_max AS report_estimated_calories_max,
         tr.intensity_level AS report_intensity_level, tr.notes AS report_notes,
         tr.created_at AS report_created_at, tr.updated_at AS report_updated_at
       FROM workout_sessions ws
       INNER JOIN groups ON groups.id = ws.group_id
       LEFT JOIN plan_templates pt ON pt.id = ws.plan_id
         AND pt.owner_user_id = ws.owner_user_id AND pt.deleted_at IS NULL
       LEFT JOIN plan_cycles pc ON pc.id = ws.plan_cycle_id
         AND pc.owner_user_id = ws.owner_user_id AND pc.deleted_at IS NULL
       LEFT JOIN training_reports tr ON tr.workout_session_id = ws.id
         AND tr.owner_user_id = ? AND tr.deleted_at IS NULL
       WHERE ws.id = ? AND ws.owner_user_id = ? AND ws.deleted_at IS NULL
         AND groups.deleted_at IS NULL AND ${scope.where}
       ORDER BY tr.updated_at DESC
       LIMIT 1`,
      ownerUserId,
      sessionId,
      ownerUserId,
      ...scope.params,
    );
    if (!session) return null;

    const [setRows, participantRows] = await Promise.all([
      db.getAllAsync<ReportSetRow>(
        `SELECT
           wer.id AS record_id, wer.exercise_id, ex.name AS exercise_name,
           replaced.name AS replaced_from_exercise_name, wer.notes,
           ws.member_id, gm.display_name AS member_name, ws.set_number,
           ws.actual_weight, ws.planned_weight, ws.actual_reps, ws.planned_reps,
           ws.completed, ws.skipped
         FROM workout_exercise_records wer
         INNER JOIN workout_sessions session_scope ON session_scope.id = wer.session_id
         LEFT JOIN exercises ex ON ex.id = wer.exercise_id
         LEFT JOIN exercises replaced ON replaced.id = wer.replaced_from_exercise_id
         LEFT JOIN workout_sets ws ON ws.exercise_record_id = wer.id
           AND ws.owner_user_id = ? AND ws.deleted_at IS NULL
         LEFT JOIN group_members gm ON gm.id = ws.member_id
           AND gm.group_id = session_scope.group_id AND gm.deleted_at IS NULL
         WHERE wer.session_id = ? AND wer.owner_user_id = ? AND wer.deleted_at IS NULL
           AND session_scope.owner_user_id = ? AND session_scope.group_id = ?
         ORDER BY wer.order_index ASC, ws.set_number ASC, gm.created_at ASC`,
        ownerUserId,
        sessionId,
        ownerUserId,
        ownerUserId,
        session.group_id,
      ),
      db.getAllAsync<{ bodyweight: number | null; member_id: string; member_name: string }>(
        `SELECT DISTINCT participant.member_id, gm.display_name AS member_name, mp.bodyweight
         FROM (
           SELECT member_id FROM workout_sets
           WHERE session_id = ? AND owner_user_id = ? AND deleted_at IS NULL
         ) participant
         INNER JOIN group_members gm ON gm.id = participant.member_id
           AND gm.group_id = ? AND gm.deleted_at IS NULL
         LEFT JOIN member_profiles mp ON mp.member_id = participant.member_id AND mp.deleted_at IS NULL
         ORDER BY gm.created_at ASC`,
        sessionId,
        ownerUserId,
        session.group_id,
      ),
    ]);

    const exerciseMap = new Map<string, TrainingReportExerciseSource>();
    for (const row of setRows) {
      const exercise = exerciseMap.get(row.record_id) ?? {
        exerciseId: row.exercise_id,
        exerciseName: row.exercise_name ?? '训练动作',
        isTemporary: row.notes?.includes('临时添加动作') ?? false,
        recordId: row.record_id,
        replacedFromExerciseName: row.replaced_from_exercise_name ?? undefined,
        sets: [],
      };
      if (row.member_id && row.set_number !== null) {
        exercise.sets.push({
          completed: row.completed === 1,
          memberId: row.member_id,
          memberName: row.member_name ?? '训练成员',
          reps: row.actual_reps ?? row.planned_reps ?? 0,
          setNumber: row.set_number,
          skipped: row.skipped === 1,
          weight: row.actual_weight ?? row.planned_weight ?? 0,
        });
      }
      exerciseMap.set(row.record_id, exercise);
    }
    const report = mapReport(session, ownerUserId);
    return {
      cycleName: session.cycle_name ?? undefined,
      exercises: [...exerciseMap.values()],
      finishedAt: session.finished_at ?? undefined,
      groupId: session.group_id,
      hasReport: Boolean(report),
      ownerUserId,
      participantBodyweights: participantRows.map((participant) => ({
        memberId: participant.member_id,
        memberName: participant.member_name,
        weightKg: participant.bodyweight ?? undefined,
      })),
      planCycleId: session.plan_cycle_id ?? undefined,
      planDayId: session.plan_day_id ?? undefined,
      planId: session.plan_id,
      planName: session.plan_name ?? undefined,
      report,
      sessionDate: session.session_date,
      sessionId: session.session_id,
      sessionTitle: session.session_title,
      sessionType: getSessionType(session),
      startedAt: session.started_at ?? undefined,
      week: session.week,
      weekday: session.weekday,
    };
  }
}
