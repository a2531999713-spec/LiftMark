import type { WorkoutRepository } from '@/data/repositories/workoutRepository';
import type { CreateSessionFromTodayPlanInput, WorkoutSession } from '@/domain/workout/workout.types';

export async function startWorkout(
  repository: WorkoutRepository,
  input: CreateSessionFromTodayPlanInput,
): Promise<WorkoutSession> {
  return repository.createSessionFromTodayPlan(input);
}
