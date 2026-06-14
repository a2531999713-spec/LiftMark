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

export function calculateSuggestedWeight(input: SuggestedWeightInput): SuggestedWeightResult {
  if (input.referenceLift === 'none' || !input.percent1RM) {
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
    weight: roundToIncrement(referenceOneRm * input.percent1RM, increment),
  };
}

export function estimateOneRM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    throw new Error('Invalid weight or reps.');
  }

  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}
