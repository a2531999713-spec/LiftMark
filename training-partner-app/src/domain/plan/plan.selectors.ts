import type { PhaseType, PlanPhase } from './plan.types';

export function findPhaseForWeek(
  phases: PlanPhase[],
  phaseType: PhaseType,
  currentWeek: number,
): PlanPhase | undefined {
  return phases.find(
    (phase) =>
      phase.type === phaseType &&
      currentWeek >= phase.startWeek &&
      currentWeek <= phase.endWeek,
  );
}
