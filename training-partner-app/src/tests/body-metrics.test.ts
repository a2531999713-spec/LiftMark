import { describe, expect, it } from '@jest/globals';

import {
  buildBodyMetricChangeSummary,
  buildBodyMetricGoalProgress,
  buildBodyMetricTrends,
  getBodyMetricDelta,
} from '@/domain/body/body-metrics-analysis';
import type { BodyMetric } from '@/domain/body/body-metrics.types';

function metric(patch: Partial<BodyMetric>): BodyMetric {
  return {
    createdAt: '2026-06-30T00:00:00.000Z',
    date: '2026-06-30',
    id: 'body_metric_1',
    memberId: 'member_1',
    updatedAt: '2026-06-30T00:00:00.000Z',
    ...patch,
  };
}

describe('body metric analysis', () => {
  it('builds chronological trends and skips missing values per metric', () => {
    const trends = buildBodyMetricTrends([
      metric({ date: '2026-06-20', id: 'm2', waistCm: 83, weightKg: 82 }),
      metric({ bodyFatPercent: 18, date: '2026-06-10', id: 'm1', weightKg: 83 }),
      metric({ bodyFatPercent: 17.5, date: '2026-06-30', id: 'm3', waistCm: 82, weightKg: 81.5 }),
    ]);

    expect(trends.weight.map((point) => point.rawDate)).toEqual(['2026-06-10', '2026-06-20', '2026-06-30']);
    expect(trends.bodyFat.map((point) => point.value)).toEqual([18, 17.5]);
    expect(trends.waist.map((point) => point.label)).toEqual(['06/20', '06/30']);
  });

  it('labels deltas for body metric summaries', () => {
    expect(getBodyMetricDelta(81.5, 82)).toBe('down');
    expect(getBodyMetricDelta(82, 82)).toBe('flat');
    expect(getBodyMetricDelta(82.5, 82)).toBe('up');
    expect(getBodyMetricDelta(undefined, 82)).toBe('unknown');
  });

  it('summarizes recent body metric changes', () => {
    const summary = buildBodyMetricChangeSummary([
      metric({ date: '2026-06-01', id: 'm1', waistCm: 84, weightKg: 84 }),
      metric({ date: '2026-06-20', id: 'm2', waistCm: 83, weightKg: 82 }),
      metric({ date: '2026-06-30', id: 'm3', waistCm: 82, weightKg: 81.5 }),
    ]);

    expect(summary.map((item) => item.value)).toEqual(['-0.5 kg', '-1 cm', '-2.5 kg']);
  });

  it('builds target progress against the latest weight', () => {
    const progress = buildBodyMetricGoalProgress(
      {
        createdAt: '2026-06-30T00:00:00.000Z',
        goalType: 'cut',
        id: 'goal_1',
        memberId: 'member_1',
        targetDate: '2026-09-01',
        targetWeightKg: 78,
        updatedAt: '2026-06-30T00:00:00.000Z',
      },
      metric({ weightKg: 81.5 }),
    );

    expect(progress.targetLabel).toBe('78 kg · 2026-09-01');
    expect(progress.remainingKg).toBe(-3.5);
  });
});
