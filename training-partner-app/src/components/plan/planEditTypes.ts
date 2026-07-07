import type { Exercise } from '@/domain/exercise/exercise.types';
import type { ExercisePriority, IntensityType, PlanTemplate, ReferenceLift, Weekday } from '@/domain/plan/plan.types';

export type PlanExerciseDraft = {
  fixedWeight?: number | null;
  exerciseId: string;
  id: string;
  intensityType: IntensityType;
  notes?: string;
  orderIndex: number;
  percent1RM?: number | null;
  priority: ExercisePriority;
  referenceLift: ReferenceLift;
  repMax?: number | null;
  repMin?: number | null;
  reps?: number | null;
  restSeconds?: number | null;
  sets: number;
};

export type PlanDayDraft = {
  exercises: PlanExerciseDraft[];
  focus: string;
  id: string;
  title: string;
  week: number;
  weekday: Weekday;
};

export type PlanEditDraft = {
  days: PlanDayDraft[];
  durationWeeks: number;
  frequencyPerWeek: number;
  goal: PlanTemplate['goal'];
  name: string;
};

export type PlanExerciseMap = Record<string, Exercise>;
