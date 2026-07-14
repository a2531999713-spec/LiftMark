import { create } from 'zustand';

import type { ExercisePriority } from '@/domain/plan/plan.types';
import type { WorkoutTrainingMode } from '@/domain/workout/workout.types';

export type ManualSetStatus = 'completed' | 'skipped' | 'pending';

export type ManualSetDraft = {
  id: string;
  reps: string;
  setIndex: number;
  status: ManualSetStatus;
  weight: string;
  notes?: string;
  rpe?: string;
  rir?: string;
};

export type ManualMemberSetDraft = {
  memberId: string;
  sets: ManualSetDraft[];
};

export type ManualExerciseDraft = {
  exerciseId: string;
  id: string;
  memberSets: ManualMemberSetDraft[];
  plannedReps?: number | null;
  plannedRestSeconds?: number | null;
  plannedSets: number;
  priority: ExercisePriority;
};

type InitializeManualDraftInput = {
  date: string;
  exerciseIds: string[];
  linkedPlanId?: string | null;
  participantMemberIds: string[];
  title: string;
  trainingMode?: WorkoutTrainingMode;
};

type ManualWorkoutDraftState = {
  activeExerciseDraftId?: string;
  date: string;
  exercises: ManualExerciseDraft[];
  initialized: boolean;
  linkedPlanId?: string | null;
  participantMemberIds: string[];
  title: string;
  trainingMode: WorkoutTrainingMode;
  addExercise(exerciseId: string): void;
  addMemberSet(exerciseDraftId: string, memberId: string): void;
  copyPreviousSet(exerciseDraftId: string, memberId: string): void;
  initialize(input: InitializeManualDraftInput): void;
  removeExercise(exerciseDraftId: string): void;
  replaceExercise(exerciseDraftId: string, exerciseId: string): void;
  reset(): void;
  setActiveExercise(exerciseDraftId?: string): void;
  setDate(date: string): void;
  setLinkedPlanId(planId?: string | null): void;
  setTitle(title: string): void;
  setTrainingMode(trainingMode: WorkoutTrainingMode): void;
  toggleParticipant(memberId: string): void;
  updateSet(exerciseDraftId: string, memberId: string, setId: string, patch: Partial<ManualSetDraft>): void;
};

function createDraftId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSetDraft(setIndex: number, seed?: Partial<ManualSetDraft>): ManualSetDraft {
  return {
    id: createDraftId('manual_set'),
    reps: seed?.reps ?? '',
    setIndex,
    status: seed?.status ?? 'completed',
    weight: seed?.weight ?? '',
    notes: seed?.notes,
    rpe: seed?.rpe,
    rir: seed?.rir,
  };
}

function createInitialSets(): ManualSetDraft[] {
  return [createSetDraft(1)];
}

function deriveTrainingMode(participantMemberIds: string[]): WorkoutTrainingMode {
  return participantMemberIds.length <= 1 ? 'solo_local' : 'group_local';
}

function createMemberSets(participantMemberIds: string[]): ManualMemberSetDraft[] {
  return participantMemberIds.map((memberId) => ({
    memberId,
    sets: createInitialSets(),
  }));
}

function createExerciseDraft(
  exerciseId: string,
  index: number,
  participantMemberIds: string[],
): ManualExerciseDraft {
  return {
    exerciseId,
    id: createDraftId('manual_exercise'),
    memberSets: createMemberSets(participantMemberIds),
    plannedReps: null,
    plannedRestSeconds: null,
    plannedSets: 1,
    priority: index === 0 ? 'A' : index === 1 ? 'B' : 'C',
  };
}

function ensureMemberSets(exercise: ManualExerciseDraft, participantMemberIds: string[]) {
  const existing = new Set(exercise.memberSets.map((memberSet) => memberSet.memberId));
  const additions = participantMemberIds
    .filter((memberId) => !existing.has(memberId))
    .map((memberId) => ({
      memberId,
      sets: createInitialSets(),
    }));

  return {
    ...exercise,
    memberSets: [...exercise.memberSets, ...additions],
  };
}

const initialState = {
  activeExerciseDraftId: undefined,
  date: '',
  exercises: [] as ManualExerciseDraft[],
  initialized: false,
  linkedPlanId: null,
  participantMemberIds: [] as string[],
  title: '',
  trainingMode: 'solo_local' as WorkoutTrainingMode,
};

