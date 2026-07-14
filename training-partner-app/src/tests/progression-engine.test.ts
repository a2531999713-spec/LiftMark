import { describe, expect, it } from '@jest/globals';

import { getProgressionDecision, resolveProgressionStrategy, roundToEquipmentIncrement } from '@/domain/progression/progression-engine';
import type { ExercisePerformanceSnapshot, HistoricalExercisePerformance } from '@/domain/progression/progression.types';

function snapshot(patch: Partial<ExercisePerformanceSnapshot> = {}): ExercisePerformanceSnapshot {
  return {
    completedReps: [5, 5, 5, 5],
    completedSets: 4,
    completedWeights: [80, 80, 80, 80],
    equipment: 'barbell',
    exerciseId: 'bench',
    failedSetCount: 0,
    intensityType: 'fixed',
    latestWorkingWeight: 80,
    memberId: 'member-a',
    planGoal: 'strength',
    plannedReps: 5,
    plannedSets: 4,
    sessionId: 'session-a',
    skippedSets: 0,
    weightIncrement: 2.5,
    ...patch,
  };
}

const failed: HistoricalExercisePerformance = { allSetsReachedTarget: false, hasValidWorkingSets: true, repCompletionRate: 0.5 };

describe('deterministic progression engine', () => {
  it('uses the plan rule before goal and prescription fallbacks', () => {
    expect(resolveProgressionStrategy(snapshot({ planGoal: 'strength', progressionRuleId: 'hypertrophy-double' }))).toBe('hypertrophy');
    expect(resolveProgressionStrategy(snapshot({ planGoal: 'general', intensityType: 'manual', plannedRepMax: 12, plannedRepMin: 8 }))).toBe('hypertrophy');
  });

  it('increases strength work after every planned set reaches its target', () => {
    expect(getProgressionDecision(snapshot())).toMatchObject({ suggestion: 'increase', suggestedWeight: 82.5, strategy: 'strength' });
  });

  it('maintains after a near-complete strength performance and stays conservative after one failure', () => {
    expect(getProgressionDecision(snapshot({ completedReps: [5, 5, 5, 4] }))?.suggestion).toBe('maintain');
    expect(getProgressionDecision(snapshot({ completedReps: [5, 3, 3, 3] }))?.suggestion).toBe('maintain_or_decrease');
  });

  it('decreases after two low-completion strength sessions and deloads after three severe failures', () => {
    expect(getProgressionDecision(snapshot({ completedReps: [2, 2, 2, 2] }), [failed])?.suggestion).toBe('decrease');
    expect(getProgressionDecision(snapshot({ completedReps: [2, 2, 2, 2] }), [failed, failed])?.suggestion).toBe('deload');
  });

  it('uses double progression for hypertrophy work', () => {
    const base = snapshot({ intensityType: 'manual', planGoal: 'hypertrophy', plannedRepMin: 8, plannedRepMax: 12, plannedReps: undefined });
    expect(getProgressionDecision({ ...base, completedReps: [12, 12, 12, 12] })).toMatchObject({ suggestion: 'increase', suggestedWeight: 82.5 });
    expect(getProgressionDecision({ ...base, completedReps: [12, 11, 10, 8] })?.suggestion).toBe('add_reps');
    expect(getProgressionDecision({ ...base, completedReps: [12, 11, 7, 8] })?.suggestion).toBe('maintain');
    expect(getProgressionDecision({ ...base, completedReps: [7, 7, 7, 7] }, [failed])?.suggestion).toBe('decrease');
  });

  it('does not invent a weight for bodyweight work and skips empty work', () => {
    expect(getProgressionDecision(snapshot({ completedWeights: [0, 0, 0, 0], equipment: 'bodyweight', latestWorkingWeight: undefined }))?.suggestedWeight).toBeUndefined();
    expect(getProgressionDecision(snapshot({ completedReps: [], completedSets: 0, skippedSets: 4 }))).toBeNull();
  });

  it('rounds safely to the configured equipment increment and remains deterministic', () => {
    expect(roundToEquipmentIncrement(82.49, 2.5)).toBe(82.5);
    expect(roundToEquipmentIncrement(20, 1)).toBe(20);
    const input = snapshot({ planGoal: 'general', intensityType: 'manual', plannedReps: 10 });
    expect(getProgressionDecision(input, [failed])).toEqual(getProgressionDecision(input, [failed]));
  });
});
