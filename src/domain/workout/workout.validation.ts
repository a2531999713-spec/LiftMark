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

  if (input.rpe !== undefined && (input.rpe < 6 || input.rpe > 10)) {
    throw new Error('RPE must be empty or between 6 and 10.');
  }

  if (input.rir !== undefined && (input.rir < 0 || input.rir > 5)) {
    throw new Error('RIR must be empty or between 0 and 5.');
  }
}
