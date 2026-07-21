import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { AchievementMetrics } from '@liftmark/shared';

import { buildAchievementReconciliation, type DefinitionRow, type ExistingRow } from './achievements.service';

const metrics: AchievementMetrics = {
  completedWorkouts: 10,
  totalVolume: 0,
  groupWorkouts: 0,
  completedCycles: 0,
  recoveryCheckins: 0,
  currentActiveWeekStreak: 0,
  longestActiveWeekStreak: 0,
  thisWeekWorkoutCount: 0,
  lastWorkoutDate: null,
};

const definition: DefinitionRow = {
  id: 'definition-10',
  code: 'workouts_10',
  name: '稳定起步',
  description: '累计完成 10 次训练。',
  metric: 'completed_workouts',
  target: '10',
};

describe('achievement reconciliation', () => {
  it('sets achieved_at only when the threshold is first reached', () => {
    const now = new Date('2026-07-20T08:00:00.000Z');
    const result = buildAchievementReconciliation({ definitions: [definition], existingRows: [], metrics, now });
    assert.equal(result.rows[0]?.progress, 10);
    assert.equal(result.rows[0]?.achieved_at, now);
  });

  it('preserves the first achieved_at and monotonic progress on repeated refresh', () => {
    const firstAchieved = new Date('2026-07-10T08:00:00.000Z');
    const existing: ExistingRow = {
      id: 'user-achievement-1',
      achievement_definition_id: definition.id,
      progress: '12',
      achieved_at: firstAchieved,
      created_at: firstAchieved,
    };
    const result = buildAchievementReconciliation({
      definitions: [definition],
      existingRows: [existing],
      metrics: { ...metrics, completedWorkouts: 9 },
      now: new Date('2026-07-20T08:00:00.000Z'),
    });
    assert.equal(result.rows[0]?.id, existing.id);
    assert.equal(result.rows[0]?.progress, 12);
    assert.equal(result.rows[0]?.achieved_at, firstAchieved);
  });

  it('filters disabled legacy codes from reconciliation even if supplied', () => {
    const legacy = { ...definition, id: 'legacy', code: 'streak_3_days' };
    const result = buildAchievementReconciliation({ definitions: [legacy], existingRows: [], metrics, now: new Date() });
    assert.deepEqual(result.rows, []);
  });
});
