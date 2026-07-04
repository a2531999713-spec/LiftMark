import { useState } from 'react';
import { Pressable, type DimensionValue, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { buildYAxisScale, normalizeYAxisValue } from './chartScale';

type MiniLineChartProps = {
  data: number[];
  labels: string[];
  highlightIndex?: number;
  includeZero?: boolean;
  labelFormatter?: (label: string, index: number) => string;
  labelSkipStrategy?: 'all' | 'auto';
  maxXAxisLabels?: number;
  minChartHeight?: number;
  chartHeight?: number;
  showValues?: boolean;
  valueLabelStrategy?: 'none' | 'all' | 'keyPoints';
  keyPointIndexes?: number[];
  onPointPress?: (point: { index: number; value: number; label?: string }, index: number) => void;
  getPointMeta?: (index: number) => Record<string, unknown> | undefined;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
  unitLabel?: string;
  yAxisTickCount?: number;
};

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

function getDefaultKeyPointIndexes(data: number[], highlightIndex?: number): number[] {
  const indexes = new Set<number>();
  const active = data
    .map((value, index) => ({ index, value }))
    .filter((point) => point.value > 0);

  if (active.length === 0) {
    return [];
  }

  indexes.add(active.at(-1)!.index);
  indexes.add(active.reduce((max, point) => (point.value > max.value ? point : max), active[0]).index);
  indexes.add(active.reduce((min, point) => (point.value < min.value ? point : min), active[0]).index);
  if (highlightIndex !== undefined) {
    indexes.add(highlightIndex);
  }

  return [...indexes];
}

export function MiniLineChart({
  data,
  labels,
  highlightIndex,
  includeZero = true,
  labelFormatter = (label) => label,
  labelSkipStrategy = 'auto',
  maxXAxisLabels = 5,
  minChartHeight = 100,
  chartHeight,
  showValues = false,
  valueLabelStrategy,
  keyPointIndexes,
  onPointPress,
  formatValue = (value) => `${Math.round(value)}`,
  emptyMessage = '暂无数据',
  unitLabel,
  yAxisTickCount = 3,
}: MiniLineChartProps) {
  const sanitizedData = data.map(sanitizeValue);
  const hasData = sanitizedData.some((value) => value !== 0);
  const effectiveChartHeight = chartHeight ?? 80;
  const pointCount = sanitizedData.length;
  const scale = buildYAxisScale(sanitizedData.length > 0 ? sanitizedData : [0], {
    includeZero,
    minRange: minChartHeight,
    tickCount: yAxisTickCount,
  });
  const tickValues = scale.ticks;
  const visibleXAxisIndexes = getVisibleXAxisIndexes(labels.length, maxXAxisLabels, labelSkipStrategy);
  const effectiveLabelStrategy = valueLabelStrategy ?? (showValues ? 'all' : 'none');
  const valueLabelIndexes =
    effectiveLabelStrategy === 'all'
      ? new Set(Array.from({ length: pointCount }, (_, index) => index))
      : effectiveLabelStrategy === 'keyPoints'
        ? new Set(keyPointIndexes ?? getDefaultKeyPointIndexes(sanitizedData, highlightIndex))
        : new Set<number>();
  const renderedLabelIndexes = [...new Set([...visibleXAxisIndexes, ...valueLabelIndexes])]
    .filter((index) => index >= 0 && index < pointCount)
    .sort((left, right) => left - right);

  if (!hasData) {
    return (
      <View style={[styles.container, { minHeight: effectiveChartHeight + 28 }]}>
        <View style={styles.emptyContainer}>
          <AppText tone="muted" variant="caption">
            {emptyMessage}
          </AppText>
        </View>
      </View>
    );
  }

  const gap = pointCount > 1 ? 1 / (pointCount - 1) : 0;
  const points = sanitizedData.map((value, index) => {
    const xPercent = pointCount > 1 ? index * gap : 0;
    const yPercent = normalizeYAxisValue(value, scale);
    return { index, value, xPercent, yPercent };
  });

  return (
    <View style={styles.container}>
      <View style={styles.chartFrame}>
        <View style={[styles.yAxis, { height: effectiveChartHeight }]}>
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
        <ChartArea
          chartHeight={effectiveChartHeight}
          highlightIndex={highlightIndex}
          labels={labels}
          onPointPress={onPointPress}
          points={points}
          tickCount={tickValues.length}
        />
      </View>
      <View style={styles.labelFrame}>
        <View style={styles.axisSpacer} />
        <View style={styles.labelRow}>
        {renderedLabelIndexes.map((index) => {
          const label = labels[index] ?? '';
          const isAxisLabelVisible = visibleXAxisIndexes.has(index);
          const isValueVisible = valueLabelIndexes.has(index);
          const labelPosition =
            pointCount <= 1
              ? styles.labelColumnSingle
              : index === 0
                ? styles.labelColumnStart
                : index === pointCount - 1
                  ? styles.labelColumnEnd
                  : {
                      left: `${(index / Math.max(1, pointCount - 1)) * 100}%` as DimensionValue,
                      marginLeft: -32,
                    };
          return (
          <View key={`${label}-${index}`} style={[styles.labelColumn, labelPosition]}>
            {isValueVisible && sanitizedData[index] > 0 ? (
              <AppText
                numberOfLines={1}
                style={index === highlightIndex && styles.highlightValue}
                tone={index === highlightIndex ? 'brand' : 'muted'}
                variant="caption"
                weight={index === highlightIndex ? '900' : '400'}
              >
                {formatValue(sanitizedData[index])}
              </AppText>
            ) : (
              <View style={styles.valuePlaceholder} />
            )}
            <AppText
              numberOfLines={1}
              style={styles.labelText}
              tone={index === highlightIndex ? 'default' : 'muted'}
              variant="caption"
              weight={index === highlightIndex ? '900' : '400'}
            >
              {isAxisLabelVisible ? labelFormatter(label, index) : ''}
            </AppText>
          </View>
          );
        })}
        </View>
      </View>
    </View>
  );
}

type ChartPoint = { index: number; value: number; xPercent: number; yPercent: number };

type ChartAreaProps = {
  chartHeight: number;
  highlightIndex?: number;
  labels: string[];
  onPointPress?: (point: { index: number; value: number; label?: string }, index: number) => void;
  points: ChartPoint[];
  tickCount: number;
};

const PLOT_PADDING = 12;

function ChartArea({ chartHeight, highlightIndex, labels, onPointPress, points, tickCount }: ChartAreaProps) {
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
        ? renderConnectingLines(points, chartHeight, containerWidth).concat(
            points.map((point, arrayIndex) =>
              renderPoint(point, arrayIndex, chartHeight, containerWidth, highlightIndex, labels, onPointPress),
            ),
          )
        : null}
    </View>
  );
}

