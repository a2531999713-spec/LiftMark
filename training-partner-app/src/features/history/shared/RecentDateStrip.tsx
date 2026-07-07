import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import { buildRecentDates, formatShortDate, getWeekdayLabel } from './dateRange';

type RecentDateStripProps = {
  countsByDate: Record<string, number>;
  fromDate: string;
  onSelectDate: (date: string | null) => void;
  selectedDate: string | null;
  toDate: string;
};

export function RecentDateStrip({ countsByDate, fromDate, onSelectDate, selectedDate, toDate }: RecentDateStripProps) {
  const dates = buildRecentDates(fromDate, toDate, 12);

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onSelectDate(null)}
          style={[styles.item, !selectedDate && styles.itemActive]}
        >
          <AppText tone={!selectedDate ? 'inverse' : 'muted'} variant="caption" weight="900">
            全部
          </AppText>
          <View style={[styles.dot, !selectedDate && styles.dotActive]} />
        </Pressable>
        {dates.map((date) => {
          const active = selectedDate === date;
          const count = countsByDate[date] ?? 0;
          return (
            <Pressable
              accessibilityRole="button"
              key={date}
              onPress={() => onSelectDate(date)}
              style={[styles.item, active && styles.itemActive]}
            >
              <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
                {getWeekdayLabel(date)}
              </AppText>
              <AppText tone={active ? 'inverse' : 'default'} variant="caption" weight="900">
                {formatShortDate(date)}
              </AppText>
              {count > 0 ? <View style={[styles.dot, active && styles.dotActive]} /> : <View style={styles.dotMuted} />}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 4,
    width: 4,
  },
  dotActive: {
    backgroundColor: colors.surface,
  },
  dotMuted: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 4,
    width: 4,
  },
  item: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 3,
    justifyContent: 'center',
    minHeight: 56,
    minWidth: 46,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
  },
  itemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
});
