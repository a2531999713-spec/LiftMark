import { describe, expect, it } from '@jest/globals';

import { resolveScopedHistoryFilter } from '@/features/history/recordHome/historyFilter.state';

describe('scoped history filter state', () => {
  it('preserves a filter within the same account and group', () => {
    const state = { contextKey: 'account-a:group-a', filter: { kind: 'cycle' as const, planCycleId: 'cycle-a' } };
    expect(resolveScopedHistoryFilter(state, 'account-a:group-a')).toBe(state);
  });

  it('resets filters after account or group changes', () => {
    const state = { contextKey: 'account-a:group-a', filter: { kind: 'manual' as const } };
    expect(resolveScopedHistoryFilter(state, 'account-b:group-a').filter).toEqual({ kind: 'all' });
    expect(resolveScopedHistoryFilter(state, 'account-a:group-b').filter).toEqual({ kind: 'all' });
  });
});
