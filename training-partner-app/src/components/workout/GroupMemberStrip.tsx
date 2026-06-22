import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { GroupMember } from '@/domain/member/member.types';
import { colors, radius, spacing } from '@/theme';

type GroupMemberStripProps = {
  currentMemberId: string;
  members: GroupMember[];
  onSelectMember: (memberId: string) => void;
};

export function GroupMemberStrip({ currentMemberId, members, onSelectMember }: GroupMemberStripProps) {
  return (
    <View style={styles.container}>
      {members.map((member) => {
        const isCurrent = member.id === currentMemberId;

        return (
          <Pressable
            accessibilityRole="button"
            key={member.id}
            onPress={() => onSelectMember(member.id)}
            style={styles.memberSlot}
          >
            <View
              style={[
                styles.avatar,
                isCurrent && styles.avatarActive,
              ]}
            >
              <AppText
                tone="default"
                variant="caption"
                weight="800"
              >
                {member.displayName.slice(0, 1)}
              </AppText>
            </View>
            <AppText
              tone="default"
              variant="caption"
              weight="800"
              numberOfLines={1}
            >
              {member.displayName}
            </AppText>
            {isCurrent ? (
              <View style={styles.currentBadge}>
                <AppText tone="brand" variant="caption" weight="900" style={styles.currentBadgeText}>
                  当前
                </AppText>
              </View>
            ) : null}
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
  avatar: {
    alignItems: 'center',
    backgroundColor: '#D8E0E7',
    borderColor: colors.transparent,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  avatarActive: {
    borderColor: colors.brand,
  },
  currentBadge: {
    borderRadius: radius.pill,
    paddingVertical: 0,
  },
  currentBadgeText: {
    fontSize: 12,
    lineHeight: 16,
  },
});
