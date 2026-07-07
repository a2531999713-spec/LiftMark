import { useState } from 'react';
import { type DimensionValue, type LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { buildYAxisScale, normalizeYAxisValue } from './chartScale';

type MiniBarLineChartProps = {
  barData: number[];
  lineData: number[];
  labels: string[];
  chartHeight?: number;
  barFormatValue?: (value: number) => string;
  lineFormatValue?: (value: number) => string;
  emptyMessage?: string;
  barUnitLabel?: string;
  lineUnitLabel?: string;
};

const PLOT_PADDING_X = 14;
const PLOT_PADDING_TOP = 14;
const PLOT_PADDING_BOTTOM = 6;

function sanitize(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function getDefaultKeyPointIndexes(data: number[]): number[] {
  const active = data.map((value, index) => ({ index, value })).filter((point) => point.value > 0);
  if (active.length === 0) return [];
  const set = new Set<number>();
  set.add(active.at(-1)!.index);
  set.add(active.reduce((max, point) => (point.value > max.value ? point : max), active[0]).index);
  return [...set];
}

export function MiniBarLineChart({
  barData,
  lineData,
  labels,
  chartHeight = 110,
  barFormatValue = (value) => `${Math.round(value)}`,
  lineFormatValue = (value) => `${Math.round(value)}`,
  emptyMessage = '暂无数据',
  barUnitLabel = 'kg',
  lineUnitLabel = '次',
}: MiniBarLineChartProps) {
  const sanitizedBars = barData.map(sanitize);
  const sanitizedLines = lineData.map(sanitize);
  const hasData = sanitizedBars.some((v) => v > 0) || sanitizedLines.some((v) => v > 0);
  const pointCount = Math.max(sanitizedBars.length, sanitizedLines.length, labels.length);

  if (!hasData || pointCount === 0) {
    return (
      <View style={[styles.container, { minHeight: chartHeight + 28 }]}>
        <View style={styles.emptyContainer}>
          <AppText tone="muted" variant="caption">
            {emptyMessage}
          </AppText>
        </View>
      </View>
    );
  }

  const barScale = buildYAxisScale(sanitizedBars.length > 0 ? sanitizedBars : [0], {
    includeZero: true,
    tickCount: 3,
  });
  const lineScale = buildYAxisScale(sanitizedLines.length > 0 ? sanitizedLines : [0], {
    includeZero: true,
    tickCount: 3,
  });
  const barKeyIndexes = new Set(getDefaultKeyPointIndexes(sanitizedBars));
  const lineKeyIndexes = new Set(getDefaultKeyPointIndexes(sanitizedLines));

  return (
    <View style={styles.container}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.legendBar} />
          <AppText tone="muted" variant="caption">
            训练量 ({barUnitLabel})
          </AppText>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendBar, styles.legendLine]} />
          <AppText tone="muted" variant="caption">
            完成训练 ({lineUnitLabel})
          </AppText>
        </View>
      </View>
      <View style={styles.chartFrame}>
        <View style={[styles.yAxis, { height: chartHeight }]}>
          <AppText numberOfLines={1} style={styles.unitLabel} tone="muted" variant="caption">
            {barUnitLabel}
          </AppText>
          {barScale.ticks.map((tick, index) => (
            <AppText key={`bar-tick-${index}`} numberOfLines={1} style={styles.yAxisLabel} tone="muted" variant="caption">
              {barFormatValue(tick)}
            </AppText>
          ))}
        </View>
        <ChartArea
          chartHeight={chartHeight}
          barData={sanitizedBars}
          lineData={sanitizedLines}
          barScale={barScale}
          lineScale={lineScale}
          barKeyIndexes={barKeyIndexes}
          lineKeyIndexes={lineKeyIndexes}
          barFormatValue={barFormatValue}
          lineFormatValue={lineFormatValue}
        />
      </View>
      <View style={styles.labelFrame}>
        <View style={styles.axisSpacer} />
        <View style={styles.labelRow}>
          {labels.map((label, index) => (
            <View key={`${label}-${index}`} style={styles.labelColumn}>
              <AppText numberOfLines={1} style={styles.labelText} tone="muted" variant="caption">
                {label}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

type ChartAreaProps = {
  chartHeight: number;
  barData: number[];
  lineData: number[];
  barScale: ReturnType<typeof buildYAxisScale>;
  lineScale: ReturnType<typeof buildYAxisScale>;
  barKeyIndexes: Set<number>;
  lineKeyIndexes: Set<number>;
  barFormatValue: (value: number) => string;
  lineFormatValue: (value: number) => string;
};

function ChartArea({
  chartHeight,
  barData,
  lineData,
  barScale,
  lineScale,
  barKeyIndexes,
  lineKeyIndexes,
  barFormatValue,
  lineFormatValue,
}: ChartAreaProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  const pointCount = Math.max(barData.length, lineData.length, 1);
  const slotWidth = pointCount > 0 ? 1 / pointCount : 1;
  const barWidthRatio = 0.55;

  return (
    <View style={[styles.chartArea, { height: chartHeight }]} onLayout={handleLayout}>
      {Array.from({ length: barScale.ticks.length }).map((_, index) => (
        <View
          key={`grid-${index}`}
          style={[
            styles.gridLine,
            {
              top: barScale.ticks.length > 1 ? (chartHeight * index) / (barScale.ticks.length - 1) : 0,
            },
          ]}
        />
      ))}
      {containerWidth > 0
        ? barData.map((value, index) => {
            const plotWidth = Math.max(1, containerWidth - PLOT_PADDING_X * 2);
            const plotHeight = Math.max(1, chartHeight - PLOT_PADDING_TOP - PLOT_PADDING_BOTTOM);
            const slotCenterX = PLOT_PADDING_X + slotWidth * plotWidth * (index + 0.5);
            const barWidth = Math.max(4, slotWidth * plotWidth * barWidthRatio);
            const yPercent = normalizeYAxisValue(value, barScale);
            const barHeight = yPercent * plotHeight;
            const top = PLOT_PADDING_TOP + (plotHeight - barHeight);
            const showLabel = barKeyIndexes.has(index) && value > 0;
            return (
              <View
                key={`bar-${index}`}
                style={[
                  styles.bar,
                  {
                    left: (slotCenterX - barWidth / 2) as DimensionValue,
                    top,
                    width: barWidth,
                    height: barHeight,
                  },
                ]}
              >
                {showLabel ? (
                  <View style={styles.barLabelBubble}>
                    <AppText numberOfLines={1} style={styles.barLabelText} variant="caption" weight="900">
                      {barFormatValue(value)}
                    </AppText>
                  </View>
                ) : null}
              </View>
            );
          })
        : null}
      {containerWidth > 0
        ? renderLine(lineData, lineScale, lineKeyIndexes, lineFormatValue, chartHeight, containerWidth, pointCount)
        : null}
    </View>
  );
}

function renderLine(
  data: number[],
  scale: ReturnType<typeof buildYAxisScale>,
  keyIndexes: Set<number>,
  formatValue: (value: number) => string,
  chartHeight: number,
  containerWidth: number,
  pointCount: number,
) {
  const plotWidth = Math.max(1, containerWidth - PLOT_PADDING_X * 2);
  const plotHeight = Math.max(1, chartHeight - PLOT_PADDING_TOP - PLOT_PADDING_BOTTOM);
  const slotWidth = pointCount > 0 ? 1 / pointCount : 1;
  const activePoints = data
    .map((value, index) => ({
      index,
      value,
      x: PLOT_PADDING_X + slotWidth * plotWidth * (index + 0.5),
      y: PLOT_PADDING_TOP + (1 - normalizeYAxisValue(value, scale)) * plotHeight,
    }))
    .filter((point) => point.value > 0);

  const lines: React.ReactNode[] = [];
  for (let i = 0; i < activePoints.length - 1; i += 1) {
    const left = activePoints[i];
    const right = activePoints[i + 1];
    const dx = right.x - left.x;
    const dy = right.y - left.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const midX = (left.x + right.x) / 2;
    const midY = (left.y + right.y) / 2;
    if (length > 0) {
      lines.push(
        <View
          key={`line-seg-${i}`}
          style={[
            styles.lineSegment,
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

  const dots = activePoints.map((point) => {
    const showLabel = keyIndexes.has(point.index);
    const touchSize = 24;
    return (
      <Pressable
        accessibilityRole="button"
        key={`line-dot-${point.index}`}
        style={[
          styles.lineDotWrapper,
          {
            top: point.y - touchSize / 2,
            height: touchSize,
            width: touchSize,
            left: (point.x - touchSize / 2) as DimensionValue,
          },
        ]}
      >
        {showLabel ? (
          <View style={styles.lineLabelBubble}>
            <AppText numberOfLines={1} style={styles.lineLabelText} variant="caption" weight="900">
              {formatValue(point.value)}
            </AppText>
          </View>
        ) : null}
        <View style={styles.lineDot} />
      </Pressable>
    );
  });

  return lines.concat(dots);
}

const styles = StyleSheet.create({
  axisSpacer: {
    width: 42,
  },
  bar: {
    backgroundColor: colors.brand,
    borderRadius: 4,
    position: 'absolute',
  },
  barLabelBubble: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: 6,
    justifyContent: 'center',
    left: '50%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    shadowColor: colors.brand,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    top: -20,
    transform: [{ translateX: -30 }],
  },
  barLabelText: {
    color: colors.surface,
    fontSize: 10,
  },
  chartArea: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 8,
    flex: 1,
    overflow: 'visible',
    position: 'relative',
  },
  chartFrame: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  container: {
    gap: spacing.xs,
  },
  emptyContainer: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  gridLine: {
    backgroundColor: colors.border,
    height: StyleSheet.hairlineWidth,
    left: 0,
    opacity: 0.72,
    position: 'absolute',
    right: 0,
  },
  labelColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  labelFrame: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  labelRow: {
    flex: 1,
    flexDirection: 'row',
  },
  labelText: {
    fontSize: 10,
  },
  legendBar: {
    borderRadius: 3,
    height: 8,
    width: 14,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  legendLine: {
    backgroundColor: colors.accent,
    borderRadius: 2,
    height: 3,
    width: 14,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.xs,
  },
  lineDot: {
    backgroundColor: colors.accent,
    borderColor: colors.surface,
    borderRadius: 5,
    borderWidth: 2,
    height: 10,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    width: 10,
  },
  lineDotWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
  },
  lineLabelBubble: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 6,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    position: 'absolute',
    top: -18,
  },
  lineLabelText: {
    color: colors.surface,
    fontSize: 10,
  },
  lineSegment: {
    backgroundColor: colors.accent,
    position: 'absolute',
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
