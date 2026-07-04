import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppCard, AppText, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type ProfileSummaryCardProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  compact?: boolean;
  displayName: string;
  liftmarkId?: string;
  membershipLabel: string;
  onAvatarPress?: () => void;
  onPress?: () => void;
  phoneMasked?: string;
  showChevron?: boolean;
  syncLabel: string;
};

export function ProfileSummaryCard({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  compact = false,
  displayName,
  liftmarkId,
  membershipLabel,
  onAvatarPress,
  onPress,
  phoneMasked,
  showChevron = true,
  syncLabel,
}: ProfileSummaryCardProps) {
  const content = (
    <AppCard style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.inner}>
        <Pressable
          accessibilityRole={onAvatarPress ? 'button' : undefined}
          disabled={!onAvatarPress}
          onPress={onAvatarPress}
          style={styles.avatarWrap}
        >
          <Avatar
            avatarLocalUri={avatarLocalUri}
            avatarThumbUrl={avatarThumbUrl}
            avatarUrl={avatarUrl}
            name={displayName}
            size={compact ? 58 : 78}
          />
          {onAvatarPress ? (
            <View style={styles.editBadge}>
              <Ionicons color={colors.surface} name="pencil" size={compact ? 12 : 14} />
            </View>
          ) : null}
        </Pressable>

        <View style={styles.textBlock}>
          <AppText numberOfLines={1} style={styles.name} variant={compact ? 'subtitle' : 'title'} weight="900">
            {displayName}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="bodySmall">
            手机号：{phoneMasked ?? '未设置'}
          </AppText>
          <View style={styles.metaRow}>
            <AppText numberOfLines={1} tone="muted" variant="bodySmall">
              LiftMark ID：{liftmarkId ?? '未设置'}
            </AppText>
            {!compact ? (
              <>
                <View style={styles.dot} />
                <AppText numberOfLines={1} style={styles.memberText} variant="bodySmall" weight="800">
                  {membershipLabel}
                </AppText>
              </>
            ) : null}
          </View>
          <View style={styles.statusRow}>
            <Ionicons color={colors.textMuted} name="cloud-outline" size={17} />
            <AppText numberOfLines={1} tone="muted" variant="bodySmall">
              云同步：
            </AppText>
            <AppText numberOfLines={1} tone="success" variant="bodySmall" weight="800">
              {syncLabel}
            </AppText>
            {compact ? <Tag label={membershipLabel} tone="danger" /> : null}
          </View>
        </View>

        {showChevron ? <Ionicons color={colors.textMuted} name="chevron-forward" size={22} /> : null}
      </View>
    </AppCard>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    position: 'relative',
  },
  card: {
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  compactCard: {
    padding: spacing.md,
  },
  dot: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 3,
    width: 3,
  },
  editBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: 0,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: 0,
    width: 26,
  },
  inner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  memberText: {
    color: colors.primary,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  name: {
    color: colors.textStrong,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  statusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
