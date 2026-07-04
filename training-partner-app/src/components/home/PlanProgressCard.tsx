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
          <Ionicons color={colors.primary} name="calendar-outline" size={26} />
        </View>
        <View style={styles.textBlock}>
          <AppText numberOfLines={1} style={styles.title} variant="subtitle" weight="900">
            {planName}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="bodySmall">
            {subtitle}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={24} />
      </View>
      <View style={styles.progressHeader}>
        <AppText tone="muted" variant="bodySmall">
          本周进度 {progressLabel}
        </AppText>
        <AppText style={styles.percent} variant="bodySmall" weight="900">
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
    borderRadius: radius.xl,
    borderWidth: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    ...shadows.card,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    height: 64,
    justifyContent: 'center',
    width: 64,
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
    height: 10,
    overflow: 'hidden',
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  title: {
    color: colors.textStrong,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
});
