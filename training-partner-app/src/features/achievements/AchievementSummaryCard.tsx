import type { AchievementMetrics } from '@liftmark/shared';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

export function AchievementSummaryCard({ embedded = false, metrics }: { embedded?: boolean; metrics: AchievementMetrics }) {
  const items = [
    { label: '本周训练', value: metrics.thisWeekWorkoutCount, unit: '次' },
    { label: '连续活跃', value: metrics.currentActiveWeekStreak, unit: '周' },
    { label: '最长', value: metrics.longestActiveWeekStreak, unit: '周' },
    { label: '累计完成', value: metrics.completedWorkouts, unit: '次' },
  ];
  const content = (
    <>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.item, index > 0 && styles.divider]}>
          <AppText numberOfLines={1} tone="muted" variant="caption">{item.label}</AppText>
          <View style={styles.valueRow}>
            <AppText variant="title" weight="900">{item.value}</AppText>
            <AppText tone="muted" variant="caption">{item.unit}</AppText>
          </View>
        </View>
      ))}
    </>
  );
  return embedded ? <View style={styles.card}>{content}</View> : <AppCard padded={false} style={styles.card}>{content}</AppCard>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', minHeight: 82, overflow: 'hidden' },
  divider: { borderLeftColor: colors.border, borderLeftWidth: StyleSheet.hairlineWidth },
  item: { alignItems: 'center', flex: 1, justifyContent: 'center', minWidth: 0, paddingHorizontal: spacing.xs, paddingVertical: spacing.md },
  valueRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xxs, marginTop: spacing.xs },
});
