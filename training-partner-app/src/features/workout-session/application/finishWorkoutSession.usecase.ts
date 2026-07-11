import type { WorkoutRepository } from '@/data/repositories/workoutRepository';

import type { WorkoutAutosaveService } from '../services/workoutAutosave.service';

export async function finishWorkoutSession(input: {
  autosave: WorkoutAutosaveService;
  flushDebouncedWrites(): Promise<void>;
  repository: WorkoutRepository;
  sessionId: string;
}) {
  await input.flushDebouncedWrites();
  await input.autosave.flush();
  return input.repository.finishSession(input.sessionId);
}
