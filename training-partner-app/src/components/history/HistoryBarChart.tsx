import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type HistoryBarPoint = {
  id: string;
  label: string;
  meta?: string;
  value: number;
};

type HistoryBarChartProps = {
  emptyMessage?: string;
  formatValue: (value: number) => string;
  maxVisibleBars?: number;
  onBarPress?: (point: HistoryBarPoint, index: number) => void;
  points: HistoryBarPoint[];
  selectedId?: string | null;
};

export function HistoryBarChart({
  emptyMessage = '当前范围还没有可展示的数据',
  formatValue,
  maxVisibleBars = 8,
  onBarPress,
  points,
  selectedId,
}: HistoryBarChartProps) {
  const visiblePoints = points.slice(0, maxVisibleBars);
  const maxValue = Math.max(0, ...visiblePoints.map((point) => point.value));

  if (visiblePoints.length === 0 || maxValue <= 0) {
    return (
      <View style={styles.empty}>
        <AppText tone="muted" variant="caption">
          {emptyMessage}
        </AppText>
      </View>
    );
  }

  return (
    <View style={styles.chart}>
      {visiblePoints.map((point, index) => {
        const active = selectedId === point.id;
        const ratio = maxValue > 0 ? point.value / maxValue : 0;
        return (
          <Pressable
            accessibilityRole="button"
            key={point.id}
            onPress={() => onBarPress?.(point, index)}
            style={({ pressed }) => [styles.row, active && styles.rowActive, pressed && styles.pressed]}
          >
            <View style={styles.labelBlock}>
              <AppText numberOfLines={1} variant="caption" weight="900">
                {point.label}
              </AppText>
              {point.meta ? (
                <AppText numberOfLines={1} tone="muted" variant="caption">
                  {point.meta}
                </AppText>
              ) : null}
            </View>
            <View style={styles.track}>
              <View style={[styles.bar, active && styles.barActive, { width: `${Math.max(8, Math.round(ratio * 100))}%` }]} />
            </View>
            <AppText numberOfLines={1} style={styles.value} variant="caption" weight="900">
              {formatValue(point.value)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
  },
  barActive: {
    backgroundColor: colors.accent,
  },
  chart: {
    gap: spacing.sm,
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 140,
    padding: spacing.lg,
  },
  labelBlock: {
    flex: 0.9,
    gap: 2,
    minWidth: 82,
  },
  pressed: {
    opacity: 0.84,
  },
  row: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.sm,
  },
  rowActive: {
    borderColor: colors.accent,
  },
  track: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flex: 1,
    height: 10,
    overflow: 'hidden',
  },
  value: {
    minWidth: 58,
    textAlign: 'right',
  },
});
