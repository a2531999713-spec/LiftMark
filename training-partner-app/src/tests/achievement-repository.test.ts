/* eslint-disable import/first */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/data/local/accountScope', () => ({
  getRequiredCurrentUserId: jest.fn(async () => 'account-a'),
}));

import { SQLiteAchievementRepository } from '@/data/local/repositories/achievementRepository';

describe('SQLiteAchievementRepository', () => {
  it('aggregates valid sessions across groups with fixed account-scoped queries', async () => {
    const calls: { params: unknown[]; sql: string }[] = [];
    const db = {
      getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ sql, params });
        return [
          { date: '2026-07-06', training_mode: 'solo_local', total_volume: 1200 },
          { date: '2026-07-20', training_mode: 'group_local', total_volume: 800 },
        ];
      }),
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ sql, params });
        return { count: sql.includes('plan_cycles') ? 1 : 7 };
      }),
    };
    const snapshot = await new SQLiteAchievementRepository(async () => db as never).getAchievementSnapshot({ ownerUserId: 'account-a', todayKey: '2026-07-20' });
    expect(snapshot.metrics).toMatchObject({ completedWorkouts: 2, totalVolume: 2000, groupWorkouts: 1, completedCycles: 1, recoveryCheckins: 7, thisWeekWorkoutCount: 1 });
    expect(calls).toHaveLength(3);
    expect(calls[0]?.sql).toContain("sessions.status = 'completed'");
    expect(calls[0]?.sql).toContain('sets.completed = 1');
    expect(calls[0]?.sql).toContain('sets.skipped = 0');
    expect(calls[0]?.sql).toContain('sets.deleted_at IS NULL');
    expect(calls[0]?.sql).toContain('sessions.owner_user_id = ?');
    expect(calls[0]?.params.slice(0, 2)).toEqual(['account-a', 'account-a']);
  });

  it('rejects a requested owner that differs from the authenticated account', async () => {
    const repository = new SQLiteAchievementRepository(async () => ({}) as never);
    await expect(repository.getAchievementSnapshot({ ownerUserId: 'account-b' })).rejects.toThrow('scope');
  });

  it('can exclude the just-finished session to derive the unlock delta', async () => {
    const db = {
      getAllAsync: jest.fn(async () => []),
      getFirstAsync: jest.fn(async () => ({ count: 0 })),
    };
    await new SQLiteAchievementRepository(async () => db as never).getAchievementSnapshot({ ownerUserId: 'account-a', excludeSessionId: 'session-new' });
    const params = (db.getAllAsync.mock.calls[0] as unknown[]).slice(1);
    expect(params.slice(-2)).toEqual(['session-new', 'session-new']);
  });
});
