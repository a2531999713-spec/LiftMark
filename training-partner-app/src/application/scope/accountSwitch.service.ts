import { useManualWorkoutDraftStore } from '@/store/manualWorkoutDraftStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { useSyncStore } from '@/store/syncStore';
import { useWorkoutDraftStore } from '@/store/workoutDraftStore';

let activeRuntimeUserId: string | null | undefined;

export function switchApplicationAccountScope(userId?: string | null): void {
  const normalizedUserId = userId?.trim() || null;
  const accountChanged = activeRuntimeUserId !== undefined && activeRuntimeUserId !== normalizedUserId;
  activeRuntimeUserId = normalizedUserId;

  useSelectedGroupStore.getState().switchAccountScope(normalizedUserId);
  if (accountChanged) {
    useSelectedGroupStore.getState().clearSelectedGroupId();
    useWorkoutDraftStore.getState().setActiveSessionId(undefined);
    useManualWorkoutDraftStore.getState().reset();
    useSyncStore.getState().resetRuntime();
  }
}

export function resetAccountSwitchRuntimeForTests(): void {
  activeRuntimeUserId = undefined;
}
