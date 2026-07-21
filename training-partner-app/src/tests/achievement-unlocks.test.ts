/* eslint-disable import/first */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { AchievementMetrics, AchievementSnapshot } from '@liftmark/shared';

const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => { mockStore.set(key, value); }),
  deleteItemAsync: jest.fn(async (key: string) => { mockStore.delete(key); }),
}));

import { evaluateAchievements } from '@/domain/achievement/achievement-engine';
import { consumePendingAchievementUnlocks, queueNewAchievementUnlocks } from '@/services/achievementUnlockService';

function snapshot(completedWorkouts: number): AchievementSnapshot {
  const metrics: AchievementMetrics = {
    completedWorkouts,
    totalVolume: 0,
    groupWorkouts: 0,
    completedCycles: 0,
    recoveryCheckins: 0,
    currentActiveWeekStreak: 0,
    longestActiveWeekStreak: 0,
    thisWeekWorkoutCount: 0,
    lastWorkoutDate: null,
  };
  return { metrics, achievements: evaluateAchievements(metrics), activityWeeks: [], generatedAt: '2026-07-20T00:00:00.000Z' };
}

describe('achievement unlock state', () => {
  beforeEach(() => mockStore.clear());

  it('queues a newly reached achievement once and consumes it once', async () => {
    await queueNewAchievementUnlocks({ userId: 'account-a', before: snapshot(0), after: snapshot(1) });
    expect((await consumePendingAchievementUnlocks('account-a')).map((item) => item.code)).toEqual(['first_workout']);
    expect(await consumePendingAchievementUnlocks('account-a')).toEqual([]);
    await queueNewAchievementUnlocks({ userId: 'account-a', before: snapshot(0), after: snapshot(1) });
    expect(await consumePendingAchievementUnlocks('account-a')).toEqual([]);
  });

  it('keeps seen codes isolated by account and suppresses historical flood on first baseline', async () => {
    await queueNewAchievementUnlocks({ userId: 'account-a', before: null, after: snapshot(10) });
    await queueNewAchievementUnlocks({ userId: 'account-b', before: snapshot(0), after: snapshot(1) });
    expect(await consumePendingAchievementUnlocks('account-a')).toEqual([]);
    expect((await consumePendingAchievementUnlocks('account-b')).map((item) => item.code)).toEqual(['first_workout']);
  });
});
