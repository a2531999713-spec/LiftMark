import { create } from 'zustand';

type SelectedGroupState = {
  selectedGroupId?: string;
  setSelectedGroupId(groupId: string): void;
};

export const useSelectedGroupStore = create<SelectedGroupState>((set) => ({
  selectedGroupId: undefined,
  setSelectedGroupId: (selectedGroupId) => set({ selectedGroupId }),
}));
