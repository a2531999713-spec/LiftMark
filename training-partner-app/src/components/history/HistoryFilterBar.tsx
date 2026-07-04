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
  const scopeLabel = scope === 'personal' ? '我的记录' : '小组记录';
  const scopeMeta = scope === 'personal' ? memberName : groupName;
  const nextScope = scope === 'personal' ? 'group' : 'personal';
  const summary = `${scopeLabel} · ${rangeLabel} · ${selectedExerciseName ?? '全部动作'}`;

  return (
    <AppCard style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <AppText variant="subtitle">训练分析</AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {summary}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => onScopeChange(nextScope)}
          style={styles.scopeSelector}
        >
          <View style={styles.scopeSelectorText}>
            <AppText numberOfLines={1} variant="caption" weight="900">
              {scopeLabel}
            </AppText>
            <AppText numberOfLines={1} tone="muted" variant="caption">
              {scopeMeta}
            </AppText>
          </View>
          <Ionicons color={colors.textMuted} name="swap-horizontal-outline" size={16} />
        </Pressable>
      </View>

      <View style={styles.compactBar}>
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
    gap: spacing.md,
  },
  filterChip: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flex: 1,
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
  scopeSelector: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 148,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  scopeSelectorText: {
    flex: 1,
    minWidth: 0,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
