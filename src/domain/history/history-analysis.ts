export type HistorySetEntry = {
  sessionId: string;
  exerciseId: string;
  memberId: string;
  date: string;
  weight?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  completed: boolean;
};

export type HistoryTrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export type HistoryAnalysis = {
  sampleSize: number;
  recentEntries: HistorySetEntry[];
  estimatedOneRMs: number[];
  bestEstimatedOneRM?: number;
  latestEstimatedOneRM?: number;
  isNearPr: boolean;
  completionRate: number;
  weightTrend: HistoryTrendDirection;
  estimatedOneRmTrend: HistoryTrendDirection;
  fatigueFlags: string[];
  suggestions: string[];
};

export type HistorySeries = {
  memberId: string;
  exerciseId: string;
  entries: HistorySetEntry[];
};

export function estimateOneRM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps < 1 || reps > 12) {
    return 0;
  }

  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function takeRecentFive(entries: HistorySetEntry[]): HistorySetEntry[] {
  return [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}

function getTrend(values: number[], threshold = 0.02): HistoryTrendDirection {
  if (values.length < 2) {
    return 'unknown';
  }

  const first = values[0];
  const last = values[values.length - 1];
  if (first <= 0) {
    return 'unknown';
  }

  const ratio = (last - first) / first;
  if (ratio > threshold) {
    return 'up';
  }

  if (ratio < -threshold) {
    return 'down';
  }

  return 'stable';
}

export function analyzeExerciseHistory(entries: HistorySetEntry[]): HistoryAnalysis {
  const recentEntries = takeRecentFive(entries);
  const chronological = [...recentEntries].reverse();
  const estimatedOneRMs = chronological
    .map((entry) => estimateOneRM(entry.weight ?? 0, entry.reps ?? 0))
    .filter((value) => value > 0);
  const weights = chronological
    .map((entry) => entry.weight ?? 0)
    .filter((value) => value > 0);
  const completionRate =
    recentEntries.length === 0
      ? 0
      : recentEntries.filter((entry) => entry.completed).length / recentEntries.length;
  const bestEstimatedOneRM = estimatedOneRMs.length > 0 ? Math.max(...estimatedOneRMs) : undefined;
  const latestEstimatedOneRM = estimatedOneRMs.at(-1);
  const isNearPr = Boolean(
    bestEstimatedOneRM && latestEstimatedOneRM && latestEstimatedOneRM >= bestEstimatedOneRM * 0.97,
  );
  const fatigueFlags = getFatigueFlags(chronological);
  const suggestions = getHistorySuggestions({
    completionRate,
    fatigueFlags,
    isNearPr,
    weightTrend: getTrend(weights),
    estimatedOneRmTrend: getTrend(estimatedOneRMs),
  });

  return {
    sampleSize: recentEntries.length,
    recentEntries,
    estimatedOneRMs,
    bestEstimatedOneRM,
    latestEstimatedOneRM,
    isNearPr,
    completionRate,
    weightTrend: getTrend(weights),
    estimatedOneRmTrend: getTrend(estimatedOneRMs),
    fatigueFlags,
    suggestions,
  };
}

export function selectLargestExerciseSeries(entries: HistorySetEntry[]): HistorySeries | null {
  const groups = new Map<string, HistorySetEntry[]>();

  for (const entry of entries) {
    const key = `${entry.memberId}:${entry.exerciseId}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const largest = [...groups.entries()].sort(([, left], [, right]) => right.length - left.length)[0];
  if (!largest) {
    return null;
  }

  const [key, seriesEntries] = largest;
  const [memberId, exerciseId] = key.split(':');

  return {
    memberId,
    exerciseId,
    entries: seriesEntries,
  };
}

function getFatigueFlags(entries: HistorySetEntry[]): string[] {
  const recent = entries.slice(-5);
  const lastTwo = recent.slice(-2);
  const flags: string[] = [];

  if (lastTwo.length === 2 && lastTwo.every((entry) => (entry.rpe ?? 0) >= 9)) {
    flags.push('连续高 RPE');
  }

  if (lastTwo.length === 2 && lastTwo.every((entry) => !entry.completed)) {
    flags.push('连续未完成');
  }

  const volumes = recent.map((entry) => (entry.weight ?? 0) * (entry.reps ?? 0));
  if (volumes.length >= 2 && volumes[0] > 0 && volumes.at(-1)! < volumes[0] * 0.85) {
    flags.push('训练容量明显下降');
  }

  if (recent.filter((entry) => (entry.rir ?? 99) <= 1).length >= 3) {
    flags.push('RIR 长期偏低');
  }

  return flags;
}

type SuggestionInput = Pick<
  HistoryAnalysis,
  'completionRate' | 'fatigueFlags' | 'isNearPr' | 'weightTrend' | 'estimatedOneRmTrend'
>;

function getHistorySuggestions(input: SuggestionInput): string[] {
  if (input.fatigueFlags.length > 0) {
    return ['近期疲劳偏高，建议维持或减量'];
  }

  if (input.isNearPr) {
    return ['近期表现接近 PR，可考虑小幅尝试'];
  }

  if (input.completionRate >= 0.8 && input.weightTrend !== 'down') {
    return ['状态良好，可以尝试小幅加重', '完成率稳定，可继续推进'];
  }

  if (input.estimatedOneRmTrend === 'down' || input.completionRate < 0.6) {
    return ['表现波动较大，建议观察 1-2 次训练'];
  }

  return ['完成率稳定，可继续推进'];
}
