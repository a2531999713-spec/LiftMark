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

export type ExerciseSource = 'system' | 'custom' | 'imported';

export type Exercise = {
  id: ID;
  name: string;
  sourceId?: string;
  nameZh?: string;
  nameEn?: string;
  aliases?: string;
  source: ExerciseSource;
  category: ExerciseCategory;
  movementPattern: MovementPattern;
  forceType?: string;
  targetMuscle: string;
  primaryMuscle?: string;
  secondaryMuscle?: string;
  secondaryMuscles?: string;
  equipment: Equipment;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  isUnilateral?: boolean;
  isBodyweight?: boolean;
  defaultUnit?: string;
  instructionsZh?: string;
  instructionsEn?: string;
  tips?: string;
  thumbnailUrl?: string;
  gifUrl?: string;
  videoUrl?: string;
  localAssetPath?: string;
  mediaSource?: string;
  mediaLicense?: string;
  mediaAttribution?: string;
  mediaUsageStatus?: string;
  iconKey?: string;
  heatmapKey?: string;
  muscleActivationJson?: string;
  isSystem?: boolean;
  isCustom?: boolean;
  createdByUserId?: ID;
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
