import type { AchievementActivityWeek } from '@liftmark/shared';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

function weekLabel(week: AchievementActivityWeek): string {
  const [, month, day] = week.weekKey.split('-');
  return `${Number(month)}/${Number(day)}`;
}

export function TrainingContinuityStrip({ embedded = false, weeks }: { embedded?: boolean; weeks: AchievementActivityWeek[] }) {
  const content = (
    <>
      <View style={styles.header}>
        <View>
          <AppText variant="subtitle" weight="900">近 12 周训练节奏</AppText>
          <AppText tone="muted" variant="caption">每周完成一次训练即可保持活跃</AppText>
        </View>
        <AppText tone="muted" variant="caption">周一至周日</AppText>
      </View>
      <View accessibilityRole="summary" style={styles.weeks}>
        {weeks.map((week) => {
          const height = week.workoutCount === 0 ? 6 : Math.min(38, 10 + week.workoutCount * 8);
          return (
            <View
              accessibilityLabel={`${week.current ? '本周，' : ''}${weekLabel(week)}，训练 ${week.workoutCount} 次`}
              key={week.weekKey}
              style={styles.week}
            >
              <AppText tone={week.current ? 'brand' : 'muted'} variant="caption" weight="900">{week.workoutCount}</AppText>
              <View style={[styles.barTrack, week.current && styles.currentTrack]}>
                <View style={[styles.bar, { height }, week.active ? styles.activeBar : styles.emptyBar]} />
              </View>
              <AppText numberOfLines={1} tone={week.current ? 'brand' : 'muted'} variant="caption" weight={week.current ? '900' : '700'}>
                {week.current ? '本周' : weekLabel(week)}
              </AppText>
            </View>
          );
        })}
      </View>
    </>
  );
  return embedded ? <View style={[styles.card, styles.embedded]}>{content}</View> : <AppCard style={styles.card}>{content}</AppCard>;
}

const styles = StyleSheet.create({
  activeBar: { backgroundColor: colors.primary },
  bar: { borderRadius: radius.pill, minHeight: 6, width: 7 },
  barTrack: { alignItems: 'center', backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, height: 42, justifyContent: 'flex-end', overflow: 'hidden', padding: 2, width: 11 },
  card: { gap: spacing.md },
  currentTrack: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1 },
  embedded: { padding: spacing.lg },
  emptyBar: { backgroundColor: colors.borderStrong },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  week: { alignItems: 'center', flex: 1, gap: spacing.xs, minWidth: 0 },
  weeks: { alignItems: 'flex-end', flexDirection: 'row', gap: 2 },
});
