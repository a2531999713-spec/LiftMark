import type { ID } from '@/domain/common/ids';
import type { CreateMemberInput, GroupMember, MemberProfile } from '@/domain/member/member.types';

export interface MemberRepository {
  listMembers(groupId: ID): Promise<GroupMember[]>;
  getMemberProfile(memberId: ID): Promise<MemberProfile | null>;
  createMember(input: CreateMemberInput): Promise<GroupMember>;
  updateMember(id: ID, patch: Partial<GroupMember>): Promise<GroupMember>;
  updateProfile(memberId: ID, patch: Partial<MemberProfile>): Promise<MemberProfile>;
}
