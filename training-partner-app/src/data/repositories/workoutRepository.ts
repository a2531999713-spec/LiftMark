import type { ID } from '@/domain/common/ids';
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  CreateSessionFromTodayPlanInput,
  CreateManualSessionInput,
  ListOpenWorkoutSessionsForDateInput,
  ListHistorySessionsByScopeInput,
  ListSessionsInput,
  SaveWorkoutSetInput,
  UpdateWorkoutSessionInput,
  WorkoutSessionAggregation,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSet,
  WorkoutSummary,
} from '@/domain/workout/workout.types';

export interface WorkoutRepository {
  createSessionFromTodayPlan(input: CreateSessionFromTodayPlanInput): Promise<WorkoutSession>;
  createManualSession(input: CreateManualSessionInput): Promise<WorkoutSession>;
  getSession(sessionId: ID): Promise<WorkoutSession | null>;
  getSessionDetail(sessionId: ID): Promise<WorkoutSessionDetail>;
  listOpenSessionsForDate(input: ListOpenWorkoutSessionsForDateInput): Promise<WorkoutSession[]>;
  updateSession(input: UpdateWorkoutSessionInput): Promise<WorkoutSession>;
  addExerciseToSession(input: AddWorkoutExerciseInput): Promise<WorkoutSessionDetail>;
  addSetToExerciseRecord(input: AddWorkoutSetInput): Promise<WorkoutSet>;
  updateExerciseRecordExercise(recordId: ID, exerciseId: ID, notes?: string): Promise<void>;
  saveSet(input: SaveWorkoutSetInput): Promise<WorkoutSet>;
  deleteSet(setId: ID): Promise<void>;
  deleteMemberSet(setId: ID, memberId: ID): Promise<void>;
  deleteExerciseRecord(recordId: ID): Promise<void>;
  deleteSession(sessionId: ID): Promise<void>;
  deleteMemberSetsInSession(sessionId: ID, memberId: ID): Promise<void>;
  deleteSessionCascade(sessionId: ID): Promise<void>;
  cleanupEmptyExerciseRecords(sessionId: ID): Promise<void>;
  getSessionAggregation(sessionId: ID): Promise<WorkoutSessionAggregation>;
  finishSession(sessionId: ID): Promise<WorkoutSummary>;
  listHistorySessionsByScope(input: ListHistorySessionsByScopeInput): Promise<WorkoutSession[]>;
  listSessions(input: ListSessionsInput): Promise<WorkoutSession[]>;
}
