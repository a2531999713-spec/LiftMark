import type { ID } from '../common/ids';

export type GroupMemberRole = 'owner' | 'member' | 'coach' | 'guest';
export type GroupMemberType = 'local' | 'real';

export type GroupMember = {
  id: ID;
  groupId: ID;
  displayName: string;
  userId?: ID;
  memberType: GroupMemberType;
  localMemberId?: ID;
  role: GroupMemberRole;
  avatarUrl?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type MemberProfile = {
  id: ID;
  memberId: ID;
  groupId: ID;
  avatarUrl?: string;
  avatarThumbUrl?: string;
  avatarLocalUri?: string;
  avatarUpdatedAt?: string;
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
  userId?: ID;
  memberType?: GroupMemberType;
  localMemberId?: ID;
  role?: GroupMemberRole;
  avatarUrl?: string;
  profile?: Partial<Omit<MemberProfile, 'id' | 'memberId' | 'groupId' | 'createdAt' | 'updatedAt'>>;
};
