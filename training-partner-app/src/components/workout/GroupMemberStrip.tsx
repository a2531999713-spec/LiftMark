import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { colors, radius, spacing } from '@/theme';

type GroupMemberStripProps = {
  currentMemberId: string;
  members: GroupMember[];
  onSelectMember: (memberId: string) => void;
  profiles?: Record<string, MemberProfile | null>;
  restStates?: Record<string, { remaining: number; status: 'ready' | 'resting' } | undefined>;
};

function formatShortRest(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const minutes = Math.floor(safeSeconds / 60);
  const remain = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

export function GroupMemberStrip({
  currentMemberId,
  members,
  onSelectMember,
  profiles = {},
  restStates = {},
}: GroupMemberStripProps) {
  return (
    <View style={styles.container}>
      {members.map((member) => {
        const isCurrent = member.id === currentMemberId;
        const restState = restStates[member.id];
        const statusLabel = restState
            ? restState.status === 'ready'
            ? '可开始'
            : formatShortRest(restState.remaining)
          : isCurrent
            ? '当前'
            : '待记录';

        return (
          <Pressable
            accessibilityRole="button"
            key={member.id}
            onPress={() => onSelectMember(member.id)}
            style={styles.memberSlot}
          >
            <View style={isCurrent && styles.avatarActive}>
              <Avatar
                avatarLocalUri={profiles[member.id]?.avatarLocalUri}
                avatarThumbUrl={profiles[member.id]?.avatarThumbUrl}
                avatarUrl={profiles[member.id]?.avatarUrl ?? member.avatarUrl}
                name={member.displayName}
                size={44}
              />
            </View>
            <AppText
              tone="default"
              variant="caption"
              weight="800"
              numberOfLines={1}
              style={styles.memberName}
            >
              {member.displayName}
            </AppText>
            <View
              style={[
                styles.statusBadge,
                isCurrent && styles.statusBadgeCurrent,
                restState?.status === 'ready' && styles.statusBadgeReady,
              ]}
            >
              <AppText
                tone={isCurrent || restState ? 'brand' : 'muted'}
                variant="caption"
                weight="900"
                style={styles.statusBadgeText}
              >
                {statusLabel}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    paddingBottom: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm,
  },
  memberSlot: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xxs,
    minHeight: 66,
    minWidth: 0,
  },
  avatarActive: {
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.brand,
  },
  memberName: {
    maxWidth: '100%',
  },
  statusBadge: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    minHeight: 18,
    paddingHorizontal: spacing.xs,
    paddingVertical: 0,
  },
  statusBadgeCurrent: {
    backgroundColor: colors.primarySoft,
  },
  statusBadgeReady: {
    backgroundColor: colors.successSoft,
  },
  statusBadgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
