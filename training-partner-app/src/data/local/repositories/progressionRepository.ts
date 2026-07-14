import type { ProgressionRepository } from '@/data/repositories/progressionRepository';
import {
  getProgressionDecision,
  summarizeExercisePerformance,
} from '@/domain/progression/progression-engine';
import type {
  ExercisePerformanceSnapshot,
  HistoricalExercisePerformance,
  ProgressionSuggestion,
} from '@/domain/progression/progression.types';
import { parseIncrementKg } from '@/domain/preferences/user-preferences.types';
import { enqueueSyncCandidate } from '@/sync/syncQueue';

import type { DatabaseProvider } from './base';
import { getCurrentAccountUserId, getGroupAccountScope, getRequiredCurrentUserId } from '../accountScope';

type ProgressionSuggestionRow = {
  created_at: string;
  exercise_id: string;
  id: string;
  member_id: string;
  reason: string;
  session_id: string;
  suggested_weight: number | null;
  suggestion: ProgressionSuggestion['suggestion'];
};

type SessionRow = {
  date: string;
  finished_at: string | null;
  group_id: string;
  id: string;
  status: string;
  updated_at: string;
};

type PerformanceRow = {
  actual_reps: number | null;
  actual_weight: number | null;
  completed: number;
  equipment: ExercisePerformanceSnapshot['equipment'] | null;
  exercise_id: string;
  intensity_type: ExercisePerformanceSnapshot['intensityType'] | null;
  member_id: string;
  plan_goal: ExercisePerformanceSnapshot['planGoal'] | null;
  planned_rep_max: number | null;
  planned_rep_min: number | null;
  planned_reps: number | null;
  planned_sets: number | null;
  planned_weight: number | null;
  progression_rule_id: string | null;
  record_id: string;
  session_id: string;
  skipped: number;
  barbell_increment: number | null;
  dumbbell_increment: number | null;
};

type HistoricalPerformanceRow = PerformanceRow & {
  session_date: string;
  session_finished_at: string | null;
  session_updated_at: string;
};

