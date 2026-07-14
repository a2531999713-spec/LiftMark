import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Tag } from '@/components/ui';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import {
  describeSchemeGoal,
  describeSchemeLevel,
  type SystemTrainingScheme,
} from '@/domain/plan/systemSchemes';
import { colors, radius, shadows, spacing } from '@/theme';

type Props = {
  copiedPlan?: PlanTemplate;
  onPress: () => void;
  recommendationReason?: string;
  scheme: SystemTrainingScheme;
};

export function SystemSchemeCard({ copiedPlan, onPress, recommendationReason, scheme }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={!scheme.isAvailable && !scheme.isComingSoon}
      onPress={onPress}
      style={({ pressed }) => [styles.card, !scheme.isAvailable && styles.cardUnavailable, pressed && styles.pressed]}
    >
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText variant="subtitle">{scheme.title}</AppText>
          <AppText numberOfLines={2} tone="muted" variant="caption">
            {recommendationReason ?? scheme.subtitle}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
      </View>
      <View style={styles.tags}>
        <Tag label={describeSchemeGoal(scheme.goal)} tone="brand" />
        <Tag label={describeSchemeLevel(scheme.level)} tone="accent" />
        <Tag label={`每周 ${scheme.frequencyPerWeek} 天`} tone="neutral" />
        <Tag label={`${scheme.durationWeeks} 周`} tone="neutral" />
        {copiedPlan ? <Tag label="已复制" tone="success" /> : null}
        {!scheme.isAvailable ? <Tag label="暂不可用" tone="neutral" /> : null}
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
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  cardUnavailable: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.72,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
});
