import { describe, expect, it } from '@jest/globals';

import {
  consumePlanCycleConfirmation,
  dismissPlanCycleConfirmation,
  initialPlanCycleConfirmationState,
  requestPlanCycleConfirmation,
} from '@/features/plan-cycle/model/planCycleConfirmation.state';

describe('plan cycle confirmation state', () => {
  it('requires an explicit archive confirmation request', () => {
    expect(initialPlanCycleConfirmationState.action).toBeNull();
    expect(requestPlanCycleConfirmation('archive')).toEqual({ action: 'archive' });
  });

  it('clears pending actions after cancel or consume', () => {
    expect(dismissPlanCycleConfirmation().action).toBeNull();
    expect(consumePlanCycleConfirmation({ action: 'archive' })).toEqual({
      action: 'archive',
      nextState: { action: null },
    });
  });
});