function mapProgressionSuggestion(row: ProgressionSuggestionRow): ProgressionSuggestion {
  return {
    id: row.id,
    memberId: row.member_id,
    exerciseId: row.exercise_id,
    sessionId: row.session_id,
    suggestion: row.suggestion,
    suggestedWeight: row.suggested_weight ?? undefined,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

function pairKey(memberId: string, exerciseId: string): string {
  return `${memberId}:${exerciseId}`;
}

function recordMemberKey(recordId: string, memberId: string): string {
  return `${recordId}:${memberId}`;
}

function getWeightIncrement(row: PerformanceRow, fallbackIncrement: number): number {
  const increment = row.equipment === 'dumbbell' ? row.dumbbell_increment : row.barbell_increment;
  return increment && increment > 0 ? increment : fallbackIncrement;
}

function buildSnapshots(rows: PerformanceRow[], fallbackIncrement: number): ExercisePerformanceSnapshot[] {
  const grouped = new Map<string, PerformanceRow[]>();
  for (const row of rows) {
    const key = recordMemberKey(row.record_id, row.member_id);
    grouped.set(key, [...(grouped.get(key) ?? []), row]);
  }

  return [...grouped.values()].map((recordRows) => {
    const source = recordRows[0]!;
    const validRows = recordRows.filter((row) => row.completed === 1 && row.skipped === 0);
    const completedWeights = validRows
      .map((row) => row.actual_weight ?? row.planned_weight ?? 0)
      .filter((weight) => Number.isFinite(weight));
    const positiveWeights = completedWeights.filter((weight) => weight > 0);
    return {
      completedReps: validRows
        .map((row) => row.actual_reps ?? row.planned_reps ?? 0)
        .filter((reps) => Number.isFinite(reps)),
      completedSets: validRows.length,
      completedWeights,
      equipment: source.equipment ?? undefined,
      exerciseId: source.exercise_id,
      failedSetCount: recordRows.filter((row) => row.completed !== 1 || row.skipped === 1).length,
      intensityType: source.intensity_type ?? undefined,
      latestWorkingWeight: positiveWeights.length > 0 ? positiveWeights[positiveWeights.length - 1] : undefined,
      memberId: source.member_id,
      planGoal: source.plan_goal ?? undefined,
      plannedRepMax: source.planned_rep_max ?? undefined,
      plannedRepMin: source.planned_rep_min ?? undefined,
      plannedReps: source.planned_reps ?? undefined,
      plannedSets: source.planned_sets ?? recordRows.length,
      progressionRuleId: source.progression_rule_id ?? undefined,
      sessionId: source.session_id,
      skippedSets: recordRows.filter((row) => row.skipped === 1).length,
      weightIncrement: getWeightIncrement(source, fallbackIncrement),
    };
  });
}

export class SQLiteProgressionRepository implements ProgressionRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async createSuggestionsForSession(sessionId: string): Promise<ProgressionSuggestion[]> {
    const db = await this.getDb();
    const userId = await getRequiredCurrentUserId();
    const session = await db.getFirstAsync<SessionRow>(
      `SELECT ws.id, ws.group_id, ws.status, ws.date, ws.finished_at, ws.updated_at
       FROM workout_sessions ws
       INNER JOIN groups g ON g.id = ws.group_id
       WHERE ws.id = ? AND ws.owner_user_id = ? AND g.deleted_at IS NULL
       LIMIT 1`,
      sessionId,
      userId,
    );
    if (!session) throw new Error('训练不存在，或不属于当前账号。');
    if (session.status !== 'completed') throw new Error('仅已完成训练可以生成进阶建议。');

    const preference = await db.getFirstAsync<{ weight_increment: '1.25kg' | '2.5kg' | '5kg' | null }>(
      `SELECT weight_increment FROM user_preferences
       WHERE owner_user_id = ? OR owner_user_id IS NULL
       ORDER BY (owner_user_id IS NULL) ASC, updated_at DESC LIMIT 1`,
      userId,
    );
    const fallbackIncrement = parseIncrementKg(preference?.weight_increment ?? '2.5kg');
    const rows = await db.getAllAsync<PerformanceRow>(
      `SELECT wer.id AS record_id, wer.session_id, wer.exercise_id, wer.planned_sets, wer.planned_reps,
              wer.planned_rep_min, wer.planned_rep_max, sets.member_id, sets.completed, sets.skipped,
              sets.actual_reps, sets.actual_weight, sets.planned_weight,
              exercises.equipment, plans.goal AS plan_goal, plan_exercises.intensity_type, plan_exercises.progression_rule_id,
              member_profiles.barbell_increment, member_profiles.dumbbell_increment
       FROM workout_exercise_records wer
       INNER JOIN workout_sessions ws ON ws.id = wer.session_id
       INNER JOIN groups g ON g.id = ws.group_id
       INNER JOIN workout_sets sets ON sets.exercise_record_id = wer.id AND sets.session_id = ws.id
       LEFT JOIN exercises ON exercises.id = wer.exercise_id
       LEFT JOIN plan_templates plans ON plans.id = ws.plan_id AND plans.deleted_at IS NULL
       LEFT JOIN plan_exercises ON plan_exercises.id = wer.plan_exercise_id
       LEFT JOIN member_profiles ON member_profiles.member_id = sets.member_id
         AND member_profiles.group_id = ws.group_id AND member_profiles.owner_user_id = ws.owner_user_id
       WHERE ws.id = ? AND ws.owner_user_id = ? AND ws.status = 'completed' AND ws.deleted_at IS NULL
         AND g.deleted_at IS NULL AND wer.deleted_at IS NULL AND sets.deleted_at IS NULL
       ORDER BY wer.order_index ASC, sets.member_id ASC, sets.set_number ASC`,
      sessionId,
      userId,
    );
    const snapshots = buildSnapshots(rows, fallbackIncrement).filter((snapshot) => summarizeExercisePerformance(snapshot).hasValidWorkingSets);
    if (snapshots.length === 0) return [];

    const history = await this.loadProgressionHistorySnapshot({
      beforeSessionDate: session.date,
      beforeSessionTimestamp: session.finished_at ?? session.updated_at,
      groupId: session.group_id,
      memberExercisePairs: snapshots.map((snapshot) => ({ exerciseId: snapshot.exerciseId, memberId: snapshot.memberId })),
      ownerUserId: userId,
    });
    const createdAt = new Date().toISOString();
    const suggestions = snapshots.flatMap((snapshot) => {
      const result = getProgressionDecision(snapshot, history.get(pairKey(snapshot.memberId, snapshot.exerciseId)) ?? []);
      if (!result) return [];
      return [{
        createdAt,
        exerciseId: snapshot.exerciseId,
        id: `progression_${sessionId}_${snapshot.memberId}_${snapshot.exerciseId}`,
        memberId: snapshot.memberId,
        reason: result.reason,
        sessionId,
        suggestedWeight: result.suggestedWeight,
        suggestion: result.suggestion,
      } satisfies ProgressionSuggestion];
    });

    const writeSuggestions = async () => {
      for (const suggestion of suggestions) {
        await db.runAsync(
          `INSERT INTO progression_suggestions (
             id, owner_user_id, member_id, exercise_id, session_id, suggestion, suggested_weight, reason,
             sync_status, sync_error, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending_create', NULL, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
             suggestion = excluded.suggestion,
             suggested_weight = excluded.suggested_weight,
             reason = excluded.reason,
             deleted_at = NULL,
             sync_status = CASE WHEN progression_suggestions.remote_id IS NULL THEN 'pending_create' ELSE 'pending_update' END,
             sync_error = NULL,
             updated_at = excluded.updated_at`,
          suggestion.id,
          userId,
          suggestion.memberId,
          suggestion.exerciseId,
          suggestion.sessionId,
          suggestion.suggestion,
          suggestion.suggestedWeight ?? null,
          suggestion.reason,
          suggestion.createdAt,
          suggestion.createdAt,
        );
      }
    };
    if ('withTransactionAsync' in db && typeof db.withTransactionAsync === 'function') {
      await db.withTransactionAsync(writeSuggestions);
    } else {
      await writeSuggestions();
    }

    for (const suggestion of suggestions) {
      const persisted = await db.getFirstAsync<{ remote_id: string | null; sync_status: 'pending_create' | 'pending_update' }>(
        'SELECT remote_id, sync_status FROM progression_suggestions WHERE id = ? AND owner_user_id = ?',
        suggestion.id,
        userId,
      );
      await enqueueSyncCandidate({
        entityType: 'progressionSuggestions',
        localId: suggestion.id,
        operation: persisted?.remote_id ? 'update' : 'create',
        ownerUserId: userId,
        payload: {
          id: suggestion.id,
          memberId: suggestion.memberId,
          exerciseId: suggestion.exerciseId,
          sessionId: suggestion.sessionId,
          suggestion: suggestion.suggestion,
          suggestedWeight: suggestion.suggestedWeight,
          reason: suggestion.reason,
          createdAt: suggestion.createdAt,
        },
        remoteId: persisted?.remote_id ?? undefined,
        status: persisted?.sync_status ?? 'pending_create',
        updatedAt: suggestion.createdAt,
      });
    }
    return suggestions;
  }

  async listSuggestionsForSession(sessionId: string): Promise<ProgressionSuggestion[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    if (!userId) return [];
    const scope = getGroupAccountScope(userId, 'groups');
    const rows = await db.getAllAsync<ProgressionSuggestionRow>(
      `SELECT ps.id, ps.member_id, ps.exercise_id, ps.session_id, ps.suggestion, ps.suggested_weight, ps.reason, ps.created_at
       FROM progression_suggestions ps
       INNER JOIN workout_sessions ws ON ws.id = ps.session_id
       INNER JOIN groups ON groups.id = ws.group_id
       WHERE ps.session_id = ? AND ps.owner_user_id = ? AND ws.owner_user_id = ?
         AND ${scope.where} AND ps.deleted_at IS NULL AND ws.deleted_at IS NULL AND groups.deleted_at IS NULL
       ORDER BY ps.created_at DESC, ps.id ASC`,
      sessionId,
      userId,
      userId,
      ...scope.params,
    );
    return rows.map(mapProgressionSuggestion);
  }

  async listSuggestionsForMember(memberId: string): Promise<ProgressionSuggestion[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    if (!userId) return [];
    const scope = getGroupAccountScope(userId, 'groups');
    const rows = await db.getAllAsync<ProgressionSuggestionRow>(
      `SELECT ps.id, ps.member_id, ps.exercise_id, ps.session_id, ps.suggestion, ps.suggested_weight, ps.reason, ps.created_at
       FROM progression_suggestions ps
       INNER JOIN workout_sessions ws ON ws.id = ps.session_id
       INNER JOIN groups ON groups.id = ws.group_id
       WHERE ps.member_id = ? AND ps.owner_user_id = ? AND ws.owner_user_id = ?
         AND ${scope.where} AND ps.deleted_at IS NULL AND ws.deleted_at IS NULL AND groups.deleted_at IS NULL
       ORDER BY ps.created_at DESC, ps.id ASC`,
      memberId,
      userId,
      userId,
      ...scope.params,
    );
    return rows.map(mapProgressionSuggestion);
  }

  async listSuggestionsForMemberExercise(input: { exerciseId: string; groupId: string; limit?: number; memberId: string }): Promise<ProgressionSuggestion[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    if (!userId) return [];
    const scope = getGroupAccountScope(userId, 'groups');
    const rows = await db.getAllAsync<ProgressionSuggestionRow>(
      `SELECT ps.id, ps.member_id, ps.exercise_id, ps.session_id, ps.suggestion, ps.suggested_weight, ps.reason, ps.created_at
       FROM progression_suggestions ps
       INNER JOIN workout_sessions ws ON ws.id = ps.session_id
       INNER JOIN groups ON groups.id = ws.group_id
       WHERE ps.member_id = ? AND ps.exercise_id = ? AND ws.group_id = ? AND ps.owner_user_id = ? AND ws.owner_user_id = ?
         AND ${scope.where} AND ps.deleted_at IS NULL AND ws.deleted_at IS NULL AND groups.deleted_at IS NULL
       ORDER BY ws.date DESC, COALESCE(ws.finished_at, ws.updated_at) DESC, ps.created_at DESC
       LIMIT ?`,
      input.memberId,
      input.exerciseId,
      input.groupId,
      userId,
      userId,
      ...scope.params,
      input.limit ?? 5,
    );
    return rows.map(mapProgressionSuggestion);
  }

  async getLatestSuggestion(memberId: string, exerciseId: string): Promise<ProgressionSuggestion | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    if (!userId) return null;
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<ProgressionSuggestionRow>(
      `SELECT ps.id, ps.member_id, ps.exercise_id, ps.session_id, ps.suggestion, ps.suggested_weight, ps.reason, ps.created_at
       FROM progression_suggestions ps
       INNER JOIN workout_sessions ws ON ws.id = ps.session_id
       INNER JOIN groups ON groups.id = ws.group_id
       WHERE ps.member_id = ? AND ps.exercise_id = ? AND ps.owner_user_id = ? AND ws.owner_user_id = ?
         AND ${scope.where} AND ps.deleted_at IS NULL AND ws.deleted_at IS NULL AND groups.deleted_at IS NULL
       ORDER BY ws.date DESC, COALESCE(ws.finished_at, ws.updated_at) DESC, ps.created_at DESC
       LIMIT 1`,
      memberId,
      exerciseId,
      userId,
      userId,
      ...scope.params,
    );
    return row ? mapProgressionSuggestion(row) : null;
  }

  private async loadProgressionHistorySnapshot(input: {
    beforeSessionDate: string;
    beforeSessionTimestamp: string;
    groupId: string;
    memberExercisePairs: { exerciseId: string; memberId: string }[];
    ownerUserId: string;
  }): Promise<Map<string, HistoricalExercisePerformance[]>> {
    const db = await this.getDb();
    const uniquePairs = [...new Map(input.memberExercisePairs.map((pair) => [pairKey(pair.memberId, pair.exerciseId), pair])).values()];
    if (uniquePairs.length === 0) return new Map();
    const pairSql = uniquePairs.map(() => '(sets.member_id = ? AND wer.exercise_id = ?)').join(' OR ');
    const params = uniquePairs.flatMap((pair) => [pair.memberId, pair.exerciseId]);
    const rows = await db.getAllAsync<HistoricalPerformanceRow>(
      `SELECT wer.id AS record_id, wer.session_id, wer.exercise_id, wer.planned_sets, wer.planned_reps,
              wer.planned_rep_min, wer.planned_rep_max, sets.member_id, sets.completed, sets.skipped,
              sets.actual_reps, sets.actual_weight, sets.planned_weight,
              exercises.equipment, plans.goal AS plan_goal, plan_exercises.intensity_type, plan_exercises.progression_rule_id,
              member_profiles.barbell_increment, member_profiles.dumbbell_increment,
              ws.date AS session_date, ws.finished_at AS session_finished_at, ws.updated_at AS session_updated_at
       FROM workout_sessions ws
       INNER JOIN workout_exercise_records wer ON wer.session_id = ws.id AND wer.deleted_at IS NULL
       INNER JOIN workout_sets sets ON sets.exercise_record_id = wer.id AND sets.session_id = ws.id AND sets.deleted_at IS NULL
       LEFT JOIN exercises ON exercises.id = wer.exercise_id
       LEFT JOIN plan_templates plans ON plans.id = ws.plan_id AND plans.deleted_at IS NULL
       LEFT JOIN plan_exercises ON plan_exercises.id = wer.plan_exercise_id
       LEFT JOIN member_profiles ON member_profiles.member_id = sets.member_id
         AND member_profiles.group_id = ws.group_id AND member_profiles.owner_user_id = ws.owner_user_id
       WHERE ws.owner_user_id = ? AND ws.group_id = ? AND ws.status = 'completed' AND ws.deleted_at IS NULL
         AND (ws.date < ? OR (ws.date = ? AND COALESCE(ws.finished_at, ws.updated_at) < ?))
         AND (${pairSql})
       ORDER BY ws.date DESC, COALESCE(ws.finished_at, ws.updated_at) DESC, wer.order_index ASC, sets.set_number ASC`,
      input.ownerUserId,
      input.groupId,
      input.beforeSessionDate,
      input.beforeSessionDate,
      input.beforeSessionTimestamp,
      ...params,
    );
    const fallbackIncrement = 2.5;
    const sessionsByPair = new Map<string, Map<string, PerformanceRow[]>>();
    for (const row of rows) {
      const key = pairKey(row.member_id, row.exercise_id);
      const sessionRows = sessionsByPair.get(key) ?? new Map<string, PerformanceRow[]>();
      sessionRows.set(row.session_id, [...(sessionRows.get(row.session_id) ?? []), row]);
      sessionsByPair.set(key, sessionRows);
    }
    const history = new Map<string, HistoricalExercisePerformance[]>();
    for (const [key, sessions] of sessionsByPair) {
      const items: HistoricalExercisePerformance[] = [];
      for (const sessionRows of [...sessions.values()].slice(0, 3)) {
        for (const snapshot of buildSnapshots(sessionRows, fallbackIncrement)) {
          const summary = summarizeExercisePerformance(snapshot);
          items.push({
            allSetsReachedTarget: summary.allSetsReachedTarget,
            hasValidWorkingSets: summary.hasValidWorkingSets,
            repCompletionRate: summary.repCompletionRate,
          });
        }
      }
      history.set(key, items.slice(0, 3));
    }
    return history;
  }
}
