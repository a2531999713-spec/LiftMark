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

  if (input.actualWeight !== undefined && input.actualWeight < 0) {
    throw new Error('Actual weight cannot be negative.');
  }

}
