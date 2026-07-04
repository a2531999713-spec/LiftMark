import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type HistoryRangeKey = '7d' | '30d' | 'month' | 'custom';
export type HistoryScopeKey = 'personal' | 'group';

type HistoryFilterBarProps = {
  groupName: string;
  memberName: string;
  onOpenExerciseFilter: () => void;
  onOpenTimeFilter: () => void;
  onResetTimeFilter: () => void;
  onScopeChange: (scope: HistoryScopeKey) => void;
  rangeLabel: string;
  scope: HistoryScopeKey;
  selectedExerciseName?: string;
  timeFilterActive: boolean;
};

export function HistoryFilterBar({
  groupName,
  memberName,
  onOpenExerciseFilter,
  onOpenTimeFilter,
  onResetTimeFilter,
  onScopeChange,
  rangeLabel,
  scope,
  selectedExerciseName,
  timeFilterActive,
}: HistoryFilterBarProps) {
  const scopeChipLabel = scope === 'personal' ? `我的 · ${memberName}` : `小组 · ${groupName}`;
  const nextScope = scope === 'personal' ? 'group' : 'personal';
  return (
    <AppCard style={styles.container}>
      <View style={styles.compactBar}>
        <FilterChip
          active
          icon={scope === 'personal' ? 'person-outline' : 'people-outline'}
          label={scopeChipLabel}
          onPress={() => onScopeChange(nextScope)}
          trailing="swap-horizontal-outline"
        />
        <FilterChip
          active={timeFilterActive}
          icon="calendar-outline"
          label={rangeLabel}
          onPress={onOpenTimeFilter}
          trailing={timeFilterActive ? 'close-outline' : 'chevron-down-outline'}
          onTrailingPress={timeFilterActive ? onResetTimeFilter : undefined}
        />
        <FilterChip
          active={Boolean(selectedExerciseName)}
          icon="barbell-outline"
          label={selectedExerciseName ?? '全部动作'}
          onPress={onOpenExerciseFilter}
          trailing="chevron-down-outline"
        />
      </View>
    </AppCard>
  );
}

function FilterChip({
  active,
  icon,
  label,
  onPress,
  onTrailingPress,
  trailing,
}: {
  active: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  onTrailingPress?: () => void;
  trailing?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      {icon ? <Ionicons color={active ? colors.surface : colors.textMuted} name={icon} size={15} /> : null}
      <AppText numberOfLines={1} tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
        {label}
      </AppText>
      {trailing ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onTrailingPress}>
          <Ionicons color={active ? colors.surface : colors.textMuted} name={trailing} size={15} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  compactBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  container: {
    padding: spacing.sm,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    minWidth: 0,
    paddingHorizontal: spacing.md,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
