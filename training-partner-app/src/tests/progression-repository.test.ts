import { describe, expect, it, jest } from '@jest/globals';

import { SQLiteProgressionRepository } from '@/data/local/repositories/progressionRepository';

jest.mock('@/data/local/accountScope', () => ({
  getCurrentAccountUserId: jest.fn(async () => 'account-a'),
  getGroupAccountScope: jest.fn(() => ({ params: ['account-a', 'account-a'], where: '(groups.owner_user_id = ? OR groups.owner_user_id = ?)' })),
  getRequiredCurrentUserId: jest.fn(async () => 'account-a'),
}));

jest.mock('@/sync/syncQueue', () => ({
  enqueueSyncCandidate: jest.fn(async () => undefined),
}));

describe('SQLiteProgressionRepository scope boundaries', () => {
  it('reads the latest suggestion only through the current owner, session and group scope', async () => {
    const calls: { params: unknown[]; sql: string }[] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ params, sql });
        return {
          created_at: '2026-07-15T10:00:00.000Z', exercise_id: 'exercise-a', id: 'suggestion-a', member_id: 'member-a',
          reason: '全部计划组均达到目标次数。', session_id: 'session-a', suggested_weight: 82.5, suggestion: 'increase',
        };
      }),
    };
    const result = await new SQLiteProgressionRepository(async () => db as never).getLatestSuggestion('member-a', 'exercise-a');
    expect(result).toMatchObject({ id: 'suggestion-a', suggestedWeight: 82.5 });
    expect(calls[0]?.sql).toContain('ps.owner_user_id = ?');
    expect(calls[0]?.sql).toContain('ws.owner_user_id = ?');
    expect(calls[0]?.sql).toContain('ps.deleted_at IS NULL');
    expect(calls[0]?.params.filter((value) => value === 'account-a').length).toBeGreaterThanOrEqual(4);
  });

  it('keeps session suggestions scoped and excludes soft-deleted rows', async () => {
    const calls: { params: unknown[]; sql: string }[] = [];
    const db = {
      getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ params, sql });
        return [];
      }),
    };
    const result = await new SQLiteProgressionRepository(async () => db as never).listSuggestionsForSession('session-a');
    expect(result).toEqual([]);
    expect(calls[0]?.sql).toContain('ps.session_id = ?');
    expect(calls[0]?.sql).toContain('groups.deleted_at IS NULL');
  });
});
