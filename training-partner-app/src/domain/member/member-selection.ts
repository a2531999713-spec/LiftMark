import type { GroupMember } from './member.types';

function isLocalTrainingIdentity(member: GroupMember): boolean {
  return member.memberType === 'local' || Boolean(member.localMemberId) || !member.userId;
}

export function resolveDefaultTrainingMember(
  members: GroupMember[],
  currentUserId?: string | null,
): GroupMember | null {
  return (
    members.find(isLocalTrainingIdentity) ??
    (currentUserId ? members.find((member) => member.userId === currentUserId) : undefined) ??
    members[0] ??
    null
  );
}

export function resolveDefaultTrainingMemberId(
  members: GroupMember[],
  currentUserId?: string | null,
): string | undefined {
  return resolveDefaultTrainingMember(members, currentUserId)?.id;
}
