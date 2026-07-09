import { describe, expect, it } from '@jest/globals';

import type { PlanTemplate } from '@/domain/plan/plan.types';
import { resolveHomeStatus } from '@/domain/home/home-status';

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

const baseInput = {
  authStatus: 'authenticated' as const,
  groupsCount: 1,
  membersCount: 1,
  rawActivePlan: plan(),
  activePlan: plan(),
  todayPlanExists: true,
  isRestState: false,
  hasError: false,
};

describe('resolveHomeStatus', () => {
  it('returns error when hasError is true regardless of other inputs', () => {
    expect(
      resolveHomeStatus({ ...baseInput, hasError: true, groupsCount: 0, activePlan: null }),
    ).toBe('error');
  });

  it('returns noAccount when authStatus is unauthenticated', () => {
    expect(
      resolveHomeStatus({ ...baseInput, authStatus: 'unauthenticated', groupsCount: 0 }),
    ).toBe('noAccount');
  });

  // 测试 8：无 group 时首页状态是 noGroup
  it('returns noGroup when there are no visible groups', () => {
    expect(
      resolveHomeStatus({ ...baseInput, groupsCount: 0, activePlan: null, rawActivePlan: null }),
    ).toBe('noGroup');
  });

  // 测试 9：有 group 无 active plan 时首页状态是 noActivePlan
  it('returns noActivePlan when group exists but no active plan is set', () => {
    expect(
      resolveHomeStatus({
        ...baseInput,
        groupsCount: 1,
        rawActivePlan: null,
        activePlan: null,
      }),
    ).toBe('noActivePlan');
  });

  it('returns noActivePlan when rawActivePlan is a draft user plan (not yet activated)', () => {
    expect(
      resolveHomeStatus({
        ...baseInput,
        rawActivePlan: plan({ status: 'draft' }),
        activePlan: null,
      }),
    ).toBe('noActivePlan');
  });

  // 测试 7：completed / archived / abandoned plan 不进入首页今日训练
  it('returns planCompleted when the raw active plan is completed', () => {
    expect(
      resolveHomeStatus({
        ...baseInput,
        rawActivePlan: plan({ status: 'completed' }),
        activePlan: null,
      }),
    ).toBe('planCompleted');
  });

  it('returns planArchived when the raw active plan is archived', () => {
    expect(
      resolveHomeStatus({
        ...baseInput,
        rawActivePlan: plan({ status: 'archived' }),
        activePlan: null,
      }),
    ).toBe('planArchived');
  });

  it('returns planAbandoned when the raw active plan is abandoned', () => {
    expect(
      resolveHomeStatus({
        ...baseInput,
        rawActivePlan: plan({ status: 'abandoned' }),
        activePlan: null,
      }),
    ).toBe('planAbandoned');
  });

  it('still treats a completed system plan as trainable (system plans bypass status filter)', () => {
    // 系统方案不参与 completed/archived/abandoned 判定，与 today.tsx isTrainablePlan 一致。
    expect(
      resolveHomeStatus({
        ...baseInput,
        rawActivePlan: plan({ status: 'completed', source: 'system', visibility: 'system' }),
        activePlan: plan({ source: 'system', visibility: 'system' }),
      }),
    ).toBe('ready');
  });

  it('returns noMember when active plan exists but no members', () => {
    expect(
      resolveHomeStatus({ ...baseInput, membersCount: 0 }),
    ).toBe('noMember');
  });

  it('returns restDay when isRestState is true', () => {
    expect(
      resolveHomeStatus({ ...baseInput, isRestState: true, todayPlanExists: false }),
    ).toBe('restDay');
  });

  it('returns planNotReady when active plan + members exist but today plan failed to resolve', () => {
    expect(
      resolveHomeStatus({ ...baseInput, todayPlanExists: false }),
    ).toBe('planNotReady');
  });

  // 测试 10：有 active plan 且有今日训练时首页状态是 ready
  it('returns ready when active plan, members, and today plan are all present', () => {
    expect(resolveHomeStatus({ ...baseInput })).toBe('ready');
  });

  it('does not return ready when authStatus is checking even if data is present', () => {
    // checking 状态不等于 unauthenticated，因此不会归为 noAccount；
    // 但数据齐备时应返回 ready，确保登录中也能看到今日训练。
    expect(resolveHomeStatus({ ...baseInput, authStatus: 'checking' })).toBe('ready');
  });
});
