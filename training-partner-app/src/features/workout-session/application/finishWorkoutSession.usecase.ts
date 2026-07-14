import type { WorkoutRepository } from '@/data/repositories/workoutRepository';

import type { WorkoutAutosaveService } from '../services/workoutAutosave.service';

export async function finishWorkoutSession(input: {
  autosave: WorkoutAutosaveService;
  flushDebouncedWrites(): Promise<void>;
  repository: WorkoutRepository;
  sessionId: string;
}) {
  const startedAt = Date.now();
  await input.flushDebouncedWrites();
  await input.autosave.flush();
  await input.repository.finishSession(input.sessionId);
  return { criticalDurationMs: Date.now() - startedAt };
}
