import { beforeEach, describe, expect, it } from '@jest/globals';

import { useManualWorkoutDraftStore } from '@/store/manualWorkoutDraftStore';

describe('manual workout draft store', () => {
  beforeEach(() => {
    useManualWorkoutDraftStore.getState().reset();
  });

  it('initializes as a blank personal manual entry without seeded exercises', () => {
    useManualWorkoutDraftStore.getState().initialize({
      date: '2026-07-07',
      exerciseIds: [],
      participantMemberIds: ['member_1', 'member_2'],
      title: '',
      trainingMode: 'solo_local',
    });

    const state = useManualWorkoutDraftStore.getState();
    expect(state.title).toBe('');
    expect(state.trainingMode).toBe('solo_local');
    expect(state.participantMemberIds).toEqual(['member_1']);
    expect(state.exercises).toEqual([]);
  });

  it('adds a selected exercise with one blank set per participant', () => {
    useManualWorkoutDraftStore.getState().initialize({
      date: '2026-07-07',
      exerciseIds: [],
      participantMemberIds: ['member_1'],
      title: '',
      trainingMode: 'solo_local',
    });

    useManualWorkoutDraftStore.getState().addExercise('exercise_custom');

    const exercise = useManualWorkoutDraftStore.getState().exercises[0];
    expect(exercise.exerciseId).toBe('exercise_custom');
    expect(exercise.plannedSets).toBe(1);
    expect(exercise.memberSets).toHaveLength(1);
    expect(exercise.memberSets[0].sets).toMatchObject([
      {
        reps: '',
        setIndex: 1,
        weight: '',
      },
    ]);
  });
});
