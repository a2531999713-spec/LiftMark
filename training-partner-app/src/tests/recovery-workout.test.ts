import { describe, expect, it } from '@jest/globals';

import type { PlanExercise } from '@/domain/plan/plan.types';
import {
  calculateRecoveryAdjustedWeight,
  getMostConservativeAssessment,
  resolveRecoveryWorkoutAdjustment,
  shouldPromptForRecovery,
  summarizeMemberRecovery,
} from '@/domain/recovery/recovery-workout.service';
import type { RecoveryAssessmentResult } from '@/domain/recovery/recovery.types';

function exercise(id: string, priority: PlanExercise['priority']): PlanExercise {
  return {
    exerciseId: `exercise_${id}`,
    id,
    intensityType: 'manual',
    orderIndex: 1,
    planDayId: 'day_1',
    priority,
    referenceLift: 'none',
  };
}

function assessment(
  recommendation: RecoveryAssessmentResult['recommendation'],
): RecoveryAssessmentResult {
  const status = recommendation === 'normal' ? 'good' : recommendation === 'rest' ? 'rest' : 'low';
  return {
    reasons: ['测试原因'],
    recommendation,
    recoveryMode:
      recommendation === 'rest'
        ? 'very_bad'
        : recommendation === 'only_a'
          ? 'bad'
          : recommendation === 'remove_c' || recommendation === 'deload'
            ? 'normal'
            : 'good',
    status,
    summary: '测试建议',
    title: '测试状态',
    totalScore: 18,
    ...(recommendation === 'reduce_weight' || recommendation === 'deload'
      ? { suggestedWeightReductionPercent: 7.5 }
      : {}),
  };
}

const exercises = [exercise('a', 'A'), exercise('b', 'B'), exercise('c', 'C')];

describe('recovery workout adjustment', () => {
  it('keeps the complete plan for normal and weight-only recommendations', () => {
    expect(resolveRecoveryWorkoutAdjustment(exercises, assessment('normal')).exercises).toEqual(exercises);
    expect(resolveRecoveryWorkoutAdjustment(exercises, assessment('reduce_weight'))).toMatchObject({
      canCreateSession: true,
      exercises,
      removedExercises: [],
      weightReductionPercent: 7.5,
    });
  });

  it('filters only C work for remove-c and deload recommendations', () => {
    expect(
      resolveRecoveryWorkoutAdjustment(exercises, assessment('remove_c')).exercises.map((item) => item.priority),
    ).toEqual(['A', 'B']);
    expect(resolveRecoveryWorkoutAdjustment(exercises, assessment('deload'))).toMatchObject({
      canCreateSession: true,
      weightReductionPercent: 7.5,
    });
  });

  it('keeps only A work and refuses to create an empty session when no A work exists', () => {
    expect(
      resolveRecoveryWorkoutAdjustment(exercises, assessment('only_a')).exercises.map((item) => item.priority),
    ).toEqual(['A']);
    expect(
      resolveRecoveryWorkoutAdjustment(exercises.slice(1), assessment('only_a')),
    ).toMatchObject({ canCreateSession: false, exercises: [] });
  });

  it('does not create a session for a rest recommendation', () => {
    expect(resolveRecoveryWorkoutAdjustment(exercises, assessment('rest'))).toMatchObject({
      canCreateSession: false,
      exercises: [],
    });
  });

  it('selects the most conservative assessed group member without inventing missing assessments', () => {
    expect(
      getMostConservativeAssessment([
        assessment('normal'),
        assessment('reduce_weight'),
        assessment('remove_c'),
      ])?.recommendation,
    ).toBe('reduce_weight');
    expect(getMostConservativeAssessment([])).toBeNull();
    expect(
      summarizeMemberRecovery(['member-a', 'member-b'], {
        'member-a': assessment('reduce_weight'),
        'member-b': null,
      }),
    ).toMatchObject({
      assessedCount: 1,
      mostConservative: { recommendation: 'reduce_weight' },
      unassessedCount: 1,
    });
  });

  it('prompts once for a loaded missing assessment but never blocks loading, failure or dismissal', () => {
    const base = {
      currentMemberId: 'member-a',
      dismissed: false,
      hasDailyAssessment: false,
      loadFailed: false,
      loading: false,
    };
    expect(shouldPromptForRecovery(base)).toBe(true);
    expect(shouldPromptForRecovery({ ...base, dismissed: true })).toBe(false);
    expect(shouldPromptForRecovery({ ...base, loading: true })).toBe(false);
    expect(shouldPromptForRecovery({ ...base, loadFailed: true })).toBe(false);
    expect(shouldPromptForRecovery({ ...base, skipPrompt: true })).toBe(false);
  });

  it('rounds temporary weights to the equipment increment and never invents zero or missing weights', () => {
    expect(calculateRecoveryAdjustedWeight(100, 7.5, 2.5)).toBe(92.5);
    expect(calculateRecoveryAdjustedWeight(82.5, 7.5, 0.5)).toBe(76.5);
    expect(calculateRecoveryAdjustedWeight(0)).toBeNull();
    expect(calculateRecoveryAdjustedWeight(null)).toBeNull();
  });
});
