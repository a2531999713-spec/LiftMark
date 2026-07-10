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
      // 切换账号时应「恢复」该 scope 之前保存的选择，而不是抹掉它。
      // 否则 selectedGroupIdsByScope 永远为空，切回原账号后已选小组丢失。
      const restoredSelectedGroupId = state.selectedGroupIdsByScope[activeUserScope];
      return {
        activeUserScope,
        selectedGroupId: restoredSelectedGroupId,
        selectedGroupIdsByScope: state.selectedGroupIdsByScope,
      };
    }),
}));
