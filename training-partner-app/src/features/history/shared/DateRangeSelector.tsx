import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import {
  addDays,
  createDateRange,
  defaultDateRangeOptions,
  formatFullDate,
  formatRangeLabel,
  getLocalDateString,
  parseLocalDate,
  type DateRangeOption,
  type DateRangePreset,
  type DateRangeValue,
} from './dateRange';

type DateRangeSelectorProps = {
  compact?: boolean;
  onChange: (range: DateRangeValue) => void;
  options?: DateRangeOption[];
  range: DateRangeValue;
  subtitle?: string;
};

type CalendarCell = {
  date: string;
  day: string;
  inMonth: boolean;
  key: string;
};

const weekdayLabels = ['日', '一', '二', '三', '四', '五', '六'];

export function useDateRange(initialPreset: DateRangePreset = '30d') {
  const [customRange, setCustomRange] = useState<Pick<DateRangeValue, 'fromDate' | 'toDate'> | null>(null);
  const [preset, setPreset] = useState<DateRangePreset>(initialPreset);
  const range = useMemo(() => createDateRange(preset, customRange), [customRange, preset]);

  const updateRange = (nextRange: DateRangeValue) => {
    setPreset(nextRange.preset);
    if (nextRange.preset === 'custom') {
      setCustomRange({ fromDate: nextRange.fromDate, toDate: nextRange.toDate });
    }
  };

  return { range, setRange: updateRange };
}

export function DateRangeSelector({
  compact = false,
  onChange,
  options = defaultDateRangeOptions,
  range,
  subtitle = '点击自定义选择起止日期',
}: DateRangeSelectorProps) {
  const [sheetVisible, setSheetVisible] = useState(false);

  const selectPreset = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      setSheetVisible(true);
      return;
    }
    onChange(createDateRange(preset));
  };

  return (
    <AppCard style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.quickRow}>
        {options.map((option) => {
          const active = range.preset === option.preset;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.preset}
              onPress={() => selectPreset(option.preset)}
              style={({ pressed }) => [styles.quickChip, active && styles.quickChipActive, pressed && styles.pressed]}
            >
              {option.preset === 'custom' ? (
                <Ionicons color={active ? colors.surface : colors.primary} name="calendar-outline" size={15} />
              ) : null}
              <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryRow}>
        <Ionicons color={colors.textMuted} name="time-outline" size={14} />
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {formatRangeLabel(range.fromDate, range.toDate)}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {subtitle}
        </AppText>
      </View>

      <DateRangeSheet
        key={`${range.fromDate}:${range.toDate}`}
        onApply={(nextRange) => {
          onChange(nextRange);
          setSheetVisible(false);
        }}
        onClose={() => setSheetVisible(false)}
        range={range}
        visible={sheetVisible}
      />
    </AppCard>
  );
}

