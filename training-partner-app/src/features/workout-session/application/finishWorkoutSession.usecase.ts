import type { WorkoutRepository } from '@/data/repositories/workoutRepository';

import type { WorkoutWriteCoordinator } from '../services/workoutWriteCoordinator.service';

export type FinishWorkoutPerformance = {
  autosaveDrainMs: number;
  finishTransactionMs: number;
  pendingPatchCount: number;
  pendingWriteKeyCount: number;
  totalCriticalMs: number;
};

export async function finishWorkoutSession(input: {
  cancelDebounceTimers(): void;
  coordinator: WorkoutWriteCoordinator;
  repository: WorkoutRepository;
  sessionId: string;
}): Promise<FinishWorkoutPerformance> {
  const startedAt = Date.now();
  input.coordinator.freeze();
  input.cancelDebounceTimers();
  const beforeDrain = input.coordinator.getDiagnostics();
  const drainStartedAt = Date.now();

  try {
    await input.coordinator.waitForInFlight();
    const autosaveDrainMs = Date.now() - drainStartedAt;
    const patches = input.coordinator.takePendingPatches();
    const finishStartedAt = Date.now();
    try {
      await input.repository.completeSessionAtomic({ patches, sessionId: input.sessionId });
    } catch (error) {
      input.coordinator.restorePatches(patches);
      throw error;
    }
    return {
      autosaveDrainMs,
      finishTransactionMs: Date.now() - finishStartedAt,
      pendingPatchCount: beforeDrain.pendingPatchCount,
      pendingWriteKeyCount: beforeDrain.pendingWriteKeyCount,
      totalCriticalMs: Date.now() - startedAt,
    };
  } catch (error) {
    input.coordinator.resume();
    throw error;
  }
}
