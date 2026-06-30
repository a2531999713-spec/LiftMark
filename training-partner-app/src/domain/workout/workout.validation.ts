import type { SaveWorkoutSetInput } from './workout.types';

export function validateWorkoutSetInput(input: SaveWorkoutSetInput): void {
  if (!input.id) {
    throw new Error('缺少训练组 ID。');
  }

  if (
    input.actualReps !== undefined &&
    (!Number.isInteger(input.actualReps) || input.actualReps < 0)
  ) {
    throw new Error('Actual reps must be a non-negative integer.');
  }

  if (
    input.actualWeight !== undefined &&
    (!Number.isFinite(input.actualWeight) || input.actualWeight < 0)
  ) {
    throw new Error('Actual weight must be a finite non-negative number.');
  }

  if (
    input.rpe !== undefined &&
    (!Number.isInteger(input.rpe) || input.rpe < 1 || input.rpe > 10)
  ) {
    throw new Error('RPE must be an integer from 1 to 10.');
  }

  if (
    input.actualRestSeconds !== undefined &&
    (!Number.isInteger(input.actualRestSeconds) || input.actualRestSeconds < 0)
  ) {
    throw new Error('Actual rest seconds must be a non-negative integer.');
  }
}
