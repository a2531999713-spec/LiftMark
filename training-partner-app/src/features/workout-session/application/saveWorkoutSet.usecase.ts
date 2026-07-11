import type { WorkoutRepository } from '@/data/repositories/workoutRepository';
import type { SaveWorkoutSetInput, WorkoutSet } from '@/domain/workout/workout.types';

import type { WorkoutAutosaveService } from '../services/workoutAutosave.service';

export function saveWorkoutSet(
  autosave: WorkoutAutosaveService,
  repository: WorkoutRepository,
  input: SaveWorkoutSetInput,
): Promise<WorkoutSet> {
  return autosave.enqueue(input.id, () => repository.saveSet(input));
}