function DateRangeSheet({
  onApply,
  onClose,
  range,
  visible,
}: {
  onApply: (range: DateRangeValue) => void;
  onClose: () => void;
  range: DateRangeValue;
  visible: boolean;
}) {
  const [draftFrom, setDraftFrom] = useState(range.fromDate);
  const [draftTo, setDraftTo] = useState(range.toDate);
  const [selectingStart, setSelectingStart] = useState(true);
  const [cursorMonth, setCursorMonth] = useState(() => startOfMonth(parseLocalDate(range.toDate)));
  const cells = useMemo(() => buildCalendarCells(cursorMonth), [cursorMonth]);
  const fromDate = draftFrom <= draftTo ? draftFrom : draftTo;
  const toDate = draftFrom <= draftTo ? draftTo : draftFrom;

  const applyPreset = (preset: DateRangePreset) => {
    if (preset === 'custom') {
      return;
    }
    onApply(createDateRange(preset));
  };

  const selectDate = (date: string) => {
    if (selectingStart) {
      setDraftFrom(date);
      setDraftTo(date);
      setSelectingStart(false);
      return;
    }

    if (date < draftFrom) {
      setDraftTo(draftFrom);
      setDraftFrom(date);
    } else {
      setDraftTo(date);
    }
    setSelectingStart(true);
  };

  const applyCustom = () => {
    onApply({ fromDate, preset: 'custom', title: '当前范围', toDate });
  };

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="先点开始日期，再点结束日期；也可以直接用上方快捷范围。"
      title="日期范围"
      visible={visible}
    >
      <View style={styles.sheetQuickRow}>
        {defaultDateRangeOptions.slice(0, 3).map((option) => (
          <AppButton key={option.preset} onPress={() => applyPreset(option.preset)} size="sm" variant="secondary">
            {option.label}
          </AppButton>
        ))}
      </View>

      <View style={styles.calendarHeader}>
        <Pressable accessibilityRole="button" onPress={() => setCursorMonth(addMonths(cursorMonth, -1))} style={styles.monthButton}>
          <Ionicons color={colors.text} name="chevron-back" size={18} />
        </Pressable>
        <View style={styles.monthTitle}>
          <AppText variant="subtitle" weight="900">
            {formatMonthTitle(cursorMonth)}
          </AppText>
          <AppText tone="muted" variant="caption">
            {formatFullDate(fromDate)} - {formatFullDate(toDate)}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setCursorMonth(addMonths(cursorMonth, 1))} style={styles.monthButton}>
          <Ionicons color={colors.text} name="chevron-forward" size={18} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {weekdayLabels.map((label) => (
          <AppText key={label} style={styles.weekdayCell} tone="muted" variant="caption" weight="900">
            {label}
          </AppText>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((cell) => {
          if (!cell.inMonth) {
            return <View key={cell.key} style={styles.dayCell} />;
          }

          const isEdge = cell.date === fromDate || cell.date === toDate;
          const isInRange = cell.date >= fromDate && cell.date <= toDate;

          return (
            <Pressable
              accessibilityRole="button"
              key={cell.key}
              onPress={() => selectDate(cell.date)}
              style={({ pressed }) => [
                styles.dayCell,
                isInRange && styles.dayCellInRange,
                isEdge && styles.dayCellSelected,
                pressed && styles.pressed,
              ]}
            >
              <AppText tone={isEdge ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                {cell.day}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.sheetActions}>
        <AppButton icon="checkmark-outline" onPress={applyCustom}>
          应用自定义范围
        </AppButton>
      </View>
    </AppModalSheet>
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12);
}

function addMonths(date: Date, count: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + count, 1, 12);
}

function formatMonthTitle(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function buildCalendarCells(month: Date): CalendarCell[] {
  const firstDay = startOfMonth(month);
  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12);
  const leadingCount = firstDay.getDay();
  const dayCount = lastDay.getDate();
  const cells: CalendarCell[] = [];

  for (let index = 0; index < leadingCount; index += 1) {
    cells.push({ date: '', day: '', inMonth: false, key: `blank-start-${index}` });
  }

  for (let day = 1; day <= dayCount; day += 1) {
    const date = getLocalDateString(addDays(firstDay, day - 1));
    cells.push({ date, day: `${day}`, inMonth: true, key: date });
  }

  while (cells.length % 7 !== 0) {
    cells.push({ date: '', day: '', inMonth: false, key: `blank-end-${cells.length}` });
  }

  return cells;
}

const styles = StyleSheet.create({
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  dayCell: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: `${100 / 7 - 1}%`,
  },
  dayCellInRange: {
    backgroundColor: colors.primarySoft,
  },
  dayCellSelected: {
    backgroundColor: colors.primary,
  },
  monthButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  monthTitle: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.84,
  },
  quickChip: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  quickChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sheetActions: {
    gap: spacing.sm,
  },
  sheetQuickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  weekdayCell: {
    textAlign: 'center',
    width: `${100 / 7 - 1}%`,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  wrap: {
    gap: spacing.sm,
    padding: spacing.sm,
  },
  wrapCompact: {
    padding: spacing.xs,
  },
});
