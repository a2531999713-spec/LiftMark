import { describe, expect, it, jest } from '@jest/globals';

import { SQLiteHistoryRepository } from '@/data/local/repositories/historyRepository';

jest.mock('@/data/local/accountScope', () => ({
  getGroupAccountScope: jest.fn(() => ({ params: ['account-a'], where: 'groups.owner_user_id = ?' })),
  getRequiredCurrentUserId: jest.fn(async () => 'account-a'),
}));

const historyRow = {
  completed_sets: 3,
  cycle_name: '周期 1',
  cycle_status: 'archived',
  date: '2026-07-11',
  duration_seconds: 3600,
  exercise_count: 1,
  has_manual_marker: 0,
  has_report: 1,
  id: 'session-a',
  main_exercise_names: '杠铃卧推',
  owner_user_id: 'account-a',
  participant_names: '成员甲,成员乙',
  plan_cycle_id: 'cycle-a',
  plan_id: 'plan-a',
  plan_name: '力量计划',
  title: '上肢力量',
  total_reps: 15,
  total_volume: 1200,
  week: 2,
  weekday: 3,
};

function createRepository() {
  const calls: { params: unknown[]; sql: string }[] = [];
  const db = {
    getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
      calls.push({ params, sql });
      return [historyRow];
    }),
  };
  return { calls, repository: new SQLiteHistoryRepository(async () => db as never) };
}

describe('SQLiteHistoryRepository', () => {
  it('returns one aggregate row per session with account and group scope', async () => {
    const { calls, repository } = createRepository();
    const result = await repository.listHistoryItems({
      filter: { kind: 'all' },
      fromDate: '2026-07-01',
      groupId: 'group-a',
      toDate: '2026-07-31',
    });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'session-a', ownerUserId: 'account-a', participantNames: ['成员甲', '成员乙'] });
    expect(calls[0]?.sql).toContain('ws.owner_user_id = ?');
    expect(calls[0]?.sql).toContain('ws.group_id = ?');
    expect(calls[0]?.sql).toContain('ws.deleted_at IS NULL');
    expect(calls[0]?.sql).not.toContain('SELECT ws.*');
  });

  it('adds a plan-cycle predicate without loading session details', async () => {
    const { calls, repository } = createRepository();
    await repository.listHistoryItems({
      filter: { kind: 'cycle', planCycleId: 'cycle-a' },
      fromDate: '2026-07-01',
      groupId: 'group-a',
      toDate: '2026-07-31',
    });
    expect(calls[0]?.sql).toContain('ws.plan_cycle_id = ?');
    expect(calls[0]?.params).toContain('cycle-a');
  });

  it('keeps free training and manual history as distinct filters', async () => {
    const free = createRepository();
    await free.repository.listHistoryItems({ filter: { kind: 'free' }, fromDate: '2026-07-01', groupId: 'group-a', toDate: '2026-07-31' });
    expect(free.calls[0]?.sql).toContain('ws.plan_id = ?');
    expect(free.calls[0]?.sql).toContain('NOT EXISTS');

    const manual = createRepository();
    await manual.repository.listHistoryItems({ filter: { kind: 'manual' }, fromDate: '2026-07-01', groupId: 'group-a', toDate: '2026-07-31' });
    expect(manual.calls[0]?.sql).toContain("manual_record.notes LIKE '%历史补录%'");
  });

  it('returns an empty current-cycle result when no scoped active cycle exists', async () => {
    const { calls, repository } = createRepository();
    const result = await repository.listHistoryItems({
      currentPlanCycleId: null,
      filter: { kind: 'current_cycle' },
      fromDate: '2026-07-01',
      groupId: 'group-a',
      toDate: '2026-07-31',
    });
    expect(result.items).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('keeps archived cycles available in the scoped history cycle picker', async () => {
    const db = {
      getAllAsync: jest.fn(async (_sql: string, ..._params: unknown[]) => [{
        cycle_id: 'cycle-archived',
        cycle_name: '周期 1',
        end_date: '2026-07-28',
        plan_name: '力量计划',
        session_count: 4,
        start_date: '2026-07-01',
        status: 'archived',
      }]),
    };
    const repository = new SQLiteHistoryRepository(async () => db as never);
    const cycles = await repository.listHistoryCycleOptions('group-a');
    expect(cycles).toEqual([expect.objectContaining({ cycleId: 'cycle-archived', status: 'archived' })]);
    expect(db.getAllAsync.mock.calls[0]?.[0]).toContain('pc.owner_user_id = ?');
    expect(db.getAllAsync.mock.calls[0]?.[0]).toContain('pc.group_id = ?');
  });
});
