import { create } from 'zustand';

type AppState = {
  initialized: boolean;
  setInitialized(value: boolean): void;
};

export const useAppStore = create<AppState>((set) => ({
  initialized: false,
  setInitialized: (value) => set({ initialized: value }),
}));
