import type { ID } from '@/domain/common/ids';
import type {
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  AddWorkoutSetsBatchInput,
  ApplyRecoveryWeightReductionInput,
  ApplyRecoveryWeightReductionResult,
  CompleteWorkoutSessionAtomicInput,
  CompleteWorkoutSessionAtomicResult,
  CreateSessionFromTodayPlanInput,
  CreateManualSessionInput,
  CreateManualSessionV2Input,
  DeleteWorkoutSetsBatchInput,
  ListOpenWorkoutSessionsForDateInput,
  ListHistorySessionsByScopeInput,
  ListSessionsInput,
  SaveWorkoutSetInput,
  SaveWorkoutSetPatchesBatchInput,
  UpdateWorkoutSessionInput,
  WorkoutSessionAggregation,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSet,
} from '@/domain/workout/workout.types';

export interface WorkoutRepository {
  applyRecoveryWeightReduction(input: ApplyRecoveryWeightReductionInput): Promise<ApplyRecoveryWeightReductionResult>;
  createSessionFromTodayPlan(input: CreateSessionFromTodayPlanInput): Promise<WorkoutSession>;
  createManualSession(input: CreateManualSessionInput): Promise<WorkoutSession>;
  createManualSessionV2(input: CreateManualSessionV2Input): Promise<WorkoutSession>;
  getSession(sessionId: ID): Promise<WorkoutSession | null>;
  getSessionDetail(sessionId: ID): Promise<WorkoutSessionDetail>;
  listOpenSessionsForDate(input: ListOpenWorkoutSessionsForDateInput): Promise<WorkoutSession[]>;
  updateSession(input: UpdateWorkoutSessionInput): Promise<WorkoutSession>;
  addExerciseToSession(input: AddWorkoutExerciseInput): Promise<WorkoutSessionDetail>;
  addSetToExerciseRecord(input: AddWorkoutSetInput): Promise<WorkoutSet>;
  addSetsToExerciseRecordsBatch(input: AddWorkoutSetsBatchInput): Promise<WorkoutSet[]>;
  updateExerciseRecordExercise(recordId: ID, exerciseId: ID, notes?: string): Promise<void>;
  saveSet(input: SaveWorkoutSetInput): Promise<WorkoutSet>;
  saveSetPatchesBatch(input: SaveWorkoutSetPatchesBatchInput): Promise<WorkoutSet[]>;
  completeSessionAtomic(input: CompleteWorkoutSessionAtomicInput): Promise<CompleteWorkoutSessionAtomicResult>;
  deleteSet(setId: ID): Promise<void>;
  deleteSetsBatch(input: DeleteWorkoutSetsBatchInput): Promise<void>;
  deleteMemberSet(setId: ID, memberId: ID): Promise<void>;
  deleteExerciseRecord(recordId: ID): Promise<void>;
  deleteSession(sessionId: ID): Promise<void>;
  deleteMemberSetsInSession(sessionId: ID, memberId: ID): Promise<void>;
  deleteSessionCascade(sessionId: ID): Promise<void>;
  cleanupEmptyExerciseRecords(sessionId: ID): Promise<void>;
  getSessionAggregation(sessionId: ID): Promise<WorkoutSessionAggregation>;
  finishSession(sessionId: ID): Promise<void>;
  generateTrainingReport(sessionId: ID): Promise<void>;
  listHistorySessionsByScope(input: ListHistorySessionsByScopeInput): Promise<WorkoutSession[]>;
  listSessions(input: ListSessionsInput): Promise<WorkoutSession[]>;
}
