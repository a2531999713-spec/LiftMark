import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';

import type { WorkoutSessionStatus } from './workoutSession.state';

export type WorkoutSessionAction =
  | {
      type: 'loaded';
      detail: WorkoutSessionDetail;
      participants: GroupMember[];
      profiles: Record<string, MemberProfile | null>;
      exercises: Record<string, Exercise>;
      activeParticipantId: string | null;
      activeExerciseIndex: number;
    }
  | { type: 'statusChanged'; status: WorkoutSessionStatus }
  | { type: 'detailChanged'; detail: WorkoutSessionDetail }
  | { type: 'writeQueued'; setId: string }
  | { type: 'writeFinished'; setId: string; savedAt?: string }
  | { type: 'recoverableError'; message: string | null }
  | { type: 'sheetChanged'; sheet: 'adjustment' | 'participant' | 'exercisePicker'; visible: boolean };
