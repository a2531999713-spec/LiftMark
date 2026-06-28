import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { liftmarkBrandAssets } from '@/assets/brand';
import { EditableAvatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import type { Group } from '@/domain/group/group.types';
import type { AuthUser } from '@/services/auth/authTypes';
import { colors, radius, shadows, spacing } from '@/theme';

type ProfileHeroCardProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  currentPlanName?: string;
  group: Group | null;
  memberCount: number;
  onAvatarPress: () => void;
  onGroupPress?: () => void;
  onPlanPress?: () => void;
  onPress: () => void;
  phoneMasked?: string;
  user: AuthUser | null;
};

function maskPhone(phone?: string) {
  if (!phone) return '138****8888';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export function ProfileHeroCard({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  currentPlanName,
  group,
  memberCount,
  onAvatarPress,
  onGroupPress,
  onPlanPress,
  onPress,
  phoneMasked,
  user,
}: ProfileHeroCardProps) {
  const displayName = user?.displayName?.trim() || '练刻用户';
  const liftmarkId = user?.liftmarkId ?? 'LM20260001';
  const phone = phoneMasked ?? maskPhone(user?.phone);
  const groupName = group?.name ?? '默认训练小组';
  const planName = currentPlanName ?? '经典练三休一增肌计划';

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <Image contentFit="contain" source={liftmarkBrandAssets.brandMark} style={styles.watermark} />
      <View style={styles.topRow}>
        <EditableAvatar
          avatarLocalUri={avatarLocalUri}
          avatarThumbUrl={avatarThumbUrl}
          avatarUrl={avatarUrl}
          name={displayName}
          onPress={onAvatarPress}
          size={88}
        />

        <View style={styles.identityBlock}>
          <AppText numberOfLines={1} style={styles.name} tone="inverse" variant="title" weight="900">
            {displayName}
          </AppText>
          <View style={styles.idPill}>
            <Ionicons color="rgba(255,255,255,0.86)" name="shield-checkmark-outline" size={16} />
            <AppText numberOfLines={1} style={styles.idText} variant="bodySmall" weight="800">
              练刻 ID：{liftmarkId}
            </AppText>
          </View>
          <AppText style={styles.phone} variant="bodySmall" weight="700">
            {phone}
          </AppText>
        </View>

        <Ionicons color="rgba(255,255,255,0.84)" name="chevron-forward" size={28} />
      </View>

      <View style={styles.divider} />

      <View style={styles.bottomRow}>
        <Pressable onPress={onGroupPress} style={styles.metricPressable}>
          <ProfileHeroMetric icon="people-outline" label={groupName} value={`${memberCount || 4} 人`} />
        </Pressable>
        <View style={styles.statDivider} />
        <Pressable onPress={onPlanPress} style={styles.metricPressable}>
          <ProfileHeroMetric icon="calendar-outline" label="当前计划" value={planName} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function ProfileHeroMetric({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metric}>
      <View style={styles.metricTitle}>
        <Ionicons color={colors.primary} name={icon} size={25} />
        <AppText numberOfLines={1} style={styles.metricLabel} variant="bodySmall" weight="900">
          {label}
        </AppText>
      </View>
      <AppText numberOfLines={1} style={styles.metricValue} variant="bodySmall" weight="700">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.dark,
    borderRadius: 22,
    gap: spacing.md,
    minHeight: 176,
    overflow: 'hidden',
    padding: spacing.lg,
    ...shadows.hero,
  },
  divider: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    height: StyleSheet.hairlineWidth,
  },
  idPill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: '100%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  idText: {
    color: 'rgba(255,255,255,0.88)',
  },
  identityBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  metric: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  metricPressable: {
    flex: 1,
    minWidth: 0,
  },
  metricLabel: {
    color: colors.surface,
  },
  metricTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricValue: {
    color: 'rgba(255,255,255,0.86)',
    paddingLeft: 33,
  },
  name: {
    color: colors.surface,
  },
  phone: {
    color: 'rgba(255,255,255,0.88)',
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.995 }],
  },
  statDivider: {
    backgroundColor: 'rgba(255,255,255,0.16)',
    height: 48,
    width: StyleSheet.hairlineWidth,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  watermark: {
    height: 180,
    opacity: 0.08,
    position: 'absolute',
    right: -14,
    top: -10,
    width: 180,
  },
});
