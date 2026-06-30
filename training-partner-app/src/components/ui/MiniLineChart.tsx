import { useState } from 'react';
import { type DimensionValue, type LayoutChangeEvent, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';

type MiniLineChartProps = {
  data: number[];
  labels: string[];
  highlightIndex?: number;
  minChartHeight?: number;
  chartHeight?: number;
  showValues?: boolean;
  formatValue?: (value: number) => string;
  emptyMessage?: string;
};

function sanitizeValue(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  return value;
}

export function MiniLineChart({
  data,
  labels,
  highlightIndex,
  minChartHeight = 100,
  chartHeight,
  showValues = false,
  formatValue = (value) => `${Math.round(value)}`,
  emptyMessage = '暂无数据',
}: MiniLineChartProps) {
  const sanitizedData = data.map(sanitizeValue);
  const maxRaw = Math.max(...sanitizedData);
  const effectiveMax = Math.max(minChartHeight, maxRaw);
  const hasData = sanitizedData.some((value) => value > 0);
  const effectiveChartHeight = chartHeight ?? 80;
  const pointCount = sanitizedData.length;

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
    const xPercent = pointCount > 1 ? index * gap : 0.5;
    const yPercent = effectiveMax > 0 ? value / effectiveMax : 0;
    return { index, value, xPercent, yPercent };
  });

  return (
    <View style={styles.container}>
      <ChartArea
        chartHeight={effectiveChartHeight}
        highlightIndex={highlightIndex}
        points={points}
      />
      <View style={styles.labelRow}>
        {labels.map((label, index) => (
          <View key={label} style={styles.labelColumn}>
            {showValues && sanitizedData[index] > 0 ? (
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
              {label}
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

type ChartPoint = { index: number; value: number; xPercent: number; yPercent: number };

type ChartAreaProps = {
  chartHeight: number;
  highlightIndex?: number;
  points: ChartPoint[];
};

function ChartArea({ chartHeight, highlightIndex, points }: ChartAreaProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  function handleLayout(event: LayoutChangeEvent) {
    setContainerWidth(event.nativeEvent.layout.width);
  }

  return (
    <View style={[styles.chartArea, { height: chartHeight }]} onLayout={handleLayout}>
      {containerWidth > 0
        ? renderConnectingLines(points, chartHeight, containerWidth).concat(
            points.map((point, arrayIndex) =>
              renderPoint(point, arrayIndex, chartHeight, containerWidth, highlightIndex),
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
  for (let index = 0; index < points.length - 1; index++) {
    const left = points[index];
    const right = points[index + 1];
    const leftX = left.xPercent * containerWidth;
    const leftY = (1 - left.yPercent) * chartHeight;
    const rightX = right.xPercent * containerWidth;
    const rightY = (1 - right.yPercent) * chartHeight;

    const dx = rightX - leftX;
    const dy = rightY - leftY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const midX = (leftX + rightX) / 2;
    const midY = (leftY + rightY) / 2;

    if (length > 0 && (left.yPercent > 0 || right.yPercent > 0)) {
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
) {
  const isHighlighted = point.index === highlightIndex;
  const leftPx = point.xPercent * containerWidth;
  const top = (1 - point.yPercent) * chartHeight;
  const dotSize = isHighlighted ? 10 : point.value > 0 ? 7 : 5;

  return (
    <View
      key={`point-${arrayIndex}`}
      style={[
        styles.pointWrapper,
        {
          left: (leftPx - dotSize / 2) as DimensionValue,
          top: top - dotSize / 2,
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
          point.value > 0
            ? isHighlighted
              ? styles.pointHighlight
              : styles.pointActive
            : styles.pointEmpty,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  chartArea: {
    position: 'relative',
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
  labelColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
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
  pointWrapper: {
    position: 'absolute',
  },
  point: {
    position: 'absolute',
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
});
