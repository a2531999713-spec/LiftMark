import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Group } from '@/domain/group/group.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { ensurePlanStructureCompatibleForGroup } from '@/services/planStructureCompatibilityService';

jest.mock('@/data/local', () => ({
  initializeLocalDatabase: jest.fn(async () => undefined),
}));

jest.mock('@/data/local/db', () => ({
  getDatabase: jest.fn(async () => mockDb),
}));

jest.mock('@/data/local/accountScope', () => ({
  getRequiredCurrentUserId: jest.fn(async () => 'usr_test'),
}));

jest.mock('@/sync/syncQueue', () => ({
  enqueueSyncCandidate: jest.fn(async () => undefined),
}));

// createId 走 nanoid/non-secure（ESM），Jest 默认无法解析，需 mock
jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_test`,
}));

function group(patch: Partial<Group> = {}): Group {
  return {
    id: 'group_test',
    name: '我的训练小组',
    ownerUserId: 'usr_test',
    activePlanId: 'plan_test',
    currentPhaseType: 'strength',
    currentWeek: 1,
    fridayEnabled: false,
    fridayStrategy: 'default_rest',
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
    ...patch,
  };
}

function plan(patch: Partial<PlanTemplate> = {}): PlanTemplate {
  return {
    id: 'plan_test',
    name: 'Strength Plan',
    visibility: 'private',
    goal: 'strength',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    source: 'system_copy',
    status: 'active',
    version: 1,
    createdAt: '2026-07-09T00:00:00.000Z',
    updatedAt: '2026-07-09T00:00:00.000Z',
    ...patch,
  };
}

// 模拟数据库：phases 和 days 存储在内存数组中，runAsync/getAllAsync 操作这些数组
type PhaseRow = {
  id: string;
  owner_user_id: string | null;
  plan_id: string;
  name: string;
  type: string;
  start_week: number;
  end_week: number;
  order_index: number;
};

type DayRow = {
  id: string;
  owner_user_id: string | null;
  plan_id: string;
  phase_id: string | null;
  week: number;
  weekday: number;
  title: string;
  focus: string;
  notes: string | null;
};

let phaseRows: PhaseRow[];
let dayRows: DayRow[];

const mockDb = {
  getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('FROM plan_phases')) {
      return phaseRows.filter((row) => row.plan_id === params[0]);
    }
    if (sql.includes('FROM plan_days')) {
      return dayRows.filter((row) => row.plan_id === params[0]);
    }
    return [];
  }),
  runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
    if (sql.includes('INSERT INTO plan_phases')) {
      phaseRows.push({
        id: params[0] as string,
        owner_user_id: params[1] as string | null,
        plan_id: params[2] as string,
        name: params[3] as string,
        type: params[4] as string,
        start_week: params[5] as number,
        end_week: params[6] as number,
        order_index: params[7] as number,
      });
      return undefined;
    }
    if (sql.includes('UPDATE plan_days SET phase_id')) {
      const dayId = params[1] as string;
      const phaseId = params[0] as string;
      const day = dayRows.find((row) => row.id === dayId);
      if (day) day.phase_id = phaseId;
      return undefined;
    }
    if (sql.includes('UPDATE plan_phases SET end_week')) {
      const phaseId = params[1] as string;
      const newEndWeek = params[0] as number;
      const phase = phaseRows.find((row) => row.id === phaseId);
      if (phase) phase.end_week = newEndWeek;
      return undefined;
    }
    return undefined;
  }),
};

function makeRepositories(updatedGroup?: Group) {
  return {
    groupRepository: {
      updateGroup: jest.fn(async (_id: string, patch: Partial<Group>) => ({
        ...group(),
        ...updatedGroup,
        ...patch,
        id: 'group_test',
        updatedAt: '2026-07-09T00:00:00.000Z',
      })),
    },
  } as never;
}

function resetRows() {
  phaseRows = [];
  dayRows = [];
}

describe('ensurePlanStructureCompatibleForGroup', () => {
  beforeEach(() => {
    resetRows();
    jest.clearAllMocks();
  });

  // 测试 1：plan_phases 为空但 plan_days 有 week → 自动创建默认 phase
  it('creates a default phase when plan_phases is empty but plan_days exist', async () => {
    dayRows = [
      { id: 'day_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: null, week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
      { id: 'day_2', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: null, week: 3, weekday: 2, title: 'D2', focus: 'squat', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan(),
    });

    expect(result.repaired).toBe(true);
    expect(phaseRows).toHaveLength(1);
    expect(phaseRows[0].start_week).toBe(1);
    expect(phaseRows[0].end_week).toBe(3);
    expect(phaseRows[0].type).toBe('strength');
    // 修复后 plan_days.phase_id 应被回填
    expect(dayRows.every((day) => day.phase_id === phaseRows[0].id)).toBe(true);
    expect(result.repairedItems.some((item) => item.includes('created default phase'))).toBe(true);
  });

  // 测试 2：group.currentWeek 超出 phase 范围 → 自动 clamp
  it('clamps group.currentWeek when it exceeds phase range', async () => {
    phaseRows = [
      { id: 'phase_1', owner_user_id: 'usr_test', plan_id: 'plan_test', name: '增力', type: 'strength', start_week: 1, end_week: 4, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_1', week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentWeek: 99 }),
      plan: plan(),
    });

    expect(result.repaired).toBe(true);
    expect(result.group.currentWeek).toBe(4);
    expect(result.repairedItems.some((item) => item.includes('clamped group.currentWeek'))).toBe(true);
  });

  // 测试 3：group.currentPhaseType 与 phase.type 不一致 → 自动修正
  it('updates group.currentPhaseType when it does not match any phase', async () => {
    phaseRows = [
      { id: 'phase_1', owner_user_id: 'usr_test', plan_id: 'plan_test', name: '增肌', type: 'hypertrophy', start_week: 1, end_week: 8, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_1', week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan(),
    });

    expect(result.repaired).toBe(true);
    expect(result.group.currentPhaseType).toBe('hypertrophy');
    expect(result.repairedItems.some((item) => item.includes('updated group.currentPhaseType'))).toBe(true);
  });

  // 测试 4 & 5：plan_days.phase_id 为空或指向不存在 phase → 按 week 回填
  it('backfills phase_id when it is null or dangles', async () => {
    phaseRows = [
      { id: 'phase_1', owner_user_id: 'usr_test', plan_id: 'plan_test', name: '增力', type: 'strength', start_week: 1, end_week: 4, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: null, week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
      { id: 'day_2', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_missing', week: 2, weekday: 1, title: 'D2', focus: 'squat', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan(),
    });

    expect(result.repaired).toBe(true);
    expect(dayRows.every((day) => day.phase_id === 'phase_1')).toBe(true);
    expect(result.repairedItems.some((item) => item.includes('backfilled phase_id'))).toBe(true);
  });

  // 测试：plan_days.week 超出现有 phase 范围 → 扩展 phase endWeek
  it('extends phase endWeek when plan_days exceed phase range', async () => {
    phaseRows = [
      { id: 'phase_1', owner_user_id: 'usr_test', plan_id: 'plan_test', name: '增力', type: 'strength', start_week: 1, end_week: 4, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_1', week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
      { id: 'day_2', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_1', week: 8, weekday: 1, title: 'D2', focus: 'squat', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan(),
    });

    expect(result.repaired).toBe(true);
    expect(phaseRows[0].end_week).toBe(8);
    expect(result.repairedItems.some((item) => item.includes('extended phase'))).toBe(true);
  });

  // 测试：计划结构正常 → 不做修复
  it('does not repair when plan structure is already compatible', async () => {
    phaseRows = [
      { id: 'phase_1', owner_user_id: 'usr_test', plan_id: 'plan_test', name: '增力', type: 'strength', start_week: 1, end_week: 8, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_1', week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan(),
    });

    expect(result.repaired).toBe(false);
    expect(result.repairedItems).toHaveLength(0);
    expect(result.group.currentWeek).toBe(1);
    expect(result.group.currentPhaseType).toBe('strength');
  });

  // 测试 6：系统方案复制后结构完整 → 无需修复，可直接被 getTodayPlan 解析
  it('leaves a properly copied system scheme plan untouched (ready for getTodayPlan)', async () => {
    phaseRows = [
      { id: 'phase_copy', owner_user_id: 'usr_test', plan_id: 'plan_test', name: '增力阶段', type: 'strength', start_week: 1, end_week: 6, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_copy_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_copy', week: 1, weekday: 1, title: 'Day 1', focus: '卧推', notes: null },
      { id: 'day_copy_2', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_copy', week: 1, weekday: 3, title: 'Day 2', focus: '深蹲', notes: null },
      { id: 'day_copy_3', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_copy', week: 1, weekday: 5, title: 'Day 3', focus: '硬拉', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan({ source: 'system_copy' }),
    });

    expect(result.repaired).toBe(false);
    expect(result.group.currentWeek).toBe(1);
    expect(result.group.currentPhaseType).toBe('strength');
    // 结构完整，phase/day 一一对应，可被 getTodayPlan 直接解析
    expect(phaseRows).toHaveLength(1);
    expect(dayRows.every((day) => day.phase_id === 'phase_copy')).toBe(true);
  });

  // 测试 7：导入计划后结构完整 → 无需修复，可直接被 getTodayPlan 解析
  it('leaves a properly imported plan untouched (ready for getTodayPlan)', async () => {
    phaseRows = [
      { id: 'phase_import', owner_user_id: 'usr_test', plan_id: 'plan_test', name: 'Base', type: 'hypertrophy', start_week: 1, end_week: 8, order_index: 1 },
    ];
    dayRows = [
      { id: 'day_import_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_import', week: 1, weekday: 2, title: 'Push', focus: '胸', notes: null },
      { id: 'day_import_2', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_import', week: 1, weekday: 4, title: 'Pull', focus: '背', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'hypertrophy', currentWeek: 1 }),
      plan: plan({ source: 'imported', goal: 'hypertrophy' }),
    });

    expect(result.repaired).toBe(false);
    expect(result.group.currentPhaseType).toBe('hypertrophy');
    expect(dayRows.every((day) => day.phase_id === 'phase_import')).toBe(true);
  });

  // 测试 8：旧结构计划（phases 缺失 + phase_id 悬空）经兼容修复后可被 getTodayPlan 解析
  it('repairs a legacy plan so its phase/day links are consistent for getTodayPlan', async () => {
    // 旧计划：无 phases，days 的 phase_id 悬空，week 跨度 1-4
    dayRows = [
      { id: 'day_legacy_1', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: 'phase_old_missing', week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
      { id: 'day_legacy_2', owner_user_id: 'usr_test', plan_id: 'plan_test', phase_id: null, week: 4, weekday: 3, title: 'D2', focus: 'squat', notes: null },
    ];

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan({ source: 'blank_created', goal: 'strength' }),
    });

    expect(result.repaired).toBe(true);
    // 修复后：存在一个覆盖 1-4 周的 phase，所有 day 的 phase_id 都指向它
    expect(phaseRows).toHaveLength(1);
    const repairedPhase = phaseRows[0];
    expect(repairedPhase.start_week).toBe(1);
    expect(repairedPhase.end_week).toBe(4);
    expect(dayRows.every((day) => day.phase_id === repairedPhase.id)).toBe(true);
    // group.currentWeek=1 在覆盖范围内，无需 clamp
    expect(result.group.currentWeek).toBe(1);
    expect(result.group.currentPhaseType).toBe('strength');
  });

  // 测试 10：176 旧 active plan 场景 — 只做本地结构修复，不删除任何数据
  it('non-destructively repairs 176 legacy active plan without deleting rows', async () => {
    // 模拟 176 主号旧数据：phases 缺失，days 存在但 phase_id 悬空
    dayRows = [
      { id: 'day_176_1', owner_user_id: 'usr_176', plan_id: 'plan_176', phase_id: null, week: 1, weekday: 1, title: 'D1', focus: 'bench', notes: null },
      { id: 'day_176_2', owner_user_id: 'usr_176', plan_id: 'plan_176', phase_id: 'phase_gone', week: 2, weekday: 3, title: 'D2', focus: 'squat', notes: null },
    ];

    const deleteCalls: string[] = [];
    const originalRunAsync = mockDb.runAsync.getMockImplementation();
    mockDb.runAsync.mockImplementation(async (sql: string, ...params: unknown[]) => {
      if (sql.includes('DELETE')) {
        deleteCalls.push(sql);
        return undefined;
      }
      return originalRunAsync?.(sql, ...params);
    });

    const result = await ensurePlanStructureCompatibleForGroup({
      repositories: makeRepositories(),
      group: group({ id: 'group_176', ownerUserId: 'usr_176', activePlanId: 'plan_176', currentPhaseType: 'strength', currentWeek: 1 }),
      plan: plan({ id: 'plan_176', source: 'system_copy' }),
    });

    expect(result.repaired).toBe(true);
    // 关键：修复过程只 INSERT/UPDATE，绝不 DELETE（保护 176 主号数据）
    expect(deleteCalls).toHaveLength(0);
    expect(phaseRows).toHaveLength(1);
    expect(dayRows).toHaveLength(2);
    expect(dayRows.every((day) => day.phase_id === phaseRows[0].id)).toBe(true);
  });
});
