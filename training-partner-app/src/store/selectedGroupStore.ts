import { create } from 'zustand';

const ANONYMOUS_SCOPE = '__anonymous__';

function getScopeKey(userId?: string | null) {
  return userId?.trim() || ANONYMOUS_SCOPE;
}

type SelectedGroupState = {
  activeUserScope: string;
  selectedGroupId?: string;
  selectedGroupIdsByScope: Record<string, string | undefined>;
  clearSelectedGroupId(): void;
  setSelectedGroupId(groupId?: string): void;
  switchAccountScope(userId?: string | null): void;
};

export const useSelectedGroupStore = create<SelectedGroupState>((set) => ({
  activeUserScope: ANONYMOUS_SCOPE,
  selectedGroupId: undefined,
  selectedGroupIdsByScope: {},
  clearSelectedGroupId: () =>
    set((state) => ({
      selectedGroupId: undefined,
      selectedGroupIdsByScope: {
        ...state.selectedGroupIdsByScope,
        [state.activeUserScope]: undefined,
      },
    })),
  setSelectedGroupId: (selectedGroupId) =>
    set((state) => ({
      selectedGroupId,
      selectedGroupIdsByScope: {
        ...state.selectedGroupIdsByScope,
        [state.activeUserScope]: selectedGroupId,
      },
    })),
  switchAccountScope: (userId) =>
    set((state) => {
      const activeUserScope = getScopeKey(userId);
      return {
        activeUserScope,
        selectedGroupId: undefined,
        selectedGroupIdsByScope: {
          ...state.selectedGroupIdsByScope,
          [activeUserScope]: undefined,
        },
      };
    }),
}));
