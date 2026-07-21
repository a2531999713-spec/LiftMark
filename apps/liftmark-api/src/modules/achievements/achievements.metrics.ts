import type { AchievementMetrics } from '@liftmark/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

type GenericRow = {
  id: string;
  client_id: string;
  parent_server_id?: string | null;
  status?: string | null;
  member_client_id?: string | null;
  actual_weight?: number | string | null;
  actual_reps?: number | string | null;
  client_updated_at?: Date | string | null;
  created_at?: Date | string | null;
  deleted_at?: Date | string | null;
  payload?: Record<string, unknown> | string | null;
};

export type AchievementMetricRows = {
  sessions: GenericRow[];
  sets: GenericRow[];
  cycles: GenericRow[];
  recoveryLogs: GenericRow[];
};

function payloadOf(row: GenericRow): Record<string, unknown> {
  if (row.payload && typeof row.payload === 'object') return row.payload;
  if (typeof row.payload === 'string') {
    try {
      return JSON.parse(row.payload) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function booleanValue(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true';
}

function safeNumber(value: unknown, max: number): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, max);
}

function dateKeyFromRow(row: GenericRow): string | null {
  const payload = payloadOf(row);
  const exact = payload.date;
  if (typeof exact === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(exact)) return exact;
  const fallback = row.client_updated_at ?? row.created_at;
  if (!fallback) return null;
  const date = new Date(fallback);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return date.toISOString().slice(0, 10);
}

export function getMondayWeekKey(dateKey: string): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const weekday = new Date(timestamp).getUTCDay();
  return addDays(dateKey, -(weekday === 0 ? 6 : weekday - 1));
}

export function calculateLongestWeekStreak(weekKeys: string[]): number {
  const sorted = Array.from(new Set(weekKeys.map(getMondayWeekKey))).sort();
  let best = 0;
  let current = 0;
  let previous: string | null = null;
  for (const weekKey of sorted) {
    current = previous && addDays(previous, 7) === weekKey ? current + 1 : 1;
    best = Math.max(best, current);
    previous = weekKey;
  }
  return best;
}

export function calculateCurrentWeekStreak(weekKeys: string[], todayKey: string): number {
  const active = new Set(weekKeys.map(getMondayWeekKey));
  const currentWeek = getMondayWeekKey(todayKey);
  let cursor = active.has(currentWeek) ? currentWeek : addDays(currentWeek, -7);
  let streak = 0;
  while (active.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

function linkedSessionClientId(set: GenericRow): string | null {
  const payload = payloadOf(set);
  const value = set.parent_server_id ?? payload.sessionId ?? payload.session_id;
  return typeof value === 'string' && value ? value : null;
}

function isCompletedSet(set: GenericRow): boolean {
  const payload = payloadOf(set);
  return booleanValue(payload.completed) && !booleanValue(payload.skipped);
}

function volumeForSet(set: GenericRow): number {
  const payload = payloadOf(set);
  const weight = safeNumber(set.actual_weight ?? payload.actualWeight ?? payload.plannedWeight, 100_000);
  const reps = safeNumber(set.actual_reps ?? payload.actualReps ?? payload.plannedReps, 100_000);
  return Math.min(weight * reps, 1_000_000_000);
}

export function calculateMetricsFromRows(
  rows: AchievementMetricRows,
  todayKey = new Date().toISOString().slice(0, 10),
): AchievementMetrics {
  const completedSetsBySession = new Map<string, GenericRow[]>();
  for (const set of rows.sets) {
    if (set.deleted_at) continue;
    if (!isCompletedSet(set)) continue;
    const sessionId = linkedSessionClientId(set);
    if (!sessionId) continue;
    const current = completedSetsBySession.get(sessionId) ?? [];
    current.push(set);
    completedSetsBySession.set(sessionId, current);
  }

  const validSessions = rows.sessions.filter((session) => {
    if (session.deleted_at) return false;
    const status = session.status ?? payloadOf(session).status;
    return status === 'completed' && (completedSetsBySession.get(session.client_id)?.length ?? 0) > 0;
  });
  const workoutDates = validSessions.map(dateKeyFromRow).filter((value): value is string => Boolean(value));
  const weekKeys = workoutDates.map(getMondayWeekKey);
  const currentWeek = getMondayWeekKey(todayKey);
  const totalVolume = validSessions.reduce((total, session) => {
    return total + (completedSetsBySession.get(session.client_id) ?? []).reduce((sum, set) => sum + volumeForSet(set), 0);
  }, 0);
  const recoveryKeys = new Set(
    rows.recoveryLogs.filter((row) => !row.deleted_at).map((row) => {
      const payload = payloadOf(row);
      const memberId = row.member_client_id ?? payload.memberId ?? payload.member_id;
      const dateKey = dateKeyFromRow(row);
      return typeof memberId === 'string' && dateKey ? `${memberId}:${dateKey}` : null;
    }).filter((value): value is string => Boolean(value)),
  );

  return {
    completedWorkouts: validSessions.length,
    totalVolume,
    groupWorkouts: validSessions.filter((session) => payloadOf(session).trainingMode === 'group_local' || payloadOf(session).training_mode === 'group_local').length,
    completedCycles: rows.cycles.filter((cycle) => !cycle.deleted_at && ['completed', 'archived'].includes(String(cycle.status ?? payloadOf(cycle).status ?? ''))).length,
    recoveryCheckins: recoveryKeys.size,
    currentActiveWeekStreak: calculateCurrentWeekStreak(weekKeys, todayKey),
    longestActiveWeekStreak: calculateLongestWeekStreak(weekKeys),
    thisWeekWorkoutCount: workoutDates.filter((dateKey) => getMondayWeekKey(dateKey) === currentWeek).length,
    lastWorkoutDate: workoutDates.slice().sort().at(-1) ?? null,
  };
}

export async function calculateAchievementMetrics(userId: string): Promise<AchievementMetrics> {
  const { db } = await import('../../db/connection');
  const select = ['id', 'client_id', 'parent_server_id', 'status', 'member_client_id', 'actual_weight', 'actual_reps', 'client_updated_at', 'created_at', 'payload'];
  const [sessions, sets, cycles, recoveryLogs] = await Promise.all([
    db('workout_sessions').where({ user_id: userId }).whereNull('deleted_at').select(select),
    db('workout_sets').where({ user_id: userId }).whereNull('deleted_at').select(select),
    db('plan_cycles').where({ user_id: userId }).whereNull('deleted_at').select(select),
    db('recovery_logs').where({ user_id: userId }).whereNull('deleted_at').select(select),
  ]);
  return calculateMetricsFromRows({ sessions, sets, cycles, recoveryLogs });
}
