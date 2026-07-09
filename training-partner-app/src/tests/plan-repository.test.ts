import { describe, expect, it, jest } from '@jest/globals';

import { SQLitePlanRepository } from '@/data/local/repositories/planRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';

jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_test`,
}));

jest.mock('@/data/local/accountScope', () => ({
  getCurrentAccountUserId: jest.fn(async () => 'usr_test'),
  getGroupAccountScope: jest.fn(() => ({ params: [], where: '1 = 1' })),
  getPlanAccountScope: jest.fn(() => ({ params: [], where: '1 = 1' })),
  getRequiredCurrentUserId: jest.fn(async () => 'usr_test'),
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

describe('SQLitePlanRepository.updateUserPlan', () => {
  it('rejects system plans and rebuilds only plan structure for editable plans', async () => {
    const transaction = {
      getAllAsync: jest.fn(async () => [{ id: 'day_1' }]),
      runAsync: jest.fn(async () => undefined),
    };
    const db = {
      getAllAsync: jest.fn(async () => []),
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    await expect(
      new TestPlanRepository(createPlan({ source: 'system', visibility: 'system' }), [createPlan()], db).updateUserPlan({
        days: [],
        durationWeeks: 8,
        frequencyPerWeek: 4,
        goal: 'strength',
        name: '系统计划',
        planId: 'plan_system',
      }),
    ).rejects.toThrow('系统方案');

    const updated = await new TestPlanRepository(createPlan(), [createPlan()], db).updateUserPlan({
      days: [
        {
          exercises: [{ exerciseId: 'exercise_bench', reps: 5, sets: 3 }],
          focus: '卧推',
          title: 'Day 1',
          week: 2,
          weekday: 3,
        },
      ],
      durationWeeks: 10,
      frequencyPerWeek: 3,
      goal: 'hypertrophy',
      name: '更新计划',
      planId: 'plan_user_1',
    });

    const sql = (transaction.runAsync.mock.calls as unknown[][]).map((call) => call[0]).join('\n');
    expect(updated.name).toBe('更新计划');
    expect(sql).toContain('DELETE FROM plan_exercises');
    expect(sql).toContain('UPDATE plan_templates');
    expect(sql).toContain('INSERT INTO plan_days');
    expect(sql).not.toContain('workout_sessions');
    expect(sql).not.toContain('workout_sets');
  });
});

describe('SQLitePlanRepository.importUserPlan', () => {
  it('remaps imported child ids when local rows already exist', async () => {
    const calls: unknown[][] = [];
    const transaction = {
      getFirstAsync: jest.fn(async (sql: string, idOrName: string) => {
        if (sql.includes('FROM plan_templates') && idOrName === 'plan_import') return { id: 'plan_import' };
        if (sql.includes('FROM plan_phases') && idOrName === 'phase_import') return { id: 'phase_import' };
        if (sql.includes('FROM plan_days') && idOrName === 'day_import') return { id: 'day_import' };
        if (sql.includes('FROM plan_exercises') && idOrName === 'pex_import') return { id: 'pex_import' };
        if (sql.includes('FROM exercises')) return { id: 'exercise_existing' };
        return null;
      }),
      runAsync: jest.fn(async (...args: unknown[]) => {
        calls.push(args);
      }),
    };
    const db = {
      getAllAsync: jest.fn(async () => []),
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };
    const repository = new SQLitePlanRepository(async () => db as never);
    const template = createPlan({
      id: 'plan_import',
      name: 'Imported Plan',
      source: 'imported',
    });
    const phases: PlanPhase[] = [{
      endWeek: 8,
      id: 'phase_import',
      name: 'Base',
      orderIndex: 1,
      planId: 'plan_import',
      startWeek: 1,
      type: 'strength',
    }];
    const days: PlanDay[] = [{
      focus: 'Push',
      id: 'day_import',
      phaseId: 'phase_import',
      planId: 'plan_import',
      title: 'Day 1',
      week: 1,
      weekday: 1,
    }];
    const exercises: Exercise[] = [{
      category: 'chest',
      createdAt: '2026-06-01T00:00:00.000Z',
      equipment: 'barbell',
      id: 'exercise_import',
      isCustom: false,
      isSystem: false,
      movementPattern: 'horizontal_push',
      name: 'Bench Press',
      primaryMuscle: 'chest',
      source: 'custom',
      targetMuscle: 'chest',
      updatedAt: '2026-06-01T00:00:00.000Z',
    } as Exercise];
    const planExercises: PlanExercise[] = [{
      exerciseId: 'exercise_import',
      id: 'pex_import',
      intensityType: 'manual',
      orderIndex: 1,
      planDayId: 'day_import',
      priority: 'A',
      referenceLift: 'bench',
      reps: 5,
      sets: 3,
    }];

    const imported = await repository.importUserPlan({
      alternatives: [],
      days,
      exercises,
      phases,
      planExercises,
      template,
    });

    expect(imported.id).toBe('plan_imported_test');
    expect(imported.status).toBe('active');

    const phaseInsert = calls.find((call) => String(call[0]).includes('INSERT INTO plan_phases'));
    const dayInsert = calls.find((call) => String(call[0]).includes('INSERT INTO plan_days'));
    const planExerciseInsert = calls.find((call) => String(call[0]).includes('INSERT INTO plan_exercises'));
    expect(phaseInsert?.[1]).toBe('phase_imported_test');
    expect(dayInsert?.[1]).toBe('day_imported_test');
    expect(dayInsert?.[4]).toBe('phase_imported_test');
    expect(planExerciseInsert?.[1]).toBe('plan_exercise_imported_test');
    expect(planExerciseInsert?.[3]).toBe('day_imported_test');
    expect(planExerciseInsert?.[4]).toBe('exercise_existing');
  });
});

describe('SQLitePlanRepository.getTodayPlan', () => {
  it('rejects completed/archived/abandoned/paused/draft user plans as not active', async () => {
    // 状态检查发生在任何 DB 查询之前，最小 db mock 即可
    const db = {
      getFirstAsync: jest.fn(async () => null),
      getAllAsync: jest.fn(async () => []),
    };
    const input = {
      groupId: 'group_1',
      planId: 'plan_user_1',
      phaseType: 'strength' as const,
      currentWeek: 1,
      weekday: 1 as const,
      fridayEnabled: false,
    };

    // 非 system 计划：completed/archived/abandoned/paused/draft 都不允许作为今日训练
    for (const status of ['completed', 'archived', 'abandoned', 'paused', 'draft'] as const) {
      await expect(
        new TestPlanRepository(
          createPlan({ status, source: 'user', visibility: 'private' }),
          [createPlan()],
          db,
        ).getTodayPlan(input),
      ).rejects.toThrow('Training plan is not active');
    }
  });

  it('throws structured plan_has_no_phases error when phases are missing', async () => {
    // active 用户计划但 plan_phases 为空 → 结构化错误前缀，供首页/兼容服务识别
    const db = {
      getFirstAsync: jest.fn(async () => null),
      getAllAsync: jest.fn(async () => []),
    };
    const input = {
      groupId: 'group_1',
      planId: 'plan_user_1',
      phaseType: 'strength' as const,
      currentWeek: 1,
      weekday: 1 as const,
      fridayEnabled: false,
    };

    await expect(
      new TestPlanRepository(createPlan({ status: 'active' }), [createPlan()], db).getTodayPlan(input),
    ).rejects.toThrow('plan_has_no_phases');
  });
});
