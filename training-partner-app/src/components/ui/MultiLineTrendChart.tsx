import { useState } from 'react';
import type { ReactNode } from 'react';
import { type DimensionValue, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

export type MultiLineTrendSeries = {
  color?: string;
  label: string;
  values: number[];
};

type MultiLineTrendChartProps = {
  chartHeight?: number;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
  labels: string[];
  series: MultiLineTrendSeries[];
};

const palette = [colors.primary, colors.accent, colors.success, colors.warning];

function sanitizeValue(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

export function MultiLineTrendChart({
  chartHeight = 118,
  emptyMessage = '暂无趋势数据',
  formatValue = (value) => `${Math.round(value)}`,
  labels,
  series,
}: MultiLineTrendChartProps) {
  const normalizedSeries = series.slice(0, 4).map((item, index) => ({
    ...item,
    color: item.color ?? palette[index % palette.length],
    values: labels.map((_, valueIndex) => sanitizeValue(item.values[valueIndex] ?? 0)),
  }));
  const maxValue = Math.max(1, ...normalizedSeries.flatMap((item) => item.values));
  const hasData = normalizedSeries.some((item) => item.values.some((value) => value > 0));

  if (!hasData) {
    return (
      <View style={[styles.container, { minHeight: chartHeight + 56 }]}>
        <View style={styles.emptyContainer}>
          <AppText tone="muted" variant="caption">
            {emptyMessage}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ChartArea chartHeight={chartHeight} maxValue={maxValue} series={normalizedSeries} />
      <View style={styles.labelRow}>
        {labels.map((label) => (
          <AppText key={label} numberOfLines={1} style={styles.axisLabel} tone="muted" variant="caption">
            {label}
          </AppText>
        ))}
      </View>
      <View style={styles.legendRow}>
        {normalizedSeries.map((item) => {
          const latest = [...item.values].reverse().find((value) => value > 0) ?? 0;
          return (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <AppText numberOfLines={1} style={styles.legendText} variant="caption" weight="800">
                {item.label}
              </AppText>
              <AppText tone="muted" variant="caption">
                {formatValue(latest)}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

type NormalizedSeries = Required<Pick<MultiLineTrendSeries, 'color' | 'label' | 'values'>>;

function ChartArea({
  chartHeight,
  maxValue,
  series,
}: {
  chartHeight: number;
  maxValue: number;
  series: NormalizedSeries[];
}) {
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={[styles.chartArea, { height: chartHeight }]} onLayout={handleLayout}>
      {containerWidth > 0
        ? series.flatMap((item, seriesIndex) =>
            renderSeries(item, seriesIndex, chartHeight, containerWidth, maxValue),
          )
        : null}
    </View>
  );
}

function renderSeries(
  series: NormalizedSeries,
  seriesIndex: number,
  chartHeight: number,
  containerWidth: number,
  maxValue: number,
) {
  const gap = series.values.length > 1 ? 1 / (series.values.length - 1) : 0;
  const points = series.values.map((value, index) => ({
    index,
    value,
    x: (series.values.length > 1 ? index * gap : 0.5) * containerWidth,
    y: (1 - value / maxValue) * chartHeight,
  }));
  const nodes: ReactNode[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (left.value <= 0 && right.value <= 0) {
      continue;
    }

    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    nodes.push(
      <View
        key={`series-${seriesIndex}-line-${index}`}
        style={[
          styles.line,
          {
            backgroundColor: series.color,
            left: ((left.x + right.x) / 2 - length / 2) as DimensionValue,
            top: (left.y + right.y) / 2 - 1,
            transform: [{ rotate: `${angle}deg` }],
            width: length,
          },
        ]}
      />,
    );
  }

  points.forEach((point) => {
    if (point.value <= 0) {
      return;
    }

    nodes.push(
      <View
        key={`series-${seriesIndex}-point-${point.index}`}
        style={[
          styles.point,
          {
            backgroundColor: series.color,
            left: (point.x - 4) as DimensionValue,
            top: point.y - 4,
          },
        ]}
      />,
    );
  });

  return nodes;
}

const styles = StyleSheet.create({
  axisLabel: {
    flex: 1,
    fontSize: 10,
    textAlign: 'center',
  },
  chartArea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  container: {
    gap: spacing.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  labelRow: {
    flexDirection: 'row',
  },
  legendDot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  legendItem: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 28,
    paddingHorizontal: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  legendText: {
    maxWidth: 72,
  },
  line: {
    height: 2,
    position: 'absolute',
  },
  point: {
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 8,
    position: 'absolute',
    width: 8,
  },
});