function renderConnectingLines(
  points: ChartPoint[],
  chartHeight: number,
  containerWidth: number,
) {
  const lines: React.ReactNode[] = [];
  const plotWidth = Math.max(1, containerWidth - PLOT_PADDING * 2);
  const plotHeight = Math.max(1, chartHeight - PLOT_PADDING * 2);
  for (let index = 0; index < points.length - 1; index++) {
    const left = points[index];
    const right = points[index + 1];
    const leftX = PLOT_PADDING + left.xPercent * plotWidth;
    const leftY = PLOT_PADDING + (1 - left.yPercent) * plotHeight;
    const rightX = PLOT_PADDING + right.xPercent * plotWidth;
    const rightY = PLOT_PADDING + (1 - right.yPercent) * plotHeight;

    const dx = rightX - leftX;
    const dy = rightY - leftY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const midX = (leftX + rightX) / 2;
    const midY = (leftY + rightY) / 2;

    if (length > 0 && (left.value !== 0 || right.value !== 0)) {
      lines.push(
        <View
          key={`line-${index}`}
          style={[
            styles.connectingLine,
            {
              height: 2,
              left: (midX - length / 2) as DimensionValue,
              top: midY - 1,
              transform: [{ rotate: `${angle}deg` }],
              width: length,
            },
          ]}
        />,
      );
    }
  }
  return lines;
}

function renderPoint(
  point: ChartPoint,
  arrayIndex: number,
  chartHeight: number,
  containerWidth: number,
  highlightIndex?: number,
  labels?: string[],
  onPointPress?: (point: { index: number; value: number; label?: string }, index: number) => void,
) {
  const isHighlighted = point.index === highlightIndex;
  const plotWidth = Math.max(1, containerWidth - PLOT_PADDING * 2);
  const plotHeight = Math.max(1, chartHeight - PLOT_PADDING * 2);
  const leftPx = PLOT_PADDING + point.xPercent * plotWidth;
  const top = PLOT_PADDING + (1 - point.yPercent) * plotHeight;
  const dotSize = isHighlighted ? 10 : point.value !== 0 ? 7 : 5;
  const touchSize = 32;

  return (
    <Pressable
      accessibilityRole="button"
      key={`point-${arrayIndex}`}
      onPress={() => onPointPress?.({ index: point.index, label: labels?.[point.index], value: point.value }, point.index)}
      style={[
        styles.pointWrapper,
        {
          top: top - touchSize / 2,
          height: touchSize,
          width: touchSize,
          left: (leftPx - touchSize / 2) as DimensionValue,
        },
      ]}
    >
      <View
        style={[
          styles.point,
          {
            borderRadius: dotSize / 2,
            height: dotSize,
            width: dotSize,
          },
          point.value !== 0
            ? isHighlighted
              ? styles.pointHighlight
              : styles.pointActive
            : styles.pointEmpty,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  axisSpacer: {
    width: 42,
  },
  chartFrame: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  container: {
    gap: spacing.xs,
  },
  chartArea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  labelRow: {
    flex: 1,
    minHeight: 34,
    position: 'relative',
  },
  labelFrame: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  labelColumn: {
    alignItems: 'center',
    gap: 2,
    position: 'absolute',
    top: 0,
    width: 64,
  },
  labelColumnEnd: {
    alignItems: 'flex-end',
    right: 0,
  },
  labelColumnSingle: {
    left: '50%',
    marginLeft: -32,
  },
  labelColumnStart: {
    alignItems: 'flex-start',
    left: 0,
  },
  valuePlaceholder: {
    height: 12,
  },
  labelText: {
    fontSize: 10,
  },
  highlightValue: {
    fontSize: 10,
  },
  connectingLine: {
    backgroundColor: colors.primary,
    position: 'absolute',
  },
  gridLine: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    right: 0,
  },
  pointWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  point: {
  },
  pointActive: {
    backgroundColor: colors.primary,
  },
  pointHighlight: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  pointEmpty: {
    backgroundColor: colors.borderStrong,
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
