import { describe, expect, it } from '@jest/globals';

import type { PlanExercise } from '@/domain/plan/plan.types';
import {
  checkShortWorkout,
  getNextWorkoutSetForRotation,
  getPlanExerciseInitialReps,
  getPlanExerciseSetCount,
  getWorkoutExerciseSetProgress,
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

  it('rotates group workout by set number before member order', () => {
    const sets = [
      createSet({ id: 'zhang_1', memberId: 'zhang', setNumber: 1, completed: true }),
      createSet({ id: 'zhang_2', memberId: 'zhang', setNumber: 2 }),
      createSet({ id: 'li_1', memberId: 'li', setNumber: 1 }),
      createSet({ id: 'li_2', memberId: 'li', setNumber: 2 }),
    ];

    expect(getNextWorkoutSetForRotation(sets, ['zhang', 'li'], 'record_1')?.id).toBe('li_1');
    expect(
      getNextWorkoutSetForRotation(
        sets.map((set) => (set.id === 'li_1' ? { ...set, completed: true } : set)),
        ['zhang', 'li'],
        'record_1',
      )?.id,
    ).toBe('zhang_2');
  });

  it('returns to the first member after the last member completes a rested round', () => {
    const sets = [
      createSet({ id: 'a_1', memberId: 'a', setNumber: 1, completed: true }),
      createSet({ id: 'b_1', memberId: 'b', setNumber: 1, completed: true }),
      createSet({ id: 'c_1', memberId: 'c', setNumber: 1, completed: true }),
      createSet({ id: 'a_2', memberId: 'a', setNumber: 2 }),
      createSet({ id: 'b_2', memberId: 'b', setNumber: 2 }),
      createSet({ id: 'c_2', memberId: 'c', setNumber: 2 }),
    ];

    expect(getNextWorkoutSetForRotation(sets, ['a', 'b', 'c'], 'record_1')?.id).toBe('a_2');
  });

  it('finishes every member in the last planned set before moving on', () => {
    const memberOrder = ['a', 'b', 'c'];
    const sets = [
      createSet({ id: 'a_4', memberId: 'a', setNumber: 4, completed: true }),
      createSet({ id: 'b_4', memberId: 'b', setNumber: 4 }),
      createSet({ id: 'c_4', memberId: 'c', setNumber: 4 }),
    ];

    expect(getNextWorkoutSetForRotation(sets, memberOrder, 'record_1')?.id).toBe('b_4');

    const afterB = sets.map((set) => (set.id === 'b_4' ? { ...set, completed: true } : set));
    expect(getNextWorkoutSetForRotation(afterB, memberOrder, 'record_1')?.id).toBe('c_4');

    const afterC = afterB.map((set) => (set.id === 'c_4' ? { ...set, completed: true } : set));
    expect(getNextWorkoutSetForRotation(afterC, memberOrder, 'record_1')).toBeNull();
  });

  it('reports current planned set separately from total participant sets', () => {
    const progress = getWorkoutExerciseSetProgress(
      [
        createSet({ id: 'zhang_1', memberId: 'zhang', setNumber: 1, completed: true }),
        createSet({ id: 'li_1', memberId: 'li', setNumber: 1, completed: true }),
        createSet({ id: 'zhang_2', memberId: 'zhang', setNumber: 2 }),
        createSet({ id: 'li_2', memberId: 'li', setNumber: 2 }),
      ],
      'record_1',
    );

    expect(progress).toEqual({
      completedMemberSets: 2,
      currentSetNumber: 2,
      isComplete: false,
      totalMemberSets: 4,
      totalPlannedSets: 2,
    });
  });

  it('rejects invalid live set inputs', () => {
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualWeight: -1 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualWeight: Number.NaN })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualWeight: Number.POSITIVE_INFINITY })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualReps: -1 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualReps: 4.5 })).toThrow();
    expect(() => validateWorkoutSetInput({ id: 'set_1', actualWeight: 97.5, actualReps: 5 })).not.toThrow();
  });

  it('asks for confirmation before saving short workout records', () => {
    expect(
      checkShortWorkout({
        completedExerciseCount: 1,
        completedSetCount: 2,
        elapsedSeconds: 180,
        totalExerciseCount: 6,
        totalVolumeKg: 1200,
      }).shouldConfirm,
    ).toBe(true);

    expect(
      checkShortWorkout({
        completedExerciseCount: 4,
        completedSetCount: 12,
        elapsedSeconds: 2400,
        totalExerciseCount: 6,
        totalVolumeKg: 12000,
      }).shouldConfirm,
    ).toBe(false);
  });
});
