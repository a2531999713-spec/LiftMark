import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

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
  onSwitchGroupPress: () => void;
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
  onSwitchGroupPress,
  profiles,
}: CurrentGroupStartCardProps) {
  const visibleMembers = members.slice(0, 3);
  const names = members.slice(0, 2).map((member) => member.displayName).join('、');
  const overflowCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <View style={styles.card}>
      <View style={styles.groupSide}>
        <View style={styles.groupHeader}>
          <View style={styles.groupIcon}>
            <Ionicons color={colors.primary} name="people-outline" size={25} />
          </View>
          <View style={styles.groupText}>
            <AppText numberOfLines={1} variant="subtitle" weight="900">
              {groupName}
            </AppText>
            <AppText numberOfLines={1} tone="muted" variant="bodySmall">
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
                size={34}
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
          <Pressable accessibilityRole="button" onPress={onSwitchGroupPress} style={styles.switchButton}>
            <AppText tone="muted" variant="caption" weight="800">
              切换小组
            </AppText>
            <Ionicons color={colors.textMuted} name="chevron-forward" size={13} />
          </Pressable>
        </View>
      </View>

      <AppButton
        disabled={disabled}
        icon="play"
        loading={isStarting}
        onPress={onStartPress}
        size="md"
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
    borderRadius: radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  groupSide: {
    flex: 1,
    gap: spacing.md,
    minWidth: 0,
  },
  groupText: {
    flex: 1,
    gap: spacing.xs,
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
    marginLeft: -10,
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
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  startButton: {
    maxWidth: 190,
    minWidth: 150,
  },
  switchButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    marginLeft: spacing.sm,
    minHeight: 34,
  },
});
