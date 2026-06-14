import { describe, expect, it } from '@jest/globals';

import type { PlanExercise } from '@/domain/plan/plan.types';
import {
  getPlanExerciseInitialReps,
  getPlanExerciseSetCount,
  getWorkoutRecordInitialReps,
  summarizeWorkoutSets,
} from '@/domain/workout/workout.service';
import type { WorkoutExerciseRecord, WorkoutSet } from '@/domain/workout/workout.types';
import { validateWorkoutSetInput } from '@/domain/workout/workout.validation';

function createPlanExercise(patch: Partial<PlanExercise> = {}): PlanExercise {
  return {
    id: 'plan_exercise_1',
    planDayId: 'plan_day_1',
    exerciseId: 'exercise_1',
    priority: 'A',
    orderIndex: 1,
    sets: 4,
    reps: 6,
    intensityType: 'percent_1rm',
    referenceLift: 'bench',
    percent1RM: 0.75,
    ...patch,
  };
}

function createWorkoutRecord(patch: Partial<WorkoutExerciseRecord> = {}): WorkoutExerciseRecord {
  return {
    id: 'record_1',
    sessionId: 'session_1',
    exerciseId: 'exercise_1',
    priority: 'A',
    orderIndex: 1,
    plannedSets: 4,
    plannedReps: 6,
    ...patch,
  };
}

function createSet(patch: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: 'set_1',
    sessionId: 'session_1',
    exerciseRecordId: 'record_1',
    memberId: 'member_1',
    setNumber: 1,
    completed: false,
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...patch,
  };
}

describe('workout domain rules', () => {
  it('uses plan sets and falls back to one set when missing', () => {
    expect(getPlanExerciseSetCount(createPlanExercise({ sets: 5 }))).toBe(5);
    expect(getPlanExerciseSetCount(createPlanExercise({ sets: undefined }))).toBe(1);
  });

  it('uses exact reps first and range minimum as the initial actual reps fallback', () => {
    expect(getPlanExerciseInitialReps(createPlanExercise({ reps: 5, repMin: 3 }))).toBe(5);
    expect(getPlanExerciseInitialReps(createPlanExercise({ reps: undefined, repMin: 8 }))).toBe(8);
    expect(getWorkoutRecordInitialReps(createWorkoutRecord({ plannedReps: undefined, plannedRepMin: 10 }))).toBe(10);
  });

  it('summarizes completed sets without mixing members', () => {
    const summary = summarizeWorkoutSets('session_1', [
      createSet({ id: 'set_1', memberId: 'member_1', completed: true }),
      createSet({ id: 'set_2', memberId: 'member_2', completed: false }),
      createSet({ id: 'set_3', memberId: 'member_1', completed: true }),
    ]);

    expect(summary).toEqual({
      sessionId: 'session_1',
      completedSets: 2,
      totalSets: 3,
    });
  });

  it('rejects invalid live set inputs', () => {
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualWeight: -1 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualReps: -1 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualReps: 4.5 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', rpe: 5 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', rpe: 11 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', rir: 6 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualWeight: 97.5, actualReps: 5 })).not.toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', rpe: undefined, rir: undefined })).not.toThrow();
  });
});
