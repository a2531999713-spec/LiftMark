import type { PlanExercise } from '../plan/plan.types';
import type { WorkoutExerciseRecord, WorkoutSet, WorkoutSummary } from './workout.types';

export function getPlanExerciseSetCount(exercise: PlanExercise): number {
  return Math.max(1, exercise.sets ?? 1);
}

export function getPlanExerciseInitialReps(exercise: PlanExercise): number | undefined {
  return exercise.reps ?? exercise.repMin;
}

export function getWorkoutRecordInitialReps(record: WorkoutExerciseRecord): number | undefined {
  return record.plannedReps ?? record.plannedRepMin;
}

export function summarizeWorkoutSets(sessionId: string, sets: WorkoutSet[]): WorkoutSummary {
  return {
    sessionId,
    completedSets: sets.filter((set) => set.completed).length,
    totalSets: sets.length,
  };
}
