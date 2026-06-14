import type { ID } from '@/domain/common/ids';
import type { Exercise, ExerciseAlternative } from '@/domain/exercise/exercise.types';
import type { SystemTrainingScheme } from '@/domain/plan/systemSchemes';
import type {
  GetTodayPlanInput,
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  TodayPlanResult,
} from '@/domain/plan/plan.types';

export type CopySystemSchemeToUserPlanInput = {
  scheme: SystemTrainingScheme;
  name: string;
};

export type CreateUserPlanDayInput = {
  title: string;
  focus: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  exercises: {
    exerciseId: ID;
    priority?: 'A' | 'B' | 'C';
    sets: number;
    reps: number;
    rpeTarget?: number;
    rirTarget?: number;
  }[];
};

export type CreateUserPlanInput = {
  name: string;
  goal: PlanTemplate['goal'];
  durationWeeks: number;
  frequencyPerWeek: number;
  days: CreateUserPlanDayInput[];
};

export type ImportUserPlanInput = {
  alternatives: ExerciseAlternative[];
  days: PlanDay[];
  exercises: Exercise[];
  phases: PlanPhase[];
  planExercises: PlanExercise[];
  template: PlanTemplate;
};

export interface PlanRepository {
  getPlanById(planId: ID): Promise<PlanTemplate | null>;
  listUserPlans(): Promise<PlanTemplate[]>;
  listPlanPhases(planId: ID): Promise<PlanPhase[]>;
  listPlanDays(planId: ID): Promise<PlanDay[]>;
  listPlanExercises(planDayId: ID): Promise<PlanExercise[]>;
  createUserPlan(input: CreateUserPlanInput): Promise<PlanTemplate>;
  copySystemSchemeToUserPlan(input: CopySystemSchemeToUserPlanInput): Promise<PlanTemplate>;
  importUserPlan(input: ImportUserPlanInput): Promise<PlanTemplate>;
  getTodayPlan(input: GetTodayPlanInput): Promise<TodayPlanResult>;
}
