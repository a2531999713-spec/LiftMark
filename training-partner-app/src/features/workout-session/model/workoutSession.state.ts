import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';

export type WorkoutSessionStatus =
  | 'loading'
  | 'ready'
  | 'recording'
  | 'saving'
  | 'resting'
  | 'finishing'
  | 'finished'
  | 'error';

export type WorkoutSessionState = {
  status: WorkoutSessionStatus;
  detail: WorkoutSessionDetail | null;
  participants: GroupMember[];
  profiles: Record<string, MemberProfile | null>;
  exercises: Record<string, Exercise>;
  activeParticipantId: string | null;
  activeExerciseIndex: number;
  pendingWriteIds: string[];
  adjustmentSheetVisible: boolean;
  participantSheetVisible: boolean;
  exercisePickerVisible: boolean;
  recoverableError: string | null;
  lastSavedAt: string | null;
};

export const initialWorkoutSessionState: WorkoutSessionState = {
  status: 'loading',
  detail: null,
  participants: [],
  profiles: {},
  exercises: {},
  activeParticipantId: null,
  activeExerciseIndex: 0,
  pendingWriteIds: [],
  adjustmentSheetVisible: false,
  participantSheetVisible: false,
  exercisePickerVisible: false,
  recoverableError: null,
  lastSavedAt: null,
};
