import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { GroupMember } from '@/domain/member/member.types';
import { colors, radius, spacing } from '@/theme';

type RotationOrderCardProps = {
  currentMemberId: string;
  members: GroupMember[];
  mode?: 'card' | 'dock';
  nextMemberName: string | undefined;
};

export function RotationOrderCard({
  currentMemberId,
  members,
  mode = 'card',
  nextMemberName,
}: RotationOrderCardProps) {
  if (members.length <= 1) {
    return null;
  }

  const currentMemberName = members.find((member) => member.id === currentMemberId)?.displayName ?? '成员';

  if (mode === 'dock') {
    return (
      <View style={styles.dock}>
        <View style={styles.dockTextGroup}>
          <AppText tone="muted" variant="caption" weight="700">
            当前轮换
          </AppText>
          <AppText variant="caption" weight="900">
            {currentMemberName}
            {nextMemberName ? ` → ${nextMemberName}` : ''}
          </AppText>
        </View>
        <View style={styles.dockQueue}>
          {members.map((member) => {
            const isCurrent = member.id === currentMemberId;

            return (
              <View key={member.id} style={[styles.dockChip, isCurrent && styles.dockChipActive]}>
                <AppText
                  tone={isCurrent ? 'inverse' : 'muted'}
                  variant="caption"
                  weight="900"
                  numberOfLines={1}
                >
                  {member.displayName.slice(0, 1)}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <AppCard style={styles.card}>
      <AppText variant="bodySmall" weight="700">
        当前轮换顺序
      </AppText>
      <View style={styles.orderRow}>
        {members.map((member, index) => {
          const isCurrent = member.id === currentMemberId;

          return (
            <View key={member.id} style={styles.orderItem}>
              {index > 0 ? (
                <AppText tone="subtle" variant="caption">
                  →
                </AppText>
              ) : null}
              <View style={[styles.namePill, isCurrent && styles.namePillActive]}>
                <AppText
                  tone={isCurrent ? 'inverse' : 'muted'}
                  variant="caption"
                  weight={isCurrent ? '900' : '700'}
                >
                  {member.displayName}
                </AppText>
              </View>
            </View>
          );
        })}
      </View>
      {nextMemberName ? (
        <View style={styles.nextRow}>
          <AppText tone="muted" variant="caption">
            下一位：
          </AppText>
          <AppText tone="brand" variant="caption" weight="700">
            {nextMemberName}
          </AppText>
        </View>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  dock: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  dockTextGroup: {
    flex: 1,
    minWidth: 0,
  },
  dockQueue: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dockChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  dockChipActive: {
    backgroundColor: colors.brand,
  },
  orderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  orderItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  namePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    minHeight: 38,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  namePillActive: {
    backgroundColor: colors.brand,
  },
  nextRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xxs,
  },
});
