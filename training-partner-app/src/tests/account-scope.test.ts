import { describe, expect, it } from '@jest/globals';

import { getGroupAccountScope, getPlanAccountScope } from '@/data/local/accountScope';

describe('account scope SQL helpers', () => {
  it('does not expose unowned groups when there is no current account', () => {
    const scope = getGroupAccountScope(null);

    expect(scope.where).toBe('1 = 0');
    expect(scope.params).toEqual([]);
  });

  it('limits no-account plan visibility to system schemes only', () => {
    const scope = getPlanAccountScope(null);

    expect(scope.where).toContain("source = 'system'");
    expect(scope.where).toContain("visibility = 'system'");
    expect(scope.where).not.toContain('creator_id IS NULL');
    expect(scope.where).not.toContain('owner_user_id IS NULL');
  });
});
