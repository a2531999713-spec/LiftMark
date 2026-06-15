import { describe, expect, it, jest } from '@jest/globals';

import { SQLitePlanRepository } from '@/data/local/repositories/planRepository';
import type { PlanTemplate } from '@/domain/plan/plan.types';

jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_test`,
}));

function createPlan(patch: Partial<PlanTemplate> = {}): PlanTemplate {
  return {
    id: 'plan_user_1',
    name: '我的计划',
    visibility: 'private',
    goal: 'strength',
    durationWeeks: 8,
    frequencyPerWeek: 4,
    source: 'blank_created',
    version: 1,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...patch,
  };
}

class TestPlanRepository extends SQLitePlanRepository {
  constructor(
    private readonly plan: PlanTemplate | null,
    private readonly userPlans: PlanTemplate[],
    private readonly dbMock: unknown,
  ) {
    super(async () => dbMock as never);
  }

  override async getPlanById() {
    return this.plan;
  }

  override async listUserPlans() {
    return this.userPlans;
  }
}

describe('SQLitePlanRepository.deleteUserPlan', () => {
  it('rejects deleting system plans and active plans', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => null),
    };

    await expect(
      new TestPlanRepository(createPlan({ source: 'system', visibility: 'system' }), [createPlan()], db).deleteUserPlan('plan_system'),
    ).rejects.toThrow('系统方案');

    await expect(
      new TestPlanRepository(createPlan(), [createPlan(), createPlan({ id: 'plan_user_2' })], {
        getFirstAsync: jest.fn(async () => ({ id: 'group_1' })),
      }).deleteUserPlan('plan_user_1'),
    ).rejects.toThrow('当前训练计划不能删除');
  });

  it('deletes only plan tables and keeps workout tables untouched', async () => {
    const executedSql: string[] = [];
    const transaction = {
      getAllAsync: jest.fn(async () => [{ id: 'day_1' }, { id: 'day_2' }]),
      runAsync: jest.fn(async (sql: string) => {
        executedSql.push(sql);
      }),
    };
    const db = {
      getFirstAsync: jest.fn(async () => null),
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    await new TestPlanRepository(createPlan(), [createPlan(), createPlan({ id: 'plan_user_2' })], db).deleteUserPlan('plan_user_1');

    expect(executedSql.join('\n')).toContain('DELETE FROM plan_exercises');
    expect(executedSql.join('\n')).toContain('DELETE FROM plan_templates');
    expect(executedSql.join('\n')).not.toContain('workout_sessions');
    expect(executedSql.join('\n')).not.toContain('workout_sets');
  });
});
