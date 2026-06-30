import type { BodyMetric, BodyMetricGoal, BodyMetricTrendPoint } from './body-metrics.types';

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

function buildTrend(metrics: BodyMetric[], pickValue: (metric: BodyMetric) => number | undefined): BodyMetricTrendPoint[] {
  return metrics
    .filter((metric) => pickValue(metric) !== undefined)
    .slice(-12)
    .map((metric) => ({
      label: formatShortDate(metric.date),
      rawDate: metric.date,
      value: pickValue(metric) ?? 0,
    }));
}

export function buildBodyMetricTrends(metrics: BodyMetric[]) {
  const chronological = [...metrics].sort((left, right) => left.date.localeCompare(right.date));
  return {
    bodyFat: buildTrend(chronological, (metric) => metric.bodyFatPercent),
    waist: buildTrend(chronological, (metric) => metric.waistCm),
    weight: buildTrend(chronological, (metric) => metric.weightKg),
  };
}

export function getBodyMetricDelta(current?: number, previous?: number): 'down' | 'flat' | 'up' | 'unknown' {
  if (current === undefined || previous === undefined) {
    return 'unknown';
  }

  const delta = Math.round((current - previous) * 10) / 10;
  if (Math.abs(delta) < 0.1) {
    return 'flat';
  }

  return delta > 0 ? 'up' : 'down';
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function getDelta(current?: number, previous?: number): number | undefined {
  if (current === undefined || previous === undefined) {
    return undefined;
  }

  return roundOne(current - previous);
}

function getOldestWithinDays(metrics: BodyMetric[], days: number, latestDate: string): BodyMetric | undefined {
  const latest = new Date(`${latestDate}T12:00:00`);
  const minDate = new Date(latest);
  minDate.setDate(minDate.getDate() - days);
  const minDateText = minDate.toISOString().slice(0, 10);
  return [...metrics]
    .filter((metric) => metric.date >= minDateText && metric.date <= latestDate)
    .sort((left, right) => left.date.localeCompare(right.date))[0];
}

export type BodyMetricChangeSummary = {
  label: string;
  value: string;
  tone: 'accent' | 'neutral' | 'success' | 'warning';
};

export type BodyMetricGoalProgress = {
  description: string;
  remainingKg?: number;
  targetLabel: string;
};

export type BodyTrainingCorrelationInput = {
  completedSets: number;
  sessionCount: number;
  totalVolume: number;
};

export function buildBodyMetricChangeSummary(metrics: BodyMetric[]): BodyMetricChangeSummary[] {
  const chronological = [...metrics].sort((left, right) => left.date.localeCompare(right.date));
  const latest = chronological.at(-1);
  const previous = chronological.at(-2);
  const monthBaseline = latest ? getOldestWithinDays(chronological, 30, latest.date) : undefined;
  const weightDelta = getDelta(latest?.weightKg, previous?.weightKg);
  const waistDelta = getDelta(latest?.waistCm, previous?.waistCm);
  const monthWeightDelta = getDelta(latest?.weightKg, monthBaseline?.weightKg);

  return [
    {
      label: '较上次体重',
      value: weightDelta === undefined ? '样本不足' : `${weightDelta > 0 ? '+' : ''}${weightDelta} kg`,
      tone: weightDelta === undefined || Math.abs(weightDelta) < 0.1 ? 'neutral' : weightDelta > 0 ? 'accent' : 'success',
    },
    {
      label: '较上次腰围',
      value: waistDelta === undefined ? '样本不足' : `${waistDelta > 0 ? '+' : ''}${waistDelta} cm`,
      tone: waistDelta === undefined || Math.abs(waistDelta) < 0.1 ? 'neutral' : waistDelta > 0 ? 'warning' : 'success',
    },
    {
      label: '30 天体重',
      value: monthWeightDelta === undefined ? '继续记录' : `${monthWeightDelta > 0 ? '+' : ''}${monthWeightDelta} kg`,
      tone:
        monthWeightDelta === undefined || Math.abs(monthWeightDelta) < 0.1
          ? 'neutral'
          : monthWeightDelta > 0
            ? 'accent'
            : 'success',
    },
  ];
}

export function buildBodyMetricGoalProgress(goal: BodyMetricGoal | null, latest?: BodyMetric): BodyMetricGoalProgress {
  if (!goal) {
    return {
      description: '设置目标后可对照当前体重和目标日期查看进度。',
      targetLabel: '未设置目标',
    };
  }

  const goalLabels: Record<BodyMetricGoal['goalType'], string> = {
    bulk: '增肌增重',
    cut: '减脂减重',
    maintain: '维持体态',
  };
  const remainingKg =
    goal.targetWeightKg !== undefined && latest?.weightKg !== undefined
      ? roundOne(goal.targetWeightKg - latest.weightKg)
      : undefined;
  let direction = '保持当前节奏';
  if (remainingKg !== undefined && Math.abs(remainingKg) >= 0.1) {
    if (goal.goalType === 'bulk') {
      direction = remainingKg > 0 ? `距离目标还差 ${remainingKg} kg` : `已超过目标 ${Math.abs(remainingKg)} kg`;
    } else if (goal.goalType === 'cut') {
      direction = remainingKg < 0 ? `距离目标还需减少 ${Math.abs(remainingKg)} kg` : `已低于目标 ${remainingKg} kg`;
    } else {
      direction = `距离目标相差 ${Math.abs(remainingKg)} kg`;
    }
  }

  return {
    description: `${goalLabels[goal.goalType]} · ${direction}`,
    remainingKg,
    targetLabel: goal.targetWeightKg ? `${goal.targetWeightKg} kg${goal.targetDate ? ` · ${goal.targetDate}` : ''}` : goalLabels[goal.goalType],
  };
}

export function buildBodyTrainingCorrelation(
  metrics: BodyMetric[],
  training: BodyTrainingCorrelationInput,
): BodyMetricChangeSummary[] {
  const changes = buildBodyMetricChangeSummary(metrics);
  const monthWeight = changes.find((item) => item.label === '30 天体重')?.value ?? '继续记录';

  return [
    {
      label: '近 28 天训练',
      value: `${training.sessionCount} 次 · ${training.completedSets} 组`,
      tone: training.sessionCount > 0 ? 'accent' : 'neutral',
    },
    {
      label: '训练量',
      value: `${Math.round(training.totalVolume).toLocaleString('zh-CN')} kg`,
      tone: training.totalVolume > 0 ? 'success' : 'neutral',
    },
    {
      label: '体重变化',
      value: monthWeight,
      tone: 'neutral',
    },
  ];
}
