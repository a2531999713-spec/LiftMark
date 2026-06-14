import { create } from 'zustand';

type WorkoutDraftState = {
  activeSessionId?: string;
  setActiveSessionId(sessionId?: string): void;
};

export const useWorkoutDraftStore = create<WorkoutDraftState>((set) => ({
  activeSessionId: undefined,
  setActiveSessionId: (activeSessionId) => set({ activeSessionId }),
}));
