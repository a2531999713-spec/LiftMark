export type YAxisScaleOptions = {
  includeZero?: boolean;
  minRange?: number;
  paddingRatio?: number;
  tickCount?: number;
};

export type YAxisScale = {
  maxValue: number;
  minValue: number;
  range: number;
  ticks: number[];
};

function sanitizeFiniteValues(values: number[]): number[] {
  return values.filter((value) => Number.isFinite(value));
}

function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) {
    return 1;
  }

  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const normalized = rawStep / magnitude;
  const niceNormalized =
    normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 2.5
          ? 2.5
          : normalized <= 5
            ? 5
            : 10;

  return niceNormalized * magnitude;
}

export function buildYAxisScale(values: number[], options: YAxisScaleOptions = {}): YAxisScale {
  const {
    includeZero = true,
    minRange = 1,
    paddingRatio = 0.08,
    tickCount = 3,
  } = options;
  const finiteValues = sanitizeFiniteValues(values);
  const rawMin = finiteValues.length > 0 ? Math.min(...finiteValues) : 0;
  const rawMax = finiteValues.length > 0 ? Math.max(...finiteValues) : 0;
  const baselineMin = includeZero && rawMin >= 0 ? 0 : rawMin;
  const rawRange = rawMax - baselineMin;
  const safeRange = Math.max(rawRange, minRange, Math.abs(rawMax) * paddingRatio, 1);
  const paddedMin = includeZero && rawMin >= 0 ? 0 : baselineMin - safeRange * paddingRatio;
  const paddedMax = rawMax + safeRange * paddingRatio;
  const resolvedTickCount = Math.max(2, tickCount);
  const step = niceStep((paddedMax - paddedMin) / (resolvedTickCount - 1));
  const minValue = includeZero && rawMin >= 0 ? 0 : Math.floor(paddedMin / step) * step;
  const maxValue = Math.max(minValue + step, Math.ceil(paddedMax / step) * step);
  const range = Math.max(maxValue - minValue, step, 1);
  const ticks = Array.from({ length: resolvedTickCount }, (_, index) => maxValue - (range * index) / (resolvedTickCount - 1));

  return { maxValue, minValue, range, ticks };
}

export function normalizeYAxisValue(value: number, scale: Pick<YAxisScale, 'minValue' | 'range'>): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, (value - scale.minValue) / scale.range));
}
