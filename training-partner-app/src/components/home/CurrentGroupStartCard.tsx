import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppButton, AppText } from '@/components/ui';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { colors, radius, shadows, spacing } from '@/theme';

type CurrentGroupStartCardProps = {
  buttonLabel: string;
  currentMemberId?: string;
  disabled?: boolean;
  groupName: string;
  isStarting?: boolean;
  members: GroupMember[];
  onStartPress: () => void;
  profiles: Record<string, MemberProfile | null>;
};

export function CurrentGroupStartCard({
  buttonLabel,
  currentMemberId,
  disabled = false,
  groupName,
  isStarting = false,
  members,
  onStartPress,
  profiles,
}: CurrentGroupStartCardProps) {
  const visibleMembers = members.slice(0, 3);
  const names = members
    .slice(0, 2)
    .map((member) => member.displayName)
    .join('、');
  const overflowCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <View style={styles.card}>
      <View style={styles.groupSide}>
        <View style={styles.groupHeader}>
          <View style={styles.groupIcon}>
            <Ionicons color={colors.primary} name="people-outline" size={20} />
          </View>
          <View style={styles.groupText}>
            <AppText numberOfLines={1} variant="subtitle" weight="900">
              {groupName}
            </AppText>
            <AppText numberOfLines={1} tone="muted" variant="caption">
              {members.length} 位成员{names ? ` · ${names}` : ''}
            </AppText>
          </View>
        </View>

        <View style={styles.memberRow}>
          {visibleMembers.map((member, index) => (
            <View
              key={member.id}
              style={[
                styles.memberAvatar,
                index > 0 && styles.memberAvatarOverlap,
                member.id === currentMemberId && styles.memberAvatarActive,
              ]}
            >
              <Avatar
                avatarLocalUri={profiles[member.id]?.avatarLocalUri}
                avatarThumbUrl={profiles[member.id]?.avatarThumbUrl}
                avatarUrl={profiles[member.id]?.avatarUrl ?? member.avatarUrl}
                name={member.displayName}
                size={30}
              />
            </View>
          ))}
          {overflowCount > 0 ? (
            <View style={[styles.overflowAvatar, visibleMembers.length > 0 && styles.memberAvatarOverlap]}>
              <AppText variant="caption" weight="900">
                +{overflowCount}
              </AppText>
            </View>
          ) : null}
        </View>
      </View>

      <AppButton
        disabled={disabled}
        icon="play"
        loading={isStarting}
        onPress={onStartPress}
        size="sm"
        style={styles.startButton}
      >
        {buttonLabel}
      </AppButton>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  groupSide: {
    flex: 1,
    gap: spacing.sm,
    minWidth: 0,
  },
  groupText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  memberAvatar: {
    backgroundColor: colors.surface,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  memberAvatarActive: {
    borderColor: colors.primary,
  },
  memberAvatarOverlap: {
    marginLeft: -9,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  overflowAvatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  startButton: {
    maxWidth: 168,
    minWidth: 142,
  },
});
