import type { ID } from '../common/ids';

export type GroupMemberRole = 'owner' | 'member' | 'coach' | 'guest';

export type GroupMember = {
  id: ID;
  groupId: ID;
  displayName: string;
  role: GroupMemberRole;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemberProfile = {
  id: ID;
  memberId: ID;
  groupId: ID;
  bodyweight?: number;
  bench1RM?: number;
  squat1RM?: number;
  deadlift1RM?: number;
  overheadPress1RM?: number;
  pullupReferenceWeight?: number;
  barbellIncrement: number;
  dumbbellIncrement: number;
  createdAt: string;
  updatedAt: string;
};

export type CreateMemberInput = {
  id?: ID;
  groupId: ID;
  displayName: string;
  role?: GroupMemberRole;
  avatarUrl?: string;
  profile?: Partial<Omit<MemberProfile, 'id' | 'memberId' | 'groupId' | 'createdAt' | 'updatedAt'>>;
};
