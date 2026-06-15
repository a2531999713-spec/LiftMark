import type { MemberProfile } from '../member/member.types';
import type { ReferenceLift } from '../plan/plan.types';
import type { SuggestedWeightInput, SuggestedWeightResult } from './weight.types';

export function roundToIncrement(weight: number, increment: number): number {
  if (increment <= 0) {
    throw new Error('Increment must be greater than zero.');
  }

  return Math.round(weight / increment) * increment;
}

export function getReferenceOneRm(profile: MemberProfile, referenceLift: ReferenceLift): number | undefined {
  switch (referenceLift) {
    case 'bench':
      return profile.bench1RM;
    case 'squat':
      return profile.squat1RM;
    case 'deadlift':
      return profile.deadlift1RM;
    case 'overhead_press':
      return profile.overheadPress1RM;
    case 'pullup_total':
      return profile.pullupReferenceWeight;
    case 'none':
      return undefined;
  }
}

export function estimatePercentFromTargetReps(reps: number | undefined): number | undefined {
  if (!reps || reps <= 0) {
    return undefined;
  }

  if (reps <= 3) {
    return 0.88;
  }

  if (reps <= 5) {
    return 0.82;
  }

  if (reps <= 8) {
    return 0.75;
  }

  if (reps <= 10) {
    return 0.7;
  }

  if (reps <= 12) {
    return 0.65;
  }

  if (reps <= 15) {
    return 0.6;
  }

  return undefined;
}

function resolvePercent1RM(input: SuggestedWeightInput): number | undefined {
  if (input.percent1RM) {
    return input.percent1RM;
  }

  return estimatePercentFromTargetReps(input.repMax ?? input.reps ?? input.repMin);
}

export function calculateSuggestedWeight(input: SuggestedWeightInput): SuggestedWeightResult {
  const percent1RM = resolvePercent1RM(input);

  if (input.referenceLift === 'none' || !percent1RM) {
    return {
      status: 'manual',
      reason: 'This exercise does not use a percentage-based 1RM recommendation.',
    };
  }

  const referenceOneRm =
    input.referenceLift === 'pullup_total'
      ? getReferenceOneRm(input.profile, input.referenceLift) ?? input.profile.bodyweight
      : getReferenceOneRm(input.profile, input.referenceLift);

  if (!referenceOneRm) {
    return {
      status: 'missing_1rm',
      reason: '该成员缺少所需的参考 1RM。',
    };
  }

  const increment =
    input.equipment === 'dumbbell'
      ? input.profile.dumbbellIncrement
      : input.profile.barbellIncrement;

  return {
    status: 'ready',
    percent1RM,
    weight: roundToIncrement(referenceOneRm * percent1RM, increment),
  };
}

export function estimateOneRM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    throw new Error('Invalid weight or reps.');
  }

  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
