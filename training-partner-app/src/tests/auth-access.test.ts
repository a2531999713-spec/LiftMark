import { describe, expect, it } from '@jest/globals';

import {
  decideFeatureAccess,
  deriveAuthMode,
  LOGOUT_LOCAL_DATA_POLICY,
} from '@/domain/auth/access-control';

describe('auth access control', () => {
  it('blocks guest preview from starting a formal workout', () => {
    const decision = decideFeatureAccess('start_workout', { authMode: 'guest_preview' });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('login_required');
      expect(decision.title).toBe('登录后开始记录训练');
    }
  });

  it('requires login before any main app feature is used', () => {
    const exploreDecision = decideFeatureAccess('view_explore', { authMode: 'guest_preview' });
    const planDecision = decideFeatureAccess('view_system_plan', { authMode: 'guest_preview' });

    expect(exploreDecision.allowed).toBe(false);
    expect(planDecision.allowed).toBe(false);
    if (!exploreDecision.allowed) expect(exploreDecision.reason).toBe('login_required');
    if (!planDecision.allowed) expect(planDecision.reason).toBe('login_required');
  });

  it('allows logged-in free users to start workouts', () => {
    expect(decideFeatureAccess('start_workout', { authMode: 'logged_in_free' })).toEqual({
      allowed: true,
    });
  });

  it('requires Pro when a free user adds the third member', () => {
    const decision = decideFeatureAccess('add_member', {
      authMode: 'logged_in_free',
      memberCount: 2,
    });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(['pro_required', 'limit_reached']).toContain(decision.reason);
    }
  });

  it('requires Pro for advanced history on free accounts', () => {
    const decision = decideFeatureAccess('advanced_history', { authMode: 'logged_in_free' });

    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.reason).toBe('pro_required');
    }
  });

  it('allows Pro accounts to use Pro group features', () => {
    expect(decideFeatureAccess('pro_group', { authMode: 'logged_in_pro' })).toEqual({
      allowed: true,
    });
  });

  it('derives auth mode from login and membership tier', () => {
    expect(deriveAuthMode(false, 'pro')).toBe('guest_preview');
    expect(deriveAuthMode(true, 'free')).toBe('logged_in_free');
    expect(deriveAuthMode(true, 'pro')).toBe('logged_in_pro');
    expect(deriveAuthMode(true, 'lifetime')).toBe('logged_in_lifetime');
  });

  it('does not model logout as clearing local training data', () => {
    expect(LOGOUT_LOCAL_DATA_POLICY.clearsLocalTrainingData).toBe(false);
    expect(LOGOUT_LOCAL_DATA_POLICY.clearsSQLiteTrainingRecords).toBe(false);
    expect(LOGOUT_LOCAL_DATA_POLICY.storesTrainingRecordsInAsyncStorage).toBe(false);
  });
});
