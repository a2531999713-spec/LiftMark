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
          <AppText tone={!selectedDate ? 'inverse' : 'default'} variant="bodySmall" weight="900">
            范围
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
              <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                {formatShortDate(date)}
              </AppText>
              <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                <AppText tone={active ? 'brand' : 'muted'} variant="caption" weight="900">
                  {count}
                </AppText>
              </View>
              <View style={styles.dotRow}>
                {Array.from({ length: Math.min(3, count) }).map((_, index) => (
                  <View key={index} style={[styles.dot, active && styles.dotActive]} />
                ))}
                {count === 0 ? <View style={styles.dotMuted} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    minWidth: 24,
    paddingHorizontal: spacing.xs,
  },
  countBadgeActive: {
    backgroundColor: colors.surface,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 5,
    width: 5,
  },
  dotActive: {
    backgroundColor: colors.surface,
  },
  dotMuted: {
    backgroundColor: colors.borderStrong,
    borderRadius: radius.pill,
    height: 5,
    width: 5,
  },
  dotRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 6,
  },
  item: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 92,
    minWidth: 72,
    padding: spacing.sm,
  },
  itemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
});
