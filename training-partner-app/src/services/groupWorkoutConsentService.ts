import type { GroupMember } from '@/domain/member/member.types';
import type {
  GroupWorkoutConsentMember,
  GroupWorkoutConsentStatus,
  GroupWorkoutConsentSummary,
} from '@/domain/sync/workoutSync.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';

export function getConsentStatusLabel(status: GroupWorkoutConsentStatus): string {
  if (status === 'current_member_pending_sync') return '可同步';
  if (status === 'pending_member_consent') return '待确认';
  return '仅本机';
}

export function getConsentStatusTone(status: GroupWorkoutConsentStatus): 'brand' | 'warning' | 'neutral' {
  if (status === 'current_member_pending_sync') return 'brand';
  if (status === 'pending_member_consent') return 'warning';
  return 'neutral';
}

export function buildGroupWorkoutConsentSummary(
  detail: WorkoutSessionDetail,
  members: GroupMember[],
  currentMemberId?: string,
): GroupWorkoutConsentSummary {
  const participantIds = [...new Set(detail.sets.map((set) => set.memberId))];
  const participantMembers = members.filter((member) => participantIds.includes(member.id));
  const fallbackCurrentMemberId = currentMemberId ?? participantMembers[0]?.id;

  const consentMembers: GroupWorkoutConsentMember[] = participantMembers.map((member) => {
    const isCurrent = member.id === fallbackCurrentMemberId;
    return {
      memberId: member.id,
      memberName: member.displayName,
      status: isCurrent ? 'current_member_pending_sync' : 'pending_member_consent',
      description: isCurrent
        ? '当前设备记录者，可在账号同步开启后上传。'
        : '需要成员本人确认后，才能写入对方账号数据；确认前仅保存在本机。',
    };
  });

  return {
    hasOtherMembers: consentMembers.some((member) => member.memberId !== fallbackCurrentMemberId),
    members: consentMembers,
    primaryMessage:
      detail.session.trainingMode === 'group_local' && consentMembers.length > 1
        ? '这是小组训练记录。其他成员数据确认前只保存在本机，不会自动写入对方账号。'
        : '这是个人本机记录，不需要成员确认。',
  };
}

export function requestMemberConsentPlaceholder(): string {
  return '确认请求已进入预留流程。当前版本先保存在本机，成员确认和服务器同步将在后续版本接入。';
}
