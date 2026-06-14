import type { ExercisePriority } from './plan.types';

export type RecoveryMode = 'good' | 'normal' | 'bad' | 'very_bad';

export function filterExercisesByRecovery<T extends { priority: ExercisePriority }>(
  exercises: T[],
  recoveryMode: RecoveryMode,
): T[] {
  if (recoveryMode === 'good') {
    return exercises;
  }

  if (recoveryMode === 'normal') {
    return exercises.filter((exercise) => exercise.priority !== 'C');
  }

  if (recoveryMode === 'bad') {
    return exercises.filter((exercise) => exercise.priority === 'A');
  }

  return [];
}
