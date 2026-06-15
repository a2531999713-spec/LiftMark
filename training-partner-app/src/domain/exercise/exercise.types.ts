import type { ID } from '../common/ids';

export type ExerciseCategory =
  | 'chest'
  | 'back'
  | 'shoulder'
  | 'legs'
  | 'arms'
  | 'core'
  | 'calves'
  | 'full_body'
  | 'other';

export type MovementPattern =
  | 'horizontal_push'
  | 'vertical_push'
  | 'horizontal_pull'
  | 'vertical_pull'
  | 'squat'
  | 'hinge'
  | 'isolation'
  | 'carry'
  | 'core'
  | 'other';

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'smith'
  | 'other';

export type ExerciseSource = 'system' | 'custom';

export type Exercise = {
  id: ID;
  name: string;
  source: ExerciseSource;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  targetMuscle: string;
  secondaryMuscle?: string;
  equipment: Equipment;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type ExerciseAlternative = {
  id: ID;
  exerciseId: ID;
  alternativeExerciseId: ID;
  reason?: string;
};
