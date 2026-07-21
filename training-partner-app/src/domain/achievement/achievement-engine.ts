import { ACHIEVEMENT_CATALOG } from '@liftmark/shared';
import type {
  AchievementActivityWeek,
  AchievementMetric,
  AchievementMetrics,
  AchievementProgress,
  AchievementSnapshot,
} from '@liftmark/shared';

const DAY_MS = 24 * 60 * 60 * 1000;

type CivilDate = { year: number; month: number; day: number };

function parseDateKey(dateKey: string): CivilDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

function toTimestamp(dateKey: string): number | null {
  const value = parseDateKey(dateKey);
  return value ? Date.UTC(value.year, value.month - 1, value.day) : null;
}

function fromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}-${`${date.getUTCDate()}`.padStart(2, '0')}`;
}

export function addDaysToDateKey(dateKey: string, days: number): string {
  const timestamp = toTimestamp(dateKey);
  if (timestamp === null) throw new Error(`Invalid date key: ${dateKey}`);
  return fromTimestamp(timestamp + days * DAY_MS);
}

export function getMondayWeekKey(dateKey: string): string {
  const timestamp = toTimestamp(dateKey);
  if (timestamp === null) throw new Error(`Invalid date key: ${dateKey}`);
  const weekday = new Date(timestamp).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return fromTimestamp(timestamp - daysFromMonday * DAY_MS);
}

export function calculateLongestWeekStreak(weekKeys: string[]): number {
  const sorted = Array.from(new Set(weekKeys.map(getMondayWeekKey))).sort();
  let longest = 0;
  let current = 0;
  let previousTimestamp: number | null = null;
  for (const weekKey of sorted) {
    const timestamp = toTimestamp(weekKey);
    if (timestamp === null) continue;
    current = previousTimestamp !== null && timestamp - previousTimestamp === 7 * DAY_MS ? current + 1 : 1;
    longest = Math.max(longest, current);
    previousTimestamp = timestamp;
  }
  return longest;
}

export function calculateCurrentWeekStreak(weekKeys: string[], todayKey: string): number {
  const activeWeeks = new Set(weekKeys.map(getMondayWeekKey));
  const currentWeek = getMondayWeekKey(todayKey);
  let cursor = activeWeeks.has(currentWeek) ? currentWeek : addDaysToDateKey(currentWeek, -7);
  let streak = 0;
  while (activeWeeks.has(cursor)) {
    streak += 1;
    cursor = addDaysToDateKey(cursor, -7);
  }
  return streak;
}

export function buildActivityWeeks(workoutDateKeys: string[], todayKey: string, weekCount = 12): AchievementActivityWeek[] {
  const currentWeek = getMondayWeekKey(todayKey);
  const counts = new Map<string, number>();
  for (const dateKey of workoutDateKeys) {
    if (!parseDateKey(dateKey)) continue;
    const weekKey = getMondayWeekKey(dateKey);
    counts.set(weekKey, (counts.get(weekKey) ?? 0) + 1);
  }
  return Array.from({ length: weekCount }, (_, index) => {
    const weekKey = addDaysToDateKey(currentWeek, (index - weekCount + 1) * 7);
    const workoutCount = counts.get(weekKey) ?? 0;
    return { weekKey, workoutCount, active: workoutCount > 0, current: weekKey === currentWeek };
  });
}

export function getMetricValue(metrics: AchievementMetrics, metric: AchievementMetric): number {
  switch (metric) {
    case 'completed_workouts': return metrics.completedWorkouts;
    case 'longest_active_week_streak': return metrics.longestActiveWeekStreak;
    case 'total_volume': return metrics.totalVolume;
    case 'group_workouts': return metrics.groupWorkouts;
    case 'completed_cycles': return metrics.completedCycles;
    case 'recovery_checkins': return metrics.recoveryCheckins;
  }
}

export function evaluateAchievements(
  metrics: AchievementMetrics,
  achievedAtByCode: Partial<Record<string, string | null>> = {},
): AchievementProgress[] {
  return ACHIEVEMENT_CATALOG.map((definition) => {
    const rawProgress = getMetricValue(metrics, definition.metric);
    const progress = Math.max(0, Number.isFinite(rawProgress) ? rawProgress : 0);
    return { ...definition, progress, achieved: progress >= definition.target, achievedAt: achievedAtByCode[definition.code] ?? null };
  });
}

function earlierDate(left?: string | null, right?: string | null): string | null {
  if (!left) return right ?? null;
  if (!right) return left;
  return left <= right ? left : right;
}

function latestDate(left?: string | null, right?: string | null): string | null {
  if (!left) return right ?? null;
  if (!right) return left;
  return left >= right ? left : right;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function mergeAchievementSnapshots(local: AchievementSnapshot, remote: AchievementSnapshot): AchievementSnapshot {
  const metrics: AchievementMetrics = {
    completedWorkouts: Math.max(nonNegative(local.metrics.completedWorkouts), nonNegative(remote.metrics.completedWorkouts)),
    totalVolume: Math.max(nonNegative(local.metrics.totalVolume), nonNegative(remote.metrics.totalVolume)),
    groupWorkouts: Math.max(nonNegative(local.metrics.groupWorkouts), nonNegative(remote.metrics.groupWorkouts)),
    completedCycles: Math.max(nonNegative(local.metrics.completedCycles), nonNegative(remote.metrics.completedCycles)),
    recoveryCheckins: Math.max(nonNegative(local.metrics.recoveryCheckins), nonNegative(remote.metrics.recoveryCheckins)),
    longestActiveWeekStreak: Math.max(nonNegative(local.metrics.longestActiveWeekStreak), nonNegative(remote.metrics.longestActiveWeekStreak)),
    currentActiveWeekStreak: nonNegative(local.metrics.currentActiveWeekStreak),
    thisWeekWorkoutCount: nonNegative(local.metrics.thisWeekWorkoutCount),
    lastWorkoutDate: latestDate(local.metrics.lastWorkoutDate, remote.metrics.lastWorkoutDate),
  };
  const localByCode = new Map(local.achievements.map((item) => [item.code, item]));
  const remoteByCode = new Map(remote.achievements.map((item) => [item.code, item]));
  const achievements = evaluateAchievements(metrics).map((item) => {
    const localItem = localByCode.get(item.code);
    const remoteItem = remoteByCode.get(item.code);
    const progress = Math.max(nonNegative(item.progress), nonNegative(localItem?.progress ?? 0), nonNegative(remoteItem?.progress ?? 0));
    return {
      ...item,
      progress,
      achieved: item.achieved || Boolean(localItem?.achieved) || Boolean(remoteItem?.achieved),
      achievedAt: earlierDate(localItem?.achievedAt, remoteItem?.achievedAt),
    };
  });
  return {
    metrics,
    achievements,
    activityWeeks: local.activityWeeks,
    generatedAt: local.generatedAt >= remote.generatedAt ? local.generatedAt : remote.generatedAt,
  };
}

export function selectNextMilestone(achievements: AchievementProgress[]): AchievementProgress | null {
  return achievements.filter((item) => !item.achieved).slice().sort((left, right) => {
    const ratioDiff = right.progress / right.target - left.progress / left.target;
    return ratioDiff || left.sortOrder - right.sortOrder;
  })[0] ?? null;
}

export function sortAchievementGroups(achievements: AchievementProgress[]) {
  return {
    achieved: achievements.filter((item) => item.achieved).slice().sort(
      (left, right) => (right.achievedAt ?? '').localeCompare(left.achievedAt ?? '') || left.sortOrder - right.sortOrder,
    ),
    inProgress: achievements.filter((item) => !item.achieved).slice().sort(
      (left, right) => right.progress / right.target - left.progress / left.target || left.sortOrder - right.sortOrder,
    ),
  };
}

