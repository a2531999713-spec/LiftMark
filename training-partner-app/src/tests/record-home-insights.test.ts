import { describe, expect, it } from '@jest/globals';

import { buildRecordHomeInsights } from '@/features/history/recordHome/historyInsights';

const item = (id: string, date: string, volume: number, names: string[]) => ({
  completedSets: 4,
  date,
  durationSeconds: 1200,
  exerciseCount: names.length,
  hasCompleteReport: true,
  id,
  mainExerciseNames: names,
  ownerUserId: 'user-a',
  participantNames: ['训练者'],
  sessionType: 'planned' as const,
  title: '训练',
  totalReps: 32,
  totalVolume: volume,
  week: 1,
  weekday: 1,
});

describe('record home insights', () => {
  it('returns a useful sample warning when history is sparse', () => {
    expect(buildRecordHomeInsights([item('s1', '2026-07-01', 1000, ['卧推'])], 'personal')).toContain('当前训练样本较少。');
  });

  it('builds three data-driven personal insights from the visible range', () => {
    const insights = buildRecordHomeInsights([
      item('s1', '2026-07-01', 1000, ['卧推']),
      item('s2', '2026-07-03', 1600, ['卧推', '深蹲']),
    ], 'personal');

    expect(insights).toHaveLength(3);
    expect(insights.join(' ')).toContain('2 次训练');
    expect(insights.join(' ')).toContain('卧推');
    expect(insights.join(' ')).toContain('2026-07-03');
  });
});
