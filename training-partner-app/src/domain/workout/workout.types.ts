import type { ID } from '../common/ids';
import type { ExercisePriority, Weekday } from '../plan/plan.types';

export type SessionStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type WorkoutTrainingMode = 'solo_local' | 'group_local';

export const FREE_TRAINING_PLAN_ID = 'free_training';

export type WorkoutSession = {
  id: ID;
  groupId: ID;
  planId: ID;
  planCycleId?: ID;
  planDayId?: ID;
  phaseId?: ID;
  date: string;
  week: number;
  weekday: Weekday;
  title: string;
  status: SessionStatus;
  trainingMode: WorkoutTrainingMode;
  recordedByUserId?: ID;
  sourceDeviceId?: string;
  startedAt?: string;
  finishedAt?: string;
  /** Selection snapshot populated for open-session matching. */
  participantMemberIds?: ID[];
  /** Selection snapshot populated for open-session matching. */
  planExerciseIds?: ID[];
  createdAt: string;
  updatedAt: string;
};

export type WorkoutExerciseRecord = {
  id: ID;
  sessionId: ID;
  planCycleId?: ID;
  planDayId?: ID;
  planExerciseId?: ID;
  exerciseId: ID;
  orderIndex: number;
  replacedFromExerciseId?: ID;
  priority: ExercisePriority;
  plannedSets?: number;
  plannedReps?: number;
  plannedRepMin?: number;
  plannedRepMax?: number;
  /** Legacy compatibility only. New training flows do not display or create this value. */
  plannedRpe?: number;
  /** Legacy compatibility only. New training flows do not display or create this value. */
  plannedRir?: number;
  plannedPercent1RM?: number;
  plannedRestSeconds?: number;
  notes?: string;
};

export type WorkoutSet = {
  id: ID;
  sessionId: ID;
  exerciseRecordId: ID;
  memberId: ID;
  recordedByUserId?: ID;
  sourceDeviceId?: string;
  setNumber: number;
  plannedWeight?: number;
  actualWeight?: number;
  plannedReps?: number;
  actualReps?: number;
  /** Optional advanced record: self-reported effort from 1 to 10. */
  rpe?: number;
  /** Legacy compatibility only. New training flows keep this hidden. */
  rir?: number;
  actualRestSeconds?: number;
  completed: boolean;
  skipped?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateSessionFromTodayPlanInput = {
  groupId: ID;
  planId: ID;
  planCycleId?: ID;
  planDayId?: ID;
  phaseId?: ID;
  date: string;
  week: number;
  weekday: Weekday;
  title: string;
  planExerciseIds?: ID[];
  participantMemberIds?: ID[];
  trainingMode?: WorkoutTrainingMode;
};

export type ApplyRecoveryWeightReductionInput = {
  memberIds: ID[];
  reductionPercent?: number;
  sessionId: ID;
};

export type ApplyRecoveryWeightReductionResult = {
  skippedSetCount: number;
  updatedSetCount: number;
};

export type CreateManualSessionInput = {
  groupId: ID;
  planId?: ID | null;
  planCycleId?: ID | null;
  date: string;
  title: string;
  memberId: ID;
  exerciseId?: ID;
  exercises?: ManualWorkoutExerciseInput[];
  setCount?: number;
  weight?: number;
  reps?: number;
  restSeconds?: number | null;
  completed?: boolean;
};

export type ManualWorkoutSetInput = {
  completed?: boolean;
  notes?: string | null;
  reps?: number;
  rpe?: number | null;
  rir?: number | null;
  skipped?: boolean;
  weight?: number;
};

export type ManualWorkoutExerciseInput = {
  exerciseId: ID;
  notes?: string;
  priority?: ExercisePriority;
  restSeconds?: number | null;
  sets: ManualWorkoutSetInput[];
};

export type ManualWorkoutMemberSetsInput = {
  memberId: ID;
  sets: (ManualWorkoutSetInput & {
    setIndex?: number;
  })[];
};

export type ManualWorkoutExerciseV2Input = {
  exerciseId: ID;
  memberSets: ManualWorkoutMemberSetsInput[];
  notes?: string | null;
  plannedRepMax?: number | null;
  plannedRepMin?: number | null;
  plannedReps?: number | null;
  plannedRestSeconds?: number | null;
  plannedSets?: number | null;
  priority?: ExercisePriority;
};

export type CreateManualSessionV2Input = {
  date: string;
  exercises: ManualWorkoutExerciseV2Input[];
  groupId: ID;
  notes?: string | null;
  participantMemberIds: ID[];
  planId?: ID | null;
  planCycleId?: ID | null;
  sourcePlanId?: ID | null;
  title: string;
  trainingMode: WorkoutTrainingMode;
  completed?: boolean;
};

export type AddWorkoutExerciseInput = {
  exerciseId: ID;
  insertOrderIndex?: number;
  memberId: ID;
  memberIds?: ID[];
  notes?: string;
  priority?: ExercisePriority;
  sessionId: ID;
  sets?: ManualWorkoutSetInput[];
};

export type AddWorkoutSetInput = ManualWorkoutSetInput & {
  completed?: boolean;
  exerciseRecordId: ID;
  memberId: ID;
  sessionId: ID;
};

export type UpdateWorkoutSessionInput = {
  id: ID;
  date?: string;
  title?: string;
  status?: SessionStatus;
};

export type WorkoutSessionDetail = {
  session: WorkoutSession;
  exercises: WorkoutExerciseRecord[];
  sets: WorkoutSet[];
};

export type SaveWorkoutSetInput = Partial<
  Pick<
    WorkoutSet,
    'actualWeight' | 'actualReps' | 'actualRestSeconds' | 'completed' | 'notes' | 'plannedWeight' | 'rpe' | 'skipped'
  >
> & {
  id: ID;
};

export type SaveWorkoutSetPatch = Omit<SaveWorkoutSetInput, 'id'>;

export type SaveWorkoutSetPatchesBatchInput = {
  patches: SaveWorkoutSetInput[];
  sessionId: ID;
};

export type CompleteWorkoutSessionAtomicInput = SaveWorkoutSetPatchesBatchInput & {
  finishedAt?: string;
};

export type CompleteWorkoutSessionAtomicResult = {
  session: WorkoutSession;
  sets: WorkoutSet[];
};

export type AddWorkoutSetsBatchInput = {
  sessionId: ID;
  sets: AddWorkoutSetInput[];
};

export type DeleteWorkoutSetsBatchInput = {
  sessionId: ID;
  setIds: ID[];
};

export type WorkoutSummary = {
  sessionId: ID;
  completedSets: number;
  durationSeconds: number;
  estimatedCalories?: number;
  estimatedCaloriesMax?: number;
  estimatedCaloriesMin?: number;
  exerciseCount: number;
  intensityLevel?: 'low' | 'medium' | 'high';
  reportId?: ID;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
};

export type WorkoutMemberContribution = {
  completedSets: number;
  memberId: ID;
  sessionCount: number;
  totalSets: number;
  volume: number;
};

export type WorkoutSessionAggregation = {
  completedSets: number;
  memberContributions: WorkoutMemberContribution[];
  participantCount: number;
  sessionId: ID;
  totalSets: number;
  totalVolume: number;
};

export type ListSessionsInput = {
  groupId?: ID;
  memberId?: ID;
  planCycleId?: ID;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type ListHistorySessionsByScopeInput = ListSessionsInput & {
  scope: 'personal' | 'group';
};

export type ListOpenWorkoutSessionsForDateInput = {
  date: string;
  groupId: ID;
};
