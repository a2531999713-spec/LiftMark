import type { ID } from '@/domain/common/ids';

export type GroupWorkoutConsentStatus =
  | 'current_member_pending_sync'
  | 'pending_member_consent'
  | 'local_only';

export type GroupWorkoutConsentMember = {
  memberId: ID;
  memberName: string;
  status: GroupWorkoutConsentStatus;
  description: string;
};

export type GroupWorkoutConsentSummary = {
  hasOtherMembers: boolean;
  members: GroupWorkoutConsentMember[];
  primaryMessage: string;
};
