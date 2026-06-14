import { describe, expect, it } from '@jest/globals';

import {
  analyzeExerciseHistory,
  estimateOneRM,
  selectLargestExerciseSeries,
  type HistorySetEntry,
} from '@/domain/history/history-analysis';

function createEntry(patch: Partial<HistorySetEntry> = {}): HistorySetEntry {
  return {
    sessionId: 'session_1',
    exerciseId: 'exercise_bench',
    memberId: 'member_1',
    date: '2026-06-01',
    weight: 100,
    reps: 5,
    rpe: 8,
    rir: 2,
    completed: true,
    ...patch,
  };
}

describe('history analysis', () => {
  it('uses the Epley formula to estimate 1RM', () => {
    expect(estimateOneRM(100, 5)).toBe(116.7);
  });

  it('ignores estimated 1RM when reps are outside the supported range', () => {
    expect(estimateOneRM(100, 13)).toBe(0);
    expect(estimateOneRM(0, 5)).toBe(0);
  });

  it('detects PR proximity and returns Chinese suggestion text', () => {
    const analysis = analyzeExerciseHistory([
      createEntry({ date: '2026-06-01', weight: 95, reps: 5 }),
      createEntry({ date: '2026-06-05', weight: 100, reps: 5 }),
    ]);

    expect(analysis.isNearPr).toBe(true);
    expect(analysis.suggestions).toContain('近期表现接近 PR，可考虑小幅尝试');
  });

  it('marks fatigue as a suggestion instead of an absolute conclusion', () => {
    const analysis = analyzeExerciseHistory([
      createEntry({ date: '2026-06-01', completed: true, rpe: 8 }),
      createEntry({ date: '2026-06-03', completed: false, rpe: 9 }),
      createEntry({ date: '2026-06-05', completed: false, rpe: 9.5 }),
    ]);

    expect(analysis.fatigueFlags).toContain('连续高 RPE');
    expect(analysis.fatigueFlags).toContain('连续未完成');
    expect(analysis.suggestions).toEqual(['近期疲劳偏高，建议维持或减量']);
  });

  it('selects the member and exercise pair with the largest sample size', () => {
    const series = selectLargestExerciseSeries([
      createEntry({ exerciseId: 'exercise_bench', memberId: 'member_1' }),
      createEntry({ exerciseId: 'exercise_bench', memberId: 'member_1', date: '2026-06-02' }),
      createEntry({ exerciseId: 'exercise_squat', memberId: 'member_2' }),
    ]);

    expect(series?.exerciseId).toBe('exercise_bench');
    expect(series?.memberId).toBe('member_1');
    expect(series?.entries).toHaveLength(2);
  });
});
