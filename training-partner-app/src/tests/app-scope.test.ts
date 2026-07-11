import { describe, expect, it, jest } from '@jest/globals';
import { createEmptyAppScope, isSessionVisibleInScope } from '@/application/scope/AppScope';
import {
  resetAccountSwitchRuntimeForTests,
  switchApplicationAccountScope,
} from '@/application/scope/accountSwitch.service';
import { useWorkoutDraftStore } from '@/store/workoutDraftStore';

jest.mock('@/store/syncStore', () => ({
  useSyncStore: {
    getState: () => ({ resetRuntime: jest.fn() }),
  },
}));

describe('AppScope', () => {
  it('starts with no cross-account group, member, plan, or cursor context', () => {
    expect(createEmptyAppScope('account-b')).toEqual({
      userId: 'account-b',
      groupId: null,
      memberId: null,
      activePlanId: null,
      activePlanCycleId: null,
    });
  });

  it('rejects sessions from another account or group', () => {
    const scope = {
      userId: 'account-a',
      groupId: 'group-a',
      memberId: 'member-a',
      activePlanId: 'plan-a',
      activePlanCycleId: 'cycle-a',
    };
    expect(isSessionVisibleInScope(scope, { groupId: 'group-a', ownerUserId: 'account-a', planId: 'plan-a' })).toBe(true);
    expect(isSessionVisibleInScope(scope, { groupId: 'group-a', ownerUserId: 'account-b' })).toBe(false);
    expect(isSessionVisibleInScope(scope, { groupId: 'group-b', ownerUserId: 'account-a' })).toBe(false);
  });

  it('clears workout runtime only when the account actually changes', () => {
    resetAccountSwitchRuntimeForTests();
    switchApplicationAccountScope('account-a');
    useWorkoutDraftStore.getState().setActiveSessionId('session-a');

    switchApplicationAccountScope('account-a');
    expect(useWorkoutDraftStore.getState().activeSessionId).toBe('session-a');

    switchApplicationAccountScope('account-b');
    expect(useWorkoutDraftStore.getState().activeSessionId).toBeUndefined();
  });
});
