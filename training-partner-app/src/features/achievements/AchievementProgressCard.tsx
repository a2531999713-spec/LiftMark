import { Ionicons } from '@expo/vector-icons';
import type { AchievementProgress } from '@liftmark/shared';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { ACHIEVEMENT_ICON_BY_METRIC } from '@/domain/achievement/achievement.catalog';
import { colors, radius, spacing } from '@/theme';
import { formatAchievementDate, formatAchievementValue } from './achievementPresentation';

export function AchievementProgressCard({ achievement }: { achievement: AchievementProgress }) {
  const ratio = achievement.target > 0 ? Math.min(1, achievement.progress / achievement.target) : 0;
  const achievedDate = formatAchievementDate(achievement.achievedAt);
  return (
    <View style={styles.row}>
      <View style={[styles.icon, achievement.achieved && styles.iconAchieved]}>
        <Ionicons color={achievement.achieved ? colors.primary : colors.textMuted} name={ACHIEVEMENT_ICON_BY_METRIC[achievement.metric]} size={20} />
      </View>
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText numberOfLines={1} style={styles.title} variant="bodySmall" weight="900">{achievement.name}</AppText>
          <AppText tone={achievement.achieved ? 'brand' : 'muted'} variant="caption" weight="900">
            {achievement.achieved && achievedDate ? achievedDate : `${formatAchievementValue(achievement.progress, achievement.metric)} / ${formatAchievementValue(achievement.target, achievement.metric)}`}
          </AppText>
        </View>
        <AppText numberOfLines={2} tone="muted" variant="caption">{achievement.description}</AppText>
        {!achievement.achieved ? (
          <View style={styles.track}><View style={[styles.progress, { width: `${ratio * 100}%` }]} /></View>
        ) : null}
      </View>
      {achievement.achieved ? <Ionicons color={colors.primary} name="checkmark" size={18} /> : null}
    </View>
  );
}

export function AchievementGroupCard({ achievements }: { achievements: AchievementProgress[] }) {
  return (
    <AppCard padded={false} style={styles.group}>
      {achievements.map((achievement, index) => (
        <View key={achievement.code}>
          {index > 0 ? <View style={styles.divider} /> : null}
          <AchievementProgressCard achievement={achievement} />
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth, marginLeft: 58 },
  group: { overflow: 'hidden' },
  icon: { alignItems: 'center', backgroundColor: colors.backgroundElevated, borderRadius: radius.md, height: 38, justifyContent: 'center', width: 38 },
  iconAchieved: { backgroundColor: colors.primarySoft },
  main: { flex: 1, gap: 3, minWidth: 0 },
  progress: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 4 },
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, minHeight: 72, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  title: { flex: 1 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  track: { backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, height: 4, marginTop: spacing.xs, overflow: 'hidden' },
});
