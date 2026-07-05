import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, shadows, spacing } from '@/theme';

type PlanProgressCardProps = {
  onPress: () => void;
  planName: string;
  progressLabel: string;
  progressPercent: number;
  subtitle: string;
};

export function PlanProgressCard({
  onPress,
  planName,
  progressLabel,
  progressPercent,
  subtitle,
}: PlanProgressCardProps) {
  const normalizedPercent = Math.max(0, Math.min(100, progressPercent));

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topRow}>
        <View style={styles.iconBox}>
          <Ionicons color={colors.primary} name="calendar-outline" size={22} />
        </View>
        <View style={styles.textBlock}>
          <AppText numberOfLines={1} style={styles.title} variant="bodySmall" weight="900">
            {planName}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {subtitle}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
      </View>
      <View style={styles.progressHeader}>
        <AppText tone="muted" variant="caption">
          本周进度 {progressLabel}
        </AppText>
        <AppText style={styles.percent} variant="caption" weight="900">
          {normalizedPercent}%
        </AppText>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${normalizedPercent}%` }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.sm,
    ...shadows.card,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  percent: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 6,
    overflow: 'hidden',
  },
  textBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    color: colors.textStrong,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
