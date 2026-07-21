import { describe, expect, it } from '@jest/globals';
import type { AchievementMetrics, AchievementSnapshot } from '@liftmark/shared';

import {
  buildActivityWeeks,
  calculateCurrentWeekStreak,
  calculateLongestWeekStreak,
  evaluateAchievements,
  getMondayWeekKey,
  mergeAchievementSnapshots,
  selectNextMilestone,
} from '@/domain/achievement/achievement-engine';

function metrics(patch: Partial<AchievementMetrics> = {}): AchievementMetrics {
  return {
    completedWorkouts: 0,
    totalVolume: 0,
    groupWorkouts: 0,
    completedCycles: 0,
    recoveryCheckins: 0,
    currentActiveWeekStreak: 0,
    longestActiveWeekStreak: 0,
    thisWeekWorkoutCount: 0,
    lastWorkoutDate: null,
    ...patch,
  };
}

function snapshot(value: AchievementMetrics, generatedAt: string): AchievementSnapshot {
  return { metrics: value, achievements: evaluateAchievements(value), activityWeeks: [], generatedAt };
}

describe('achievement engine', () => {
  it.each<[number, 'first_workout' | 'workouts_10' | 'workouts_25' | 'workouts_50', boolean]>([
    [1, 'first_workout', true],
    [9, 'workouts_10', false],
    [10, 'workouts_10', true],
    [25, 'workouts_25', true],
    [50, 'workouts_50', true],
  ])('evaluates %s completed workouts for %s', (count, code, achieved) => {
    expect(evaluateAchievements(metrics({ completedWorkouts: count })).find((item) => item.code === code)?.achieved).toBe(achieved);
  });

  it('uses exact volume, group, cycle and recovery thresholds deterministically', () => {
    const below = evaluateAchievements(metrics({ totalVolume: 9999 }));
    expect(below.find((item) => item.code === 'volume_10000')?.achieved).toBe(false);
    const input = metrics({ totalVolume: 10_000, groupWorkouts: 1, completedCycles: 1, recoveryCheckins: 7 });
    const first = evaluateAchievements(input);
    expect(first).toEqual(evaluateAchievements(input));
    expect(first.filter((item) => ['volume_10000', 'first_group_workout', 'cycle_complete_1', 'recovery_checkins_7'].includes(item.code)).every((item) => item.achieved)).toBe(true);
    expect(first).toHaveLength(11);
    expect(first.some((item) => (item.code as string) === 'streak_3_days')).toBe(false);
  });

  it('uses Monday week keys across a year boundary and counts a week once', () => {
    expect(getMondayWeekKey('2026-01-01')).toBe('2025-12-29');
    const keys = ['2025-12-29', '2025-12-31', '2026-01-05', '2026-01-12'].map(getMondayWeekKey);
    expect(calculateLongestWeekStreak(keys)).toBe(3);
    expect(calculateCurrentWeekStreak(keys, '2026-01-14')).toBe(3);
  });

  it('breaks on a missing week but preserves last week streak before this week ends', () => {
    expect(calculateLongestWeekStreak(['2026-06-29', '2026-07-13'])).toBe(1);
    expect(calculateCurrentWeekStreak(['2026-06-29', '2026-07-06'], '2026-07-15')).toBe(2);
    expect(calculateCurrentWeekStreak(['2026-06-29'], '2026-07-15')).toBe(0);
  });

  it('builds exactly 12 activity weeks with explicit zero and current states', () => {
    const weeks = buildActivityWeeks(['2026-07-20', '2026-07-20', '2026-07-06'], '2026-07-20');
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)).toMatchObject({ current: true, workoutCount: 2, weekKey: '2026-07-20' });
    expect(weeks.some((week) => week.workoutCount === 0)).toBe(true);
  });

  it('merges monotonic metrics without replacing local current-week values', () => {
    const local = snapshot(metrics({ completedWorkouts: 12, totalVolume: 12_000, currentActiveWeekStreak: 3, thisWeekWorkoutCount: 2 }), '2026-07-20T08:00:00.000Z');
    const remote = snapshot(metrics({ completedWorkouts: 15, totalVolume: 10_000, currentActiveWeekStreak: 8, thisWeekWorkoutCount: 0 }), '2026-07-20T09:00:00.000Z');
    remote.achievements.find((item) => item.code === 'workouts_10')!.achievedAt = '2026-07-10T00:00:00.000Z';
    local.achievements.find((item) => item.code === 'workouts_10')!.achievedAt = '2026-07-11T00:00:00.000Z';
    const merged = mergeAchievementSnapshots(local, remote);
    expect(merged.metrics).toMatchObject({ completedWorkouts: 15, totalVolume: 12_000, currentActiveWeekStreak: 3, thisWeekWorkoutCount: 2 });
    expect(merged.achievements.find((item) => item.code === 'workouts_10')?.achievedAt).toBe('2026-07-10T00:00:00.000Z');
  });

  it('selects the highest completion ratio and then catalog order', () => {
    const achievements = evaluateAchievements(metrics({ completedWorkouts: 9, totalVolume: 5000 }));
    expect(selectNextMilestone(achievements)?.code).toBe('workouts_10');
  });
});