export const useManualWorkoutDraftStore = create<ManualWorkoutDraftState>((set, get) => ({
  ...initialState,
  addExercise: (exerciseId) => {
    const state = get();
    if (state.exercises.some((exercise) => exercise.exerciseId === exerciseId)) {
      return;
    }
    set({
      exercises: [
        ...state.exercises,
        createExerciseDraft(exerciseId, state.exercises.length, state.participantMemberIds),
      ],
    });
  },
  addMemberSet: (exerciseDraftId, memberId) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseDraftId
          ? {
              ...exercise,
              memberSets: exercise.memberSets.map((memberSet) =>
                memberSet.memberId === memberId
                  ? {
                      ...memberSet,
                      sets: [...memberSet.sets, createSetDraft(memberSet.sets.length + 1, memberSet.sets.at(-1))],
                    }
                  : memberSet,
              ),
              plannedSets: Math.max(exercise.plannedSets, (exercise.memberSets.find((item) => item.memberId === memberId)?.sets.length ?? 0) + 1),
            }
          : exercise,
      ),
    }));
  },
  copyPreviousSet: (exerciseDraftId, memberId) => {
    const exercise = get().exercises.find((item) => item.id === exerciseDraftId);
    const memberSet = exercise?.memberSets.find((item) => item.memberId === memberId);
    const lastSet = memberSet?.sets.at(-1);
    if (!lastSet) return;
    get().addMemberSet(exerciseDraftId, memberId);
  },
  initialize: ({ date, exerciseIds, linkedPlanId = null, participantMemberIds, title }) => {
    const scopedParticipantMemberIds = participantMemberIds;
    set({
      activeExerciseDraftId: undefined,
      date,
      exercises: exerciseIds.map((exerciseId, index) => createExerciseDraft(exerciseId, index, scopedParticipantMemberIds)),
      initialized: true,
      linkedPlanId,
      participantMemberIds: scopedParticipantMemberIds,
      title,
      trainingMode: deriveTrainingMode(scopedParticipantMemberIds),
    });
  },
  removeExercise: (exerciseDraftId) => {
    set((state) => ({
      exercises: state.exercises.filter((exercise) => exercise.id !== exerciseDraftId),
      activeExerciseDraftId: state.activeExerciseDraftId === exerciseDraftId ? undefined : state.activeExerciseDraftId,
    }));
  },
  replaceExercise: (exerciseDraftId, exerciseId) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseDraftId ? { ...exercise, exerciseId } : exercise,
      ),
    }));
  },
  reset: () => set(initialState),
  setActiveExercise: (activeExerciseDraftId) => set({ activeExerciseDraftId }),
  setDate: (date) => set({ date }),
  setLinkedPlanId: (linkedPlanId) => set({ linkedPlanId: linkedPlanId ?? null }),
  setTitle: (title) => set({ title }),
  setTrainingMode: (_trainingMode) => {
    set((state) => {
      const participantMemberIds = state.participantMemberIds;
      return {
        trainingMode: deriveTrainingMode(participantMemberIds),
        participantMemberIds,
        exercises: state.exercises.map((exercise) => ensureMemberSets(exercise, participantMemberIds)),
      };
    });
  },
  toggleParticipant: (memberId) => {
    set((state) => {
      const exists = state.participantMemberIds.includes(memberId);
      const nextIds = exists
        ? state.participantMemberIds.filter((id) => id !== memberId)
        : [...state.participantMemberIds, memberId];

      return {
        participantMemberIds: nextIds,
        trainingMode: deriveTrainingMode(nextIds),
        exercises: state.exercises.map((exercise) => ensureMemberSets(exercise, nextIds)),
      };
    });
  },
  updateSet: (exerciseDraftId, memberId, setId, patch) => {
    set((state) => ({
      exercises: state.exercises.map((exercise) =>
        exercise.id === exerciseDraftId
          ? {
              ...exercise,
              memberSets: exercise.memberSets.map((memberSet) =>
                memberSet.memberId === memberId
                  ? {
                      ...memberSet,
                      sets: memberSet.sets.map((setDraft) =>
                        setDraft.id === setId ? { ...setDraft, ...patch } : setDraft,
                      ),
                    }
                  : memberSet,
              ),
            }
          : exercise,
      ),
    }));
  },
}));
