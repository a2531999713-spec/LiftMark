import type { ID } from '../common/ids';
import type { ExercisePriority, Weekday } from '../plan/plan.types';

export type SessionStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type WorkoutTrainingMode = 'solo_local' | 'group_local';

export type WorkoutSession = {
  id: ID;
  groupId: ID;
  planId: ID;
  phaseId?: ID;
  date: string;
  week: number;
  weekday: Weekday;
  title: string;
  status: SessionStatus;
  trainingMode: WorkoutTrainingMode;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkoutExerciseRecord = {
  id: ID;
  sessionId: ID;
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
  phaseId?: ID;
  date: string;
  week: number;
  weekday: Weekday;
  title: string;
  planExerciseIds?: ID[];
  participantMemberIds?: ID[];
  trainingMode?: WorkoutTrainingMode;
};

export type CreateManualSessionInput = {
  groupId: ID;
  planId: ID;
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
  notes?: string;
  reps?: number;
  weight?: number;
};

export type ManualWorkoutExerciseInput = {
  exerciseId: ID;
  notes?: string;
  priority?: ExercisePriority;
  restSeconds?: number | null;
  sets: ManualWorkoutSetInput[];
};

export type AddWorkoutExerciseInput = {
  exerciseId: ID;
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
    'actualWeight' | 'actualReps' | 'actualRestSeconds' | 'completed' | 'notes' | 'rpe' | 'skipped'
  >
> & {
  id: ID;
};

export type WorkoutSummary = {
  sessionId: ID;
  completedSets: number;
  totalSets: number;
};

export type ListSessionsInput = {
  groupId?: ID;
  memberId?: ID;
  fromDate?: string;
  toDate?: string;
  limit?: number;
};

export type ListOpenWorkoutSessionsForDateInput = {
  date: string;
  groupId: ID;
};
