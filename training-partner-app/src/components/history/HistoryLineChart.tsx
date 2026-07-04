import { MiniLineChart } from '@/components/ui';

export type HistoryLinePoint = {
  date?: string;
  label: string;
  meta?: string;
  value: number;
};

type HistoryLineChartProps = {
  emptyMessage?: string;
  formatValue: (value: number) => string;
  highlightIndex?: number;
  keyPointIndexes?: number[];
  onPointPress?: (point: HistoryLinePoint, index: number) => void;
  points: HistoryLinePoint[];
  unitLabel?: string;
};

export function HistoryLineChart({
  emptyMessage,
  formatValue,
  highlightIndex,
  keyPointIndexes,
  onPointPress,
  points,
  unitLabel = 'kg',
}: HistoryLineChartProps) {
  const values = points.map((point) => point.value);
  const maxValue = Math.max(0, ...values);
  const maxXAxisLabels = points.length <= 10 ? points.length : 6;

  return (
    <MiniLineChart
      chartHeight={116}
      data={values}
      emptyMessage={emptyMessage ?? '当前范围还没有趋势数据'}
      formatValue={formatValue}
      highlightIndex={highlightIndex}
      keyPointIndexes={keyPointIndexes}
      labels={points.map((point) => point.label)}
      labelSkipStrategy={points.length <= 10 ? 'all' : 'auto'}
      maxXAxisLabels={maxXAxisLabels}
      minChartHeight={Math.max(100, maxValue)}
      onPointPress={(_, index) => {
        const point = points[index];
        if (point) {
          onPointPress?.(point, index);
        }
      }}
      unitLabel={unitLabel}
      valueLabelStrategy="none"
    />
  );
}
