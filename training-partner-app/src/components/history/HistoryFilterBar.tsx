import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type HistoryRangeKey = '7d' | '30d' | 'month';
export type HistoryScopeKey = 'personal' | 'group';

type HistoryFilterBarProps = {
  groupName: string;
  memberName: string;
  onOpenDatePicker: () => void;
  onOpenExerciseFilter: () => void;
  onRangeChange: (rangeKey: HistoryRangeKey) => void;
  onResetDate: () => void;
  onScopeChange: (scope: HistoryScopeKey) => void;
  rangeKey: HistoryRangeKey;
  scope: HistoryScopeKey;
  selectedDate: string | null;
  selectedExerciseName?: string;
};

const rangeOptions: { key: HistoryRangeKey; label: string }[] = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: 'month', label: '本月' },
];

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

export function HistoryFilterBar({
  groupName,
  memberName,
  onOpenDatePicker,
  onOpenExerciseFilter,
  onRangeChange,
  onResetDate,
  onScopeChange,
  rangeKey,
  scope,
  selectedDate,
  selectedExerciseName,
}: HistoryFilterBarProps) {
  return (
    <AppCard style={styles.container}>
      <View style={styles.topRow}>
        <View style={styles.titleBlock}>
          <AppText variant="subtitle">训练分析</AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {scope === 'personal' ? memberName : groupName}
          </AppText>
        </View>
        <View style={styles.scopePill}>
          <ScopeButton active={scope === 'personal'} label="我的记录" onPress={() => onScopeChange('personal')} />
          <ScopeButton active={scope === 'group'} label="当前小组" onPress={() => onScopeChange('group')} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {rangeOptions.map((option) => (
          <FilterChip
            active={!selectedDate && rangeKey === option.key}
            key={option.key}
            label={option.label}
            onPress={() => onRangeChange(option.key)}
          />
        ))}
        <FilterChip
          active={Boolean(selectedDate)}
          icon="calendar-outline"
          label={selectedDate ? formatShortDate(selectedDate) : '单日'}
          onPress={onOpenDatePicker}
          trailing={selectedDate ? 'close-outline' : undefined}
          onTrailingPress={selectedDate ? onResetDate : undefined}
        />
        <FilterChip
          active={Boolean(selectedExerciseName)}
          icon="barbell-outline"
          label={selectedExerciseName ?? '全部动作'}
          onPress={onOpenExerciseFilter}
        />
      </ScrollView>
    </AppCard>
  );
}

function ScopeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.scopeButton, active && styles.scopeButtonActive]}>
      <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
        {label}
      </AppText>
    </Pressable>
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
  chipRow: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.lg,
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
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 38,
    maxWidth: 180,
    paddingHorizontal: spacing.md,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scopeButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    minHeight: 34,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  scopeButtonActive: {
    backgroundColor: colors.primary,
  },
  scopePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
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
