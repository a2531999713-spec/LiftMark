import type { Exercise } from '@/domain/exercise/exercise.types';
import type { ExercisePriority, PlanTemplate, Weekday } from '@/domain/plan/plan.types';

export type PlanExerciseDraft = {
  exerciseId: string;
  id: string;
  orderIndex: number;
  priority: ExercisePriority;
  reps: number;
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
