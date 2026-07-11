export type PlanCycleConfirmationAction = 'complete' | 'archive';

export type PlanCycleConfirmationState = {
  action: PlanCycleConfirmationAction | null;
};

export const initialPlanCycleConfirmationState: PlanCycleConfirmationState = { action: null };

export function requestPlanCycleConfirmation(
  action: PlanCycleConfirmationAction,
): PlanCycleConfirmationState {
  return { action };
}

export function dismissPlanCycleConfirmation(): PlanCycleConfirmationState {
  return initialPlanCycleConfirmationState;
}

export function consumePlanCycleConfirmation(state: PlanCycleConfirmationState): {
  action: PlanCycleConfirmationAction | null;
  nextState: PlanCycleConfirmationState;
} {
  return { action: state.action, nextState: initialPlanCycleConfirmationState };
}
