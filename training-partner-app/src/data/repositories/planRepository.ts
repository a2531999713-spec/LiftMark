import type { ID } from '@/domain/common/ids';
import type { Exercise, ExerciseAlternative } from '@/domain/exercise/exercise.types';
import type { SystemTrainingScheme } from '@/domain/plan/systemSchemes';
import type {
  GetTodayPlanInput,
  IntensityType,
  PlanCycle,
  PlanCycleOverview,
  PlanCycleSummary,
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  ReferenceLift,
  TodayPlanResult,
} from '@/domain/plan/plan.types';

export type CopySystemSchemeToUserPlanInput = {
  scheme: SystemTrainingScheme;
  name: string;
};

export type CreateUserPlanDayInput = {
  title: string;
  focus: string;
  week?: number;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  exercises: {
    exerciseId: ID;
    fixedWeight?: number | null;
    intensityType?: IntensityType;
    notes?: string | null;
    percent1RM?: number | null;
    priority?: 'A' | 'B' | 'C';
    referenceLift?: ReferenceLift | null;
    repMax?: number | null;
    repMin?: number | null;
    reps?: number | null;
    restSeconds?: number | null;
    sets?: number | null;
  }[];
};

export type CreateUserPlanInput = {
  name: string;
  goal: PlanTemplate['goal'];
  durationWeeks: number;
  frequencyPerWeek: number;
  days: CreateUserPlanDayInput[];
};

export type UpdateUserPlanInput = CreateUserPlanInput & {
  planId: ID;
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
  getActivePlanCycle(input: GetActivePlanCycleInput): Promise<PlanCycle | null>;
  getPlanCycleSummary(planCycleId: ID): Promise<PlanCycleSummary | null>;
  getPlanCycleOverview(planCycleId: ID): Promise<PlanCycleOverview>;
  listUserPlans(): Promise<PlanTemplate[]>;
  listPlanCycles(input: ListPlanCyclesInput): Promise<PlanCycle[]>;
  listPlanPhases(planId: ID): Promise<PlanPhase[]>;
  listPlanDays(planId: ID): Promise<PlanDay[]>;
  listPlanExercises(planDayId: ID): Promise<PlanExercise[]>;
  createUserPlan(input: CreateUserPlanInput): Promise<PlanTemplate>;
  updateUserPlan(input: UpdateUserPlanInput): Promise<PlanTemplate>;
  copySystemSchemeToUserPlan(input: CopySystemSchemeToUserPlanInput): Promise<PlanTemplate>;
  duplicatePlan(input: DuplicatePlanInput): Promise<PlanTemplate>;
  importUserPlan(input: ImportUserPlanInput): Promise<PlanTemplate>;
  archivePlanCycle(input: ArchivePlanCycleInput): Promise<PlanCycleSummary>;
  completePlanCycle(input: CompletePlanCycleInput): Promise<PlanCycleSummary>;
  recalculatePlanCycleSummary(planCycleId: ID): Promise<PlanCycleSummary>;
  deleteUserPlan(planId: ID): Promise<void>;
  getTodayPlan(input: GetTodayPlanInput): Promise<TodayPlanResult>;
}

export type DuplicatePlanInput = {
  sourcePlanId: ID;
  name?: string;
};

export type GetActivePlanCycleInput = {
  groupId: ID;
  planId: ID;
};

export type ListPlanCyclesInput = {
  groupId?: ID;
  planId?: ID;
  status?: PlanCycle['status'];
};

export type ArchivePlanCycleInput = {
  planCycleId: ID;
};

export type CompletePlanCycleInput = {
  planCycleId: ID;
};
