export type TrainingGoal =
  | 'hypertrophy'
  | 'strength'
  | 'fat_loss'
  | 'beginner'
  | 'recovery';

export type TrainingDaysPerWeek = 2 | 3 | 4 | 5 | 'flexible';

export type TrainingExperience =
  | 'just_started'
  | 'under_3_months'
  | 'three_to_twelve_months'
  | 'over_one_year';

export type TrainingEquipment =
  | 'full_gym'
  | 'home_basic'
  | 'dumbbell_barbell'
  | 'unknown';

export type TrainingProfileDraft = {
  age?: number;
  bench1RM?: number;
  bodyweight?: number;
  deadlift1RM?: number;
  equipment: TrainingEquipment;
  experience: TrainingExperience;
  gender?: 'male' | 'female' | 'other';
  goal: TrainingGoal;
  heightCm?: number;
  nickname?: string;
  squat1RM?: number;
  trainingDaysPerWeek: TrainingDaysPerWeek;
};
