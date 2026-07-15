/* eslint-disable import/first */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/data/local/accountScope', () => ({
  getCurrentAccountUserId: jest.fn(async () => 'account-a'),
  getGroupAccountScope: jest.fn(() => ({ params: ['account-a'], where: 'groups.owner_user_id = ?' })),
  getOwnerUserIdForWrite: jest.fn((userId: string) => userId),
  getPlanAccountScope: jest.fn(() => ({ params: ['account-a'], where: 'plan_templates.owner_user_id = ?' })),
  getRequiredCurrentUserId: jest.fn(async () => 'account-a'),
}));

jest.mock('@/domain/common/ids', () => ({ createId: (prefix?: string) => `${prefix ?? 'id'}_test` }));
jest.mock('@/domain/common/time', () => ({ nowIso: () => '2026-07-15T08:00:00.000Z' }));
jest.mock('@/sync/syncQueue', () => ({ enqueueSyncCandidate: jest.fn(async () => undefined) }));

import { SQLiteWorkoutRepository } from '@/data/local/repositories/workoutRepository';
import { enqueueSyncCandidate } from '@/sync/syncQueue';

describe('SQLiteWorkoutRepository recovery adjustment', () => {
  it('updates only visible current-session pending sets and skips missing or zero weights', async () => {
    const txn = { runAsync: jest.fn(async () => undefined) };
    const db = {
      getAllAsync: jest.fn(async () => [
        {
          actual_weight: 100,
          barbell_increment: 2.5,
          dumbbell_increment: 1,
          equipment: 'barbell',
          id: 'set-weighted',
          member_id: 'member-a',
          planned_weight: 100,
        },
        {
          actual_weight: null,
          barbell_increment: 2.5,
          dumbbell_increment: 1,
          equipment: 'barbell',
          id: 'set-missing',
          member_id: 'member-a',
          planned_weight: null,
        },
        {
          actual_weight: 0,
          barbell_increment: 2.5,
          dumbbell_increment: 1,
          equipment: 'barbell',
          id: 'set-zero',
          member_id: 'member-a',
          planned_weight: 0,
        },
      ]),
      getFirstAsync: jest.fn(async () => ({ group_id: 'group-a', id: 'session-a' })),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof txn) => Promise<void>) => callback(txn)),
    };

    const result = await new SQLiteWorkoutRepository(async () => db as never)
      .applyRecoveryWeightReduction({
        memberIds: ['member-a'],
        reductionPercent: 7.5,
        sessionId: 'session-a',
      });

    expect(result).toEqual({ skippedSetCount: 2, updatedSetCount: 1 });
    expect(String((db.getFirstAsync.mock.calls as unknown[][])[0]?.[0])).toContain("status IN ('draft', 'in_progress')");
    const selectSql = String((db.getAllAsync.mock.calls as unknown[][])[0]?.[0]);
    expect(selectSql).toContain('sets.completed = 0');
    expect(selectSql).toContain('sets.skipped = 0');
    expect(selectSql).toContain('sets.deleted_at IS NULL');
    expect(selectSql).toContain('sets.member_id IN (?)');
    expect(txn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('actual_weight = CASE WHEN actual_weight = planned_weight'),
      92.5,
      92.5,
      '2026-07-15T08:00:00.000Z',
      'set-weighted',
      'account-a',
      'session-a',
    );
    expect(
      (txn.runAsync.mock.calls as unknown[][]).some(([sql]) => String(sql).includes('plan_exercises')),
    ).toBe(false);
    expect(enqueueSyncCandidate).toHaveBeenCalledTimes(1);
  });

  it('refuses to adjust a session outside the current account or editable status', async () => {
    const db = { getFirstAsync: jest.fn(async () => null) };
    await expect(
      new SQLiteWorkoutRepository(async () => db as never).applyRecoveryWeightReduction({
        memberIds: ['member-a'],
        sessionId: 'session-other',
      }),
    ).rejects.toThrow('not visible or editable');
    expect(String((db.getFirstAsync.mock.calls as unknown[][])[0]?.[0])).toContain("status IN ('draft', 'in_progress')");
  });
});
