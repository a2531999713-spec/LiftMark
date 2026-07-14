import { describe, expect, it, jest } from '@jest/globals';

import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';
import {
  activateTrainingPlanForGroup,
  createTrainingGroupMainline,
  ensureTrainingGroupMainline,
} from '@/services/trainingMainlineService';

jest.mock('@/data/local', () => ({
  initializeLocalDatabase: jest.fn(async () => undefined),
}));

jest.mock('@/data/local/accountScope', () => ({
  getRequiredCurrentUserId: jest.fn(async () => 'usr_test'),
}));

// 兼容服务引入了 ids / db / syncQueue，需 mock 以避免 nanoid ESM 解析与真实 DB 访问
jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_test`,
}));

jest.mock('@/data/local/db', () => ({
  getDatabase: jest.fn(async () => ({
    getAllAsync: jest.fn(async () => []),
    runAsync: jest.fn(async () => undefined),
  })),
}));

jest.mock('@/sync/syncQueue', () => ({
  enqueueSyncCandidate: jest.fn(async () => undefined),
}));

function group(patch: Partial<Group> = {}): Group {
  return {
    activePlanId: '',
    createdAt: '2026-07-09T00:00:00.000Z',
    currentPhaseType: 'strength',
    currentWeek: 1,
    fridayEnabled: false,
    fridayStrategy: 'default_rest',
    id: 'group_test',
    name: '我的训练小组',
    ownerUserId: 'usr_test',
    updatedAt: '2026-07-09T00:00:00.000Z',
    ...patch,
  };
}

function member(patch: Partial<GroupMember> = {}): GroupMember {
  return {
    createdAt: '2026-07-09T00:00:00.000Z',
    displayName: 'Test User',
    groupId: 'group_test',
    id: 'member_test',
    memberType: 'real',
    role: 'owner',
    updatedAt: '2026-07-09T00:00:00.000Z',
    userId: 'usr_test',
    ...patch,
  };
}

function plan(patch: Partial<PlanTemplate> = {}): PlanTemplate {
  return {
    createdAt: '2026-07-09T00:00:00.000Z',
    durationWeeks: 8,
    frequencyPerWeek: 3,
    goal: 'strength',
    id: 'plan_test',
    name: 'Strength Plan',
    source: 'system_copy',
    status: 'active',
    updatedAt: '2026-07-09T00:00:00.000Z',
    version: 1,
    visibility: 'private',
    ...patch,
  };
}

describe('training mainline service', () => {
  it('creates a visible group with an owner member for an empty account', async () => {
    const createdGroup = group();
    const createdMember = member();
    const repositories = {
      groupRepository: {
        createGroup: jest.fn(async () => createdGroup),
        listGroups: jest.fn(async () => []),
        updateGroup: jest.fn(),
      },
      memberRepository: {
        createMember: jest.fn(async () => createdMember),
        listMembers: jest.fn(async () => []),
        updateMember: jest.fn(),
      },
    } as never;

    const result = await ensureTrainingGroupMainline(repositories, {
      displayName: 'Test User',
      selectedGroupId: null,
      userId: 'usr_test',
    });

    expect(result.createdGroup).toBe(true);
    expect(result.group.id).toBe('group_test');
    expect(result.member.userId).toBe('usr_test');
    expect(result.member.role).toBe('owner');
    expect((repositories as any).groupRepository.createGroup).toHaveBeenCalledWith(expect.objectContaining({
      currentPhaseType: 'strength',
      currentWeek: 1,
      name: '我的训练小组',
    }));
    expect((repositories as any).memberRepository.createMember).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'group_test',
      memberType: 'real',
      role: 'owner',
      userId: 'usr_test',
    }));
  });

  it('activates a plan on the group using the first week phase', async () => {
    const currentGroup = group();
    const activePlan = plan();
    const updatedGroup = group({ activePlanId: activePlan.id, currentPhaseType: 'hypertrophy' });
    const repositories = {
      groupRepository: {
        updateGroup: jest.fn(async () => updatedGroup),
      },
      planRepository: {
        ensureActivePlanCycle: jest.fn(async () => ({ id: 'cycle_test' })),
        listPlanPhases: jest.fn(async () => [
          {
            endWeek: 8,
            id: 'phase_test',
            name: 'Hypertrophy',
            orderIndex: 1,
            planId: activePlan.id,
            startWeek: 1,
            type: 'hypertrophy',
          },
        ]),
      },
    } as never;

    const result = await activateTrainingPlanForGroup(repositories, {
      group: currentGroup,
      plan: activePlan,
    });

    expect(result.group.activePlanId).toBe('plan_test');
    expect(result.phaseType).toBe('hypertrophy');
    expect((repositories as any).groupRepository.updateGroup).toHaveBeenCalledWith('group_test', expect.objectContaining({
      activePlanId: 'plan_test',
      currentPhaseType: 'hypertrophy',
      currentWeek: 1,
    }));
    expect((repositories as any).planRepository.ensureActivePlanCycle).toHaveBeenCalledWith({
      groupId: 'group_test',
      plan: activePlan,
    });
  });

  // 测试 1：无账号时 createTrainingGroupMainline 抛出 no account，不写匿名 group
  it('throws and does not create any group when no account session exists', async () => {
    jest.mocked(getRequiredCurrentUserId).mockRejectedValueOnce(new Error('NO_ACCOUNT_ERROR_MESSAGE'));

    const createGroup = jest.fn(async () => group());
    const createMember = jest.fn(async () => member());
    const repositories = {
      groupRepository: { createGroup, listGroups: jest.fn(async () => []), updateGroup: jest.fn() },
      memberRepository: { createMember, listMembers: jest.fn(async () => []), updateMember: jest.fn() },
    } as never;

    await expect(createTrainingGroupMainline(repositories, {})).rejects.toThrow('NO_ACCOUNT_ERROR_MESSAGE');
    expect(createGroup).not.toHaveBeenCalled();
    expect(createMember).not.toHaveBeenCalled();
  });

  // 测试 2：有账号时 createTrainingGroupMainline 创建 group + owner member（memberRepository.createMember
  // 在真实实现里会同一事务写入 group_members 与 member_profiles）
  it('creates a group and an owner member with real memberType when account is present', async () => {
    jest.mocked(getRequiredCurrentUserId).mockResolvedValueOnce('usr_test');
    const createdGroup = group();
    const createdMember = member();
    const createGroup = jest.fn(async () => createdGroup);
    const createMember = jest.fn(async () => createdMember);
    const repositories = {
      groupRepository: { createGroup, listGroups: jest.fn(async () => []), updateGroup: jest.fn() },
      memberRepository: { createMember, listMembers: jest.fn(async () => []), updateMember: jest.fn() },
    } as never;

    const result = await createTrainingGroupMainline(repositories, { userId: 'usr_test' });

    expect(result.createdGroup).toBe(true);
    expect(result.createdMember).toBe(true);
    expect(result.group.id).toBe('group_test');
    expect(result.member.role).toBe('owner');
    expect(result.member.memberType).toBe('real');
    expect(result.member.userId).toBe('usr_test');
    expect(createGroup).toHaveBeenCalledWith(expect.objectContaining({
      currentWeek: 1,
      currentPhaseType: 'strength',
      name: '我的训练小组',
    }));
    expect(createMember).toHaveBeenCalledWith(expect.objectContaining({
      groupId: 'group_test',
      memberType: 'real',
      role: 'owner',
      userId: 'usr_test',
    }));
  });

  // 测试 5/6：activateTrainingPlanForGroup 应将 group.activePlanId 指向传入的 userPlan，
  // 并重置 currentWeek=1、设置 currentPhaseType
  it('activates an imported/copied user plan by pointing group.activePlanId at it', async () => {
    const currentGroup = group({ activePlanId: '' });
    const importedPlan = plan({ id: 'plan_imported', source: 'imported', status: 'active' });
    const updatedGroup = group({ activePlanId: 'plan_imported', currentPhaseType: 'strength' });
    const repositories = {
      groupRepository: { updateGroup: jest.fn(async () => updatedGroup) },
      planRepository: {
        ensureActivePlanCycle: jest.fn(async () => ({ id: 'cycle_imported' })),
        listPlanPhases: jest.fn(async () => [
          { endWeek: 8, id: 'phase_test', name: 'Strength', orderIndex: 1, planId: 'plan_imported', startWeek: 1, type: 'strength' },
        ]),
      },
    } as never;

    const result = await activateTrainingPlanForGroup(repositories, {
      group: currentGroup,
      plan: importedPlan,
    });

    expect(result.group.activePlanId).toBe('plan_imported');
    expect(result.phaseType).toBe('strength');
    expect((repositories as any).groupRepository.updateGroup).toHaveBeenCalledWith('group_test', expect.objectContaining({
      activePlanId: 'plan_imported',
      currentWeek: 1,
      currentPhaseType: 'strength',
    }));
  });
});
