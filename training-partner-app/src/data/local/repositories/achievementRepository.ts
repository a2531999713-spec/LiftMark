import { getRequiredCurrentUserId } from '@/data/local/accountScope';
import type { AchievementRepository, AchievementSnapshotInput } from '@/data/repositories/achievementRepository';
import {
  buildActivityWeeks,
  calculateCurrentWeekStreak,
  calculateLongestWeekStreak,
  evaluateAchievements,
  getMondayWeekKey,
} from '@/domain/achievement/achievement-engine';

import type { DatabaseProvider } from './base';

type ValidSessionRow = { date: string; training_mode: string; total_volume: number | string | null };
type CountRow = { count: number | string | null };

function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function safeNumber(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

export class SQLiteAchievementRepository implements AchievementRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getAchievementSnapshot(input: AchievementSnapshotInput) {
    const currentUserId = await getRequiredCurrentUserId();
    if (currentUserId !== input.ownerUserId) {
      throw new Error('Achievement scope does not match the current account.');
    }
    const db = await this.getDb();
    const [sessions, cycleRow, recoveryRow] = await Promise.all([
      db.getAllAsync<ValidSessionRow>(
        `SELECT sessions.date, sessions.training_mode,
          SUM(MAX(COALESCE(sets.actual_weight, sets.planned_weight, 0), 0) *
              MAX(COALESCE(sets.actual_reps, sets.planned_reps, 0), 0)) AS total_volume
         FROM workout_sessions sessions
         INNER JOIN workout_sets sets
           ON sets.session_id = sessions.id
          AND sets.owner_user_id = ?
          AND sets.completed = 1
          AND sets.skipped = 0
          AND sets.deleted_at IS NULL
         WHERE sessions.owner_user_id = ?
           AND sessions.status = 'completed'
           AND sessions.deleted_at IS NULL
           AND (? IS NULL OR sessions.id <> ?)
         GROUP BY sessions.id, sessions.date, sessions.training_mode
         ORDER BY sessions.date ASC`,
        currentUserId,
        currentUserId,
        input.excludeSessionId ?? null,
        input.excludeSessionId ?? null,
      ),
      db.getFirstAsync<CountRow>(
        `SELECT COUNT(DISTINCT id) AS count FROM plan_cycles
         WHERE owner_user_id = ? AND status IN ('completed', 'archived') AND deleted_at IS NULL`,
        currentUserId,
      ),
      db.getFirstAsync<CountRow>(
        `SELECT COUNT(*) AS count FROM (
           SELECT member_id, date FROM recovery_logs
           WHERE owner_user_id = ? AND deleted_at IS NULL
           GROUP BY member_id, date
         )`,
        currentUserId,
      ),
    ]);

    const todayKey = input.todayKey ?? localDateKey();
    const workoutDates = sessions.map((session) => session.date);
    const weekKeys = workoutDates.map(getMondayWeekKey);
    const currentWeekKey = getMondayWeekKey(todayKey);
    const metrics = {
      completedWorkouts: sessions.length,
      totalVolume: sessions.reduce((sum, session) => sum + safeNumber(session.total_volume), 0),
      groupWorkouts: sessions.filter((session) => session.training_mode === 'group_local').length,
      completedCycles: safeNumber(cycleRow?.count),
      recoveryCheckins: safeNumber(recoveryRow?.count),
      currentActiveWeekStreak: calculateCurrentWeekStreak(weekKeys, todayKey),
      longestActiveWeekStreak: calculateLongestWeekStreak(weekKeys),
      thisWeekWorkoutCount: workoutDates.filter((dateKey) => getMondayWeekKey(dateKey) === currentWeekKey).length,
      lastWorkoutDate: workoutDates.at(-1) ?? null,
    };
    return {
      metrics,
      achievements: evaluateAchievements(metrics),
      activityWeeks: buildActivityWeeks(workoutDates, todayKey),
      generatedAt: new Date().toISOString(),
    };
  }
}
