import { initializeLocalDatabase } from '@/data/local';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';

import type { HomeDashboardSnapshot } from '../model/home.types';

type SummaryRow = {
  completed_sets: number | null;
  duration_seconds: number | null;
  session_count: number | null;
  volume: number | null;
};

type PerformanceRow = {
  actual_reps: number | null;
  actual_weight: number | null;
  exercise_id: string;
  planned_reps: number | null;
  planned_weight: number | null;
};

export async function loadHomeDashboardSnapshot(input: {
  fromDate: string;
  groupId: string;
  memberId: string | null;
  recentLimit?: number;
  toDate: string;
}): Promise<HomeDashboardSnapshot> {
  const empty: HomeDashboardSnapshot = {
    completedPlanDayKeys: [],
    lastPerformanceByExerciseId: {},
    recentVisibleSessionCount: 0,
    weeklyOverview: { completedSets: 0, durationSeconds: 0, sessionCount: 0, volume: 0 },
  };
  if (!input.memberId) return empty;

  const ownerUserId = await getRequiredCurrentUserId();
  const db = await initializeLocalDatabase();
  const ownerParams = [ownerUserId, input.groupId, input.memberId];
  const [summary, performanceRows, completedRows, recentCount] = await Promise.all([
    db.getFirstAsync<SummaryRow>(
      `SELECT
         COUNT(DISTINCT CASE WHEN sets.completed = 1 THEN sessions.id END) AS session_count,
         SUM(CASE WHEN sets.completed = 1 THEN 1 ELSE 0 END) AS completed_sets,
         COALESCE(SUM(CASE WHEN sets.completed = 1
           THEN COALESCE(sets.actual_weight, sets.planned_weight, 0) * COALESCE(sets.actual_reps, sets.planned_reps, 0)
           ELSE 0 END), 0) AS volume,
         COALESCE((SELECT SUM(MAX(0, CAST((julianday(scoped_sessions.finished_at) - julianday(scoped_sessions.started_at)) * 86400 AS INTEGER)))
           FROM workout_sessions scoped_sessions
           WHERE scoped_sessions.owner_user_id = ? AND scoped_sessions.group_id = ?
             AND scoped_sessions.date BETWEEN ? AND ?
             AND scoped_sessions.deleted_at IS NULL
             AND scoped_sessions.started_at IS NOT NULL AND scoped_sessions.finished_at IS NOT NULL
             AND EXISTS (SELECT 1 FROM workout_sets scoped_sets
               WHERE scoped_sets.session_id = scoped_sessions.id AND scoped_sets.member_id = ?
                 AND scoped_sets.completed = 1 AND scoped_sets.deleted_at IS NULL)
         ), 0) AS duration_seconds
       FROM workout_sessions sessions
       LEFT JOIN workout_sets sets ON sets.session_id = sessions.id AND sets.member_id = ? AND sets.deleted_at IS NULL
       WHERE sessions.owner_user_id = ? AND sessions.group_id = ?
         AND sessions.date BETWEEN ? AND ?
         AND sessions.deleted_at IS NULL`,
      ownerUserId,
      input.groupId,
      input.fromDate,
      input.toDate,
      input.memberId,
      input.memberId,
      ownerUserId,
      input.groupId,
      input.fromDate,
      input.toDate,
    ),
    db.getAllAsync<PerformanceRow>(
      `SELECT records.exercise_id, sets.actual_weight, sets.planned_weight, sets.actual_reps, sets.planned_reps
       FROM workout_sets sets
       JOIN workout_sessions sessions ON sessions.id = sets.session_id
       JOIN workout_exercise_records records ON records.id = sets.exercise_record_id
       WHERE sessions.owner_user_id = ? AND sessions.group_id = ? AND sets.member_id = ?
         AND sets.completed = 1 AND sets.skipped = 0
         AND sessions.deleted_at IS NULL AND sets.deleted_at IS NULL AND records.deleted_at IS NULL
       ORDER BY sessions.date DESC, sets.updated_at DESC
       LIMIT ?`,
      ...ownerParams,
      input.recentLimit ?? 200,
    ),
    db.getAllAsync<{ plan_id: string; week: number; weekday: number }>(
      `SELECT DISTINCT plan_id, week, weekday
       FROM workout_sessions
       WHERE owner_user_id = ? AND group_id = ? AND status = 'completed' AND deleted_at IS NULL`,
      ownerUserId,
      input.groupId,
    ),
    db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count FROM workout_sessions
       WHERE owner_user_id = ? AND group_id = ? AND deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM workout_sets sets
           WHERE sets.session_id = workout_sessions.id AND sets.member_id = ? AND sets.deleted_at IS NULL)`,
      ...ownerParams,
    ),
  ]);

  const lastPerformanceByExerciseId: Record<string, string> = {};
  for (const row of performanceRows) {
    if (lastPerformanceByExerciseId[row.exercise_id]) continue;
    const weight = row.actual_weight ?? row.planned_weight;
    const reps = row.actual_reps ?? row.planned_reps;
    if (weight !== null && reps !== null) {
      lastPerformanceByExerciseId[row.exercise_id] = `上次 ${weight}kg × ${reps}次`;
    }
  }

  return {
    completedPlanDayKeys: completedRows.map((row) => `${row.plan_id}:${row.week}:${row.weekday}`),
    lastPerformanceByExerciseId,
    recentVisibleSessionCount: recentCount?.count ?? 0,
    weeklyOverview: {
      completedSets: summary?.completed_sets ?? 0,
      durationSeconds: summary?.duration_seconds ?? 0,
      sessionCount: summary?.session_count ?? 0,
      volume: summary?.volume ?? 0,
    },
  };
}
