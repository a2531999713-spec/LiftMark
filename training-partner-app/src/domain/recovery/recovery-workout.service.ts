import type { PlanExercise } from '@/domain/plan/plan.types';
import { filterExercisesByRecovery } from '@/domain/plan/plan.service';
import { roundWeightToIncrement } from '@/domain/weight/weight-calculator';

import type { RecoveryAssessmentResult, RecoveryRecommendation } from './recovery.types';

export type RecoveryWorkoutAdjustment = {
  canCreateSession: boolean;
  exercises: PlanExercise[];
  removedExercises: PlanExercise[];
  recommendation: RecoveryRecommendation;
  weightReductionPercent?: number;
};

export type RecoveryGroupSummary = {
  assessedCount: number;
  mostConservative: RecoveryAssessmentResult | null;
  unassessedCount: number;
};

const recommendationRank: Record<RecoveryRecommendation, number> = {
  normal: 0,
  remove_c: 1,
  reduce_weight: 2,
  deload: 3,
  only_a: 4,
  rest: 5,
};

export function resolveRecoveryWorkoutAdjustment(
  exercises: PlanExercise[],
  assessment: RecoveryAssessmentResult,
): RecoveryWorkoutAdjustment {
  const mode =
    assessment.recommendation === 'remove_c' || assessment.recommendation === 'deload'
      ? 'normal'
      : assessment.recommendation === 'only_a'
        ? 'bad'
        : assessment.recommendation === 'rest'
          ? 'very_bad'
          : 'good';
  const filtered = filterExercisesByRecovery(exercises, mode);
  const keptIds = new Set(filtered.map((exercise) => exercise.id));
  return {
    canCreateSession: assessment.recommendation !== 'rest' && filtered.length > 0,
    exercises: filtered,
    removedExercises: exercises.filter((exercise) => !keptIds.has(exercise.id)),
    recommendation: assessment.recommendation,
    ...(assessment.recommendation === 'reduce_weight' || assessment.recommendation === 'deload'
      ? { weightReductionPercent: assessment.suggestedWeightReductionPercent ?? 7.5 }
      : {}),
  };
}

export function getMostConservativeAssessment(
  assessments: RecoveryAssessmentResult[],
): RecoveryAssessmentResult | null {
  return assessments.reduce<RecoveryAssessmentResult | null>((mostConservative, assessment) => {
    if (!mostConservative) return assessment;
    return recommendationRank[assessment.recommendation] > recommendationRank[mostConservative.recommendation]
      ? assessment
      : mostConservative;
  }, null);
}

export function summarizeMemberRecovery(
  memberIds: string[],
  assessmentsByMemberId: Record<string, RecoveryAssessmentResult | null | undefined>,
): RecoveryGroupSummary {
  const assessments = memberIds
    .map((memberId) => assessmentsByMemberId[memberId])
    .filter((assessment): assessment is RecoveryAssessmentResult => Boolean(assessment));
  return {
    assessedCount: assessments.length,
    mostConservative: getMostConservativeAssessment(assessments),
    unassessedCount: memberIds.length - assessments.length,
  };
}

export function shouldPromptForRecovery(input: {
  currentMemberId: string | null;
  dismissed: boolean;
  hasDailyAssessment: boolean;
  loadFailed: boolean;
  loading: boolean;
  skipPrompt?: boolean;
}): boolean {
  return Boolean(
    input.currentMemberId &&
      !input.skipPrompt &&
      !input.dismissed &&
      !input.loading &&
      !input.loadFailed &&
      !input.hasDailyAssessment,
  );
}

export function calculateRecoveryAdjustedWeight(
  plannedWeight: number | null | undefined,
  reductionPercent = 7.5,
  increment = 2.5,
): number | null {
  if (
    plannedWeight === null ||
    plannedWeight === undefined ||
    !Number.isFinite(plannedWeight) ||
    plannedWeight <= 0
  ) {
    return null;
  }
  const safeReduction = Number.isFinite(reductionPercent)
    ? Math.min(100, Math.max(0, reductionPercent))
    : 7.5;
  return Math.max(0, roundWeightToIncrement(plannedWeight * (1 - safeReduction / 100), increment));
}
