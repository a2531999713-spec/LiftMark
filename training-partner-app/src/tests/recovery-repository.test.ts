/* eslint-disable import/first */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('@/data/local/accountScope', () => ({
  getGroupAccountScope: jest.fn(() => ({ params: ['account-a'], where: 'groups.owner_user_id = ?' })),
  getRequiredCurrentUserId: jest.fn(async () => 'account-a'),
}));

jest.mock('@/domain/common/time', () => ({
  nowIso: () => '2026-07-15T08:00:00.000Z',
}));

jest.mock('@/sync/syncQueue', () => ({
  enqueueSyncCandidate: jest.fn(async () => undefined),
}));

import { SQLiteRecoveryRepository } from '@/data/local/repositories/recoveryRepository';
import { enqueueSyncCandidate } from '@/sync/syncQueue';

const mockEnqueue = enqueueSyncCandidate as jest.MockedFunction<typeof enqueueSyncCandidate>;

function row(patch: Record<string, unknown> = {}) {
  return {
    appetite_score: 4,
    created_at: '2026-07-15T07:00:00.000Z',
    date: '2026-07-15',
    deleted_at: null,
    fatigue_score: 2,
    id: 'recovery_a',
    joint_pain_score: 1,
    member_id: 'member-a',
    motivation_score: 4,
    owner_user_id: 'account-a',
    recommendation: 'normal',
    remote_id: null,
    sleep_score: 5,
    soreness_score: 2,
    total_score: 26,
    updated_at: '2026-07-15T07:00:00.000Z',
    ...patch,
  };
}

const input = {
  appetiteScore: 4,
  date: '2026-07-15',
  fatigueScore: 2,
  jointPainScore: 1,
  memberId: 'member-a',
  motivationScore: 4,
  ownerUserId: 'account-a',
  recommendation: 'normal' as const,
  sleepScore: 5,
  sorenessScore: 2,
  totalScore: 26,
};

describe('SQLiteRecoveryRepository', () => {
  it('reads only a visible account member and excludes soft-deleted logs', async () => {
    const calls: { params: unknown[]; sql: string }[] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ params, sql });
        return sql.includes('SELECT gm.id') ? { id: 'member-a' } : row();
      }),
    };
    const result = await new SQLiteRecoveryRepository(async () => db as never).getDailyLog({
      date: '2026-07-15',
      memberId: 'member-a',
      ownerUserId: 'account-a',
    });

    expect(result).toMatchObject({ fatigueScore: 2, id: 'recovery_a', memberId: 'member-a' });
    expect(calls[1]?.sql).toContain('rl.deleted_at IS NULL');
    expect(calls[1]?.sql).toContain('groups.owner_user_id = ?');
    expect(calls[1]?.params).toEqual(['account-a', 'member-a', '2026-07-15', 'account-a']);
  });

  it('rejects a member outside the current account group instead of cross-group fallback', async () => {
    const db = { getFirstAsync: jest.fn(async () => null) };
    await expect(
      new SQLiteRecoveryRepository(async () => db as never).getDailyLog({
        date: '2026-07-15',
        memberId: 'member-from-other-group',
        ownerUserId: 'account-a',
      }),
    ).rejects.toThrow('Member not visible for current account');
  });

  it('upserts one deterministic daily record and enqueues it after the local transaction', async () => {
    let transactionFinished = false;
    const txn = {
      getFirstAsync: jest.fn(async () => null),
      runAsync: jest.fn(async () => undefined),
    };
    const db = {
      getFirstAsync: jest.fn(async () => ({ id: 'member-a' })),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof txn) => Promise<void>) => {
        await callback(txn);
        transactionFinished = true;
      }),
    };
    mockEnqueue.mockImplementationOnce(async () => {
      expect(transactionFinished).toBe(true);
    });

    const saved = await new SQLiteRecoveryRepository(async () => db as never).upsertDailyLog(input);

    expect(saved.id).toBe('recovery_account-a_member-a_2026-07-15');
    expect(String((txn.runAsync.mock.calls as unknown[][])[0]?.[0])).toContain('ON CONFLICT(id) DO UPDATE');
    expect(mockEnqueue).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: 'recoveryLogs',
        localId: saved.id,
        operation: 'create',
        ownerUserId: 'account-a',
      }),
    );
  });

  it('edits an existing daily row without generating a second id', async () => {
    const txn = {
      getFirstAsync: jest.fn(async () => row({ id: 'existing_daily' })),
      runAsync: jest.fn(async () => undefined),
    };
    const db = {
      getFirstAsync: jest.fn(async () => ({ id: 'member-a' })),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof txn) => Promise<void>) => callback(txn)),
    };

    const saved = await new SQLiteRecoveryRepository(async () => db as never).upsertDailyLog({
      ...input,
      fatigueScore: 4,
      recommendation: 'reduce_weight',
      totalScore: 20,
    });

    expect(saved.id).toBe('existing_daily');
    expect(mockEnqueue).toHaveBeenLastCalledWith(
      expect.objectContaining({ localId: 'existing_daily', operation: 'update' }),
    );
  });

  it('keeps different member daily records independent', async () => {
    const txn = {
      getFirstAsync: jest.fn(async () => null),
      runAsync: jest.fn(async () => undefined),
    };
    const db = {
      getFirstAsync: jest.fn(async (_sql: string, memberId: string) => ({ id: memberId })),
      withExclusiveTransactionAsync: jest.fn(async (callback: (value: typeof txn) => Promise<void>) => callback(txn)),
    };
    const repository = new SQLiteRecoveryRepository(async () => db as never);

    const memberA = await repository.upsertDailyLog(input);
    const memberB = await repository.upsertDailyLog({ ...input, memberId: 'member-b' });

    expect(memberA.id).toBe('recovery_account-a_member-a_2026-07-15');
    expect(memberB.id).toBe('recovery_account-a_member-b_2026-07-15');
    expect(memberA.id).not.toBe(memberB.id);
  });

  it('returns real-date history and detects a three-entry low trend', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ id: 'member-a' })),
      getAllAsync: jest.fn(async () => [
        row({ date: '2026-07-15', id: 'r3', recommendation: 'reduce_weight', total_score: 16 }),
        row({ date: '2026-07-13', id: 'r2', recommendation: 'only_a', total_score: 14 }),
        row({ date: '2026-07-10', id: 'r1', recommendation: 'rest', total_score: 10 }),
      ]),
    };

    const trend = await new SQLiteRecoveryRepository(async () => db as never)
      .getRecentAssessmentTrend({ memberId: 'member-a', ownerUserId: 'account-a' });

    expect(trend.logs.map((log) => log.date)).toEqual(['2026-07-15', '2026-07-13', '2026-07-10']);
    expect(trend).toMatchObject({ averageScore: 13.3, hasConsecutiveLowStatus: true, lowCount: 3 });
    expect(String((db.getAllAsync.mock.calls as unknown[][])[0]?.[0])).toContain('ORDER BY rl.date DESC');
    expect((db.getAllAsync.mock.calls as unknown[][])[0]?.at(-1)).toBe(10);
  });
});
