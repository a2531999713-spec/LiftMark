import type { WorkoutSet } from '@/domain/workout/workout.types';

import type { WorkoutWriteCoordinator } from '../services/workoutWriteCoordinator.service';

export function saveWorkoutSet(
  coordinator: WorkoutWriteCoordinator,
  setId: string,
): Promise<WorkoutSet | null> {
  return coordinator.flushSet(setId);
}
