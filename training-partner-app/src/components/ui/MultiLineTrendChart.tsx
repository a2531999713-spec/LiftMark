import { useState } from 'react';
import type { ReactNode } from 'react';
import { type DimensionValue, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { buildYAxisScale, normalizeYAxisValue, type YAxisScale } from './chartScale';

export type MultiLineTrendSeries = {
  color?: string;
  label: string;
  values: number[];
};

type MultiLineTrendChartProps = {
  chartHeight?: number;
  emptyMessage?: string;
  formatValue?: (value: number) => string;
  labelFormatter?: (label: string, index: number) => string;
  labelSkipStrategy?: 'all' | 'auto';
  labels: string[];
  maxXAxisLabels?: number;
  series: MultiLineTrendSeries[];
  unitLabel?: string;
  yAxisTickCount?: number;
};

const palette = [colors.primary, colors.accent, colors.success, colors.warning];

function sanitizeValue(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return value;
}

function getVisibleXAxisIndexes(count: number, maxLabels: number, strategy: 'all' | 'auto'): Set<number> {
  if (strategy === 'all' || count <= maxLabels) {
    return new Set(Array.from({ length: count }, (_, index) => index));
  }

  const visible = new Set<number>();
  const lastIndex = count - 1;
  const slots = Math.max(2, maxLabels);
  for (let slot = 0; slot < slots; slot += 1) {
    visible.add(Math.round((slot * lastIndex) / (slots - 1)));
  }
  return visible;
}

export function MultiLineTrendChart({
  chartHeight = 118,
  emptyMessage = '暂无趋势数据',
  formatValue = (value) => `${Math.round(value)}`,
  labelFormatter = (label) => label,
  labelSkipStrategy = 'auto',
  labels,
  maxXAxisLabels = 5,
  series,
  unitLabel,
  yAxisTickCount = 3,
}: MultiLineTrendChartProps) {
  const normalizedSeries = series.slice(0, 4).map((item, index) => ({
    ...item,
    color: item.color ?? palette[index % palette.length],
    values: labels.map((_, valueIndex) => sanitizeValue(item.values[valueIndex] ?? 0)),
  }));
  const allValues = normalizedSeries.flatMap((item) => item.values);
  const scale = buildYAxisScale(allValues, { includeZero: true, tickCount: yAxisTickCount });
  const hasData = normalizedSeries.some((item) => item.values.some((value) => value !== 0));
  const tickValues = scale.ticks;
  const visibleXAxisIndexes = getVisibleXAxisIndexes(labels.length, maxXAxisLabels, labelSkipStrategy);

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
      <View style={styles.chartFrame}>
        <View style={[styles.yAxis, { height: chartHeight }]}>
          {unitLabel ? (
            <AppText numberOfLines={1} style={styles.unitLabel} tone="muted" variant="caption">
              {unitLabel}
            </AppText>
          ) : null}
          {tickValues.map((tick, index) => (
            <AppText key={`${tick}-${index}`} numberOfLines={1} style={styles.yAxisLabel} tone="muted" variant="caption">
              {formatValue(tick)}
            </AppText>
          ))}
        </View>
        <ChartArea chartHeight={chartHeight} scale={scale} series={normalizedSeries} tickCount={tickValues.length} />
      </View>
      <View style={styles.labelFrame}>
        <View style={styles.axisSpacer} />
        <View style={styles.labelRow}>
          {labels.map((label, index) => (
            <AppText key={`${label}-${index}`} numberOfLines={1} style={styles.axisLabel} tone="muted" variant="caption">
              {visibleXAxisIndexes.has(index) ? labelFormatter(label, index) : ''}
            </AppText>
          ))}
        </View>
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

const PLOT_PADDING = 12;

function ChartArea({
  chartHeight,
  scale,
  series,
  tickCount,
}: {
  chartHeight: number;
  scale: YAxisScale;
  series: NormalizedSeries[];
  tickCount: number;
}) {
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={[styles.chartArea, { height: chartHeight }]} onLayout={handleLayout}>
      {Array.from({ length: tickCount }).map((_, index) => (
        <View
          key={`grid-${index}`}
          style={[
            styles.gridLine,
            {
              top: tickCount > 1 ? (chartHeight * index) / (tickCount - 1) : 0,
            },
          ]}
        />
      ))}
      {containerWidth > 0
        ? series.flatMap((item, seriesIndex) =>
            renderSeries(item, seriesIndex, chartHeight, containerWidth, scale),
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
  scale: YAxisScale,
) {
  const plotWidth = Math.max(1, containerWidth - PLOT_PADDING * 2);
  const plotHeight = Math.max(1, chartHeight - PLOT_PADDING * 2);
  const gap = series.values.length > 1 ? 1 / (series.values.length - 1) : 0;
  const points = series.values.map((value, index) => ({
    index,
    value,
    x: PLOT_PADDING + (series.values.length > 1 ? index * gap : 0.5) * plotWidth,
    y: PLOT_PADDING + (1 - normalizeYAxisValue(value, scale)) * plotHeight,
  }));
  const nodes: ReactNode[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const left = points[index];
    const right = points[index + 1];
    if (left.value === 0 && right.value === 0) {
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
    if (point.value === 0) {
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
  axisSpacer: {
    width: 42,
  },
  chartArea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  chartFrame: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
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
    flex: 1,
    flexDirection: 'row',
  },
  labelFrame: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  gridLine: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    right: 0,
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
  unitLabel: {
    fontSize: 9,
    textAlign: 'right',
  },
  yAxis: {
    justifyContent: 'space-between',
    width: 42,
  },
  yAxisLabel: {
    fontSize: 9,
    textAlign: 'right',
  },
});
