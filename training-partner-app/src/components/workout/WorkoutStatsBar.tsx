import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type WorkoutStatsBarProps = {
  elapsedLabel: string;
  totalVolumeKg: number;
};

export function WorkoutStatsBar({ elapsedLabel, totalVolumeKg }: WorkoutStatsBarProps) {
  return (
    <View style={styles.row}>
      <View style={styles.statCard}>
        <Ionicons color={colors.brand} name="timer-outline" size={16} />
        <AppText variant="caption" weight="800">
          训练时长
        </AppText>
        <AppText style={styles.statValue} variant="caption" weight="900">
          {elapsedLabel}
        </AppText>
      </View>
      <View style={styles.statCard}>
        <Ionicons color={colors.brand} name="flame-outline" size={16} />
        <AppText variant="caption" weight="800">
          本次总量
        </AppText>
        <AppText style={styles.statValue} variant="caption" weight="900">
          {totalVolumeKg.toLocaleString('zh-CN')} kg
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
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
    paddingHorizontal: spacing.md,
  },
  statValue: {
    flexShrink: 1,
  },
});
