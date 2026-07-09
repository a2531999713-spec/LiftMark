import { describe, expect, it, jest } from '@jest/globals';

import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import {
  activateTrainingPlanForGroup,
  ensureTrainingGroupMainline,
} from '@/services/trainingMainlineService';

jest.mock('@/data/local', () => ({
  initializeLocalDatabase: jest.fn(async () => undefined),
}));

jest.mock('@/data/local/accountScope', () => ({
  getRequiredCurrentUserId: jest.fn(async () => 'usr_test'),
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
  });
});
