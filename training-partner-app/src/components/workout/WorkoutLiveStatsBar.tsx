import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type WorkoutLiveStatsBarProps = {
  averageRpe?: number;
  completedSets: number;
  elapsedLabel: string;
  totalSets: number;
  totalVolumeKg: number;
};

export function WorkoutLiveStatsBar({
  averageRpe,
  completedSets,
  elapsedLabel,
  totalSets,
  totalVolumeKg,
}: WorkoutLiveStatsBarProps) {
  return (
    <View style={styles.row}>
      <StatItem icon="timer-outline" label="时长" value={elapsedLabel} />
      <StatItem icon="flame-outline" label="容量" value={`${totalVolumeKg.toLocaleString('zh-CN')} kg`} />
      <StatItem icon="layers-outline" label="组数" value={`${completedSets}/${totalSets}`} />
      <StatItem icon="speedometer-outline" label="RPE" value={averageRpe ? averageRpe.toFixed(1) : '-'} />
    </View>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons color={colors.brand} name={icon} size={15} />
      <View style={styles.textBlock}>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {label}
        </AppText>
        <AppText numberOfLines={1} style={styles.statValue} variant="caption" weight="900">
          {value}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
    width: '100%',
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 52,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  statValue: {
    flexShrink: 1,
  },
  textBlock: {
    flex: 1,
    minWidth: 0,
  },
});
