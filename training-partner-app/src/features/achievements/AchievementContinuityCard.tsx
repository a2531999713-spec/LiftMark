import { Ionicons } from '@expo/vector-icons';
import type { AchievementSnapshot } from '@liftmark/shared';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { selectNextMilestone } from '@/domain/achievement/achievement-engine';
import { colors, radius, shadows, spacing } from '@/theme';
import { remainingAchievementText } from './achievementPresentation';

export function AchievementContinuityCard({ snapshot, onPress }: { snapshot: AchievementSnapshot; onPress: () => void }) {
  const next = selectNextMilestone(snapshot.achievements);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.icon}><Ionicons color={colors.primary} name="calendar-outline" size={20} /></View>
      <View style={styles.main}>
        <AppText variant="bodySmall" weight="900">训练连续性</AppText>
        <AppText tone="muted" variant="caption">本周已训练 {snapshot.metrics.thisWeekWorkoutCount} 次 · 连续活跃 {snapshot.metrics.currentActiveWeekStreak} 周</AppText>
        <AppText numberOfLines={1} tone="brand" variant="caption" weight="900">
          {next ? `距离“${next.name}”${remainingAchievementText(next)}` : '当前里程碑已全部完成'}
        </AppText>
      </View>
      <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 82, padding: spacing.md, ...shadows.card },
  icon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, height: 40, justifyContent: 'center', width: 40 },
  main: { flex: 1, gap: 2, minWidth: 0 },
  pressed: { opacity: 0.82 },
});

