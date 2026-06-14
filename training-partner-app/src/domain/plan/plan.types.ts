import type { ID } from '../common/ids';

export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type PhaseType = 'strength' | 'hypertrophy' | 'deload' | 'conditioning' | 'custom';

export type ExercisePriority = 'A' | 'B' | 'C';

export type IntensityType = 'percent_1rm' | 'rpe' | 'rir' | 'fixed' | 'manual';

export type ReferenceLift =
  | 'bench'
  | 'squat'
  | 'deadlift'
  | 'overhead_press'
  | 'pullup_total'
  | 'none';

export type PlanTemplate = {
  id: ID;
  name: string;
  creatorId?: ID;
  visibility: 'system' | 'private' | 'group' | 'public';
  goal: 'strength' | 'hypertrophy' | 'fat_loss' | 'general' | 'custom';
  durationWeeks: number;
  frequencyPerWeek: number;
  description?: string;
  source: 'system' | 'user' | 'system_copy' | 'blank_created' | 'imported' | 'duplicated';
  originSchemeId?: ID;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type PlanPhase = {
  id: ID;
  planId: ID;
  name: string;
  type: PhaseType;
  startWeek: number;
  endWeek: number;
  orderIndex: number;
};

export type PlanDay = {
  id: ID;
  planId: ID;
  phaseId: ID;
  week: number;
  weekday: Weekday;
  title: string;
  focus: string;
  notes?: string;
};

export type PlanExercise = {
  id: ID;
  planDayId: ID;
  exerciseId: ID;
  priority: ExercisePriority;
  orderIndex: number;
  sets?: number;
  reps?: number;
  repMin?: number;
  repMax?: number;
  intensityType: IntensityType;
  percent1RM?: number;
  rpeTarget?: number;
  rirTarget?: number;
  fixedWeight?: number;
  referenceLift: ReferenceLift;
  restSeconds?: number;
  progressionRuleId?: ID;
  notes?: string;
};

export type GetTodayPlanInput = {
  groupId: ID;
  planId: ID;
  phaseType: PhaseType;
  currentWeek: number;
  weekday: Weekday;
  fridayEnabled: boolean;
  recoveryMode?: 'good' | 'normal' | 'bad' | 'very_bad';
};

export type TodayPlanResult = {
  plan: PlanTemplate;
  phase: PlanPhase;
  day: PlanDay | null;
  exercises: PlanExercise[];
  isRestDay: boolean;
  reason?: string;
};

export type CreatePlanTemplateInput = Omit<PlanTemplate, 'id' | 'createdAt' | 'updatedAt'> & {
  id?: ID;
};
