import { describe, expect, it } from '@jest/globals';

import {
  analyzeExerciseHistory,
  estimateOneRM,
  getGroupHistoryAnalysis,
  selectLargestExerciseSeries,
  type HistorySetEntry,
} from '@/domain/history/history-analysis';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';

function createEntry(patch: Partial<HistorySetEntry> = {}): HistorySetEntry {
  return {
    sessionId: 'session_1',
    exerciseId: 'exercise_bench',
    memberId: 'member_1',
    date: '2026-06-01',
    weight: 100,
    reps: 5,
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
      createEntry({ date: '2026-06-01', completed: true }),
      createEntry({ date: '2026-06-03', completed: false }),
      createEntry({ date: '2026-06-05', completed: false }),
    ]);

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

  it('summarizes local group history from workout details', () => {
    const detail: WorkoutSessionDetail = {
      session: {
        id: 'session_1',
        groupId: 'group_1',
        planId: 'plan_1',
        date: '2026-06-28',
        week: 1,
        weekday: 7,
        title: '腿部日',
        status: 'completed',
        trainingMode: 'group_local',
        createdAt: '2026-06-28T10:00:00.000Z',
        updatedAt: '2026-06-28T11:00:00.000Z',
      },
      exercises: [
        {
          id: 'record_1',
          sessionId: 'session_1',
          exerciseId: 'exercise_squat',
          orderIndex: 1,
          priority: 'A',
        },
      ],
      sets: [
        {
          id: 'set_1',
          sessionId: 'session_1',
          exerciseRecordId: 'record_1',
          memberId: 'member_1',
          setNumber: 1,
          actualWeight: 100,
          actualReps: 5,
          completed: true,
          createdAt: '2026-06-28T10:00:00.000Z',
          updatedAt: '2026-06-28T10:05:00.000Z',
        },
        {
          id: 'set_2',
          sessionId: 'session_1',
          exerciseRecordId: 'record_1',
          memberId: 'member_2',
          setNumber: 1,
          actualWeight: 80,
          actualReps: 5,
          completed: true,
          createdAt: '2026-06-28T10:00:00.000Z',
          updatedAt: '2026-06-28T10:05:00.000Z',
        },
      ],
    };

    const analysis = getGroupHistoryAnalysis({
      details: [detail],
      groupId: 'group_1',
      groupName: '默认训练小组',
      members: [
        {
          id: 'member_1',
          groupId: 'group_1',
          displayName: '张伟',
          role: 'owner',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          id: 'member_2',
          groupId: 'group_1',
          displayName: '小雨',
          role: 'member',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      today: new Date('2026-06-29T12:00:00'),
    });

    expect(analysis.totalVolume).toBe(900);
    expect(analysis.sessionCount).toBe(1);
    expect(analysis.memberContributions[0].memberName).toBe('张伟');
    expect(analysis.trend).toHaveLength(7);
    expect(analysis.recentSessions[0].completedMembers).toBe(2);
  });

  it('groups row, pull-up and other exercises for clickable group exercise details', () => {
    const detail: WorkoutSessionDetail = {
      session: {
        id: 'session_2',
        groupId: 'group_1',
        planId: 'plan_1',
        date: '2026-06-29',
        week: 1,
        weekday: 1,
        title: '背部日',
        status: 'completed',
        trainingMode: 'group_local',
        createdAt: '2026-06-29T10:00:00.000Z',
        updatedAt: '2026-06-29T11:00:00.000Z',
      },
      exercises: [
        { id: 'record_row', sessionId: 'session_2', exerciseId: 'exercise_row', orderIndex: 1, priority: 'A' },
        { id: 'record_pullup', sessionId: 'session_2', exerciseId: 'exercise_pullup', orderIndex: 2, priority: 'A' },
        { id: 'record_curl', sessionId: 'session_2', exerciseId: 'exercise_curl', orderIndex: 3, priority: 'B' },
      ],
      sets: [
        {
          id: 'set_row',
          sessionId: 'session_2',
          exerciseRecordId: 'record_row',
          memberId: 'member_1',
          setNumber: 1,
          actualWeight: 80,
          actualReps: 8,
          completed: true,
          createdAt: '2026-06-29T10:00:00.000Z',
          updatedAt: '2026-06-29T10:05:00.000Z',
        },
        {
          id: 'set_pullup',
          sessionId: 'session_2',
          exerciseRecordId: 'record_pullup',
          memberId: 'member_1',
          setNumber: 1,
          actualWeight: 70,
          actualReps: 6,
          completed: true,
          createdAt: '2026-06-29T10:00:00.000Z',
          updatedAt: '2026-06-29T10:05:00.000Z',
        },
        {
          id: 'set_curl',
          sessionId: 'session_2',
          exerciseRecordId: 'record_curl',
          memberId: 'member_1',
          setNumber: 1,
          actualWeight: 16,
          actualReps: 12,
          completed: true,
          createdAt: '2026-06-29T10:00:00.000Z',
          updatedAt: '2026-06-29T10:05:00.000Z',
        },
      ],
    };

    const analysis = getGroupHistoryAnalysis({
      details: [detail],
      exerciseNamesById: {
        exercise_curl: '哑铃弯举',
        exercise_pullup: '引体向上',
        exercise_row: '杠铃划船',
      },
      groupId: 'group_1',
      groupName: '默认训练小组',
      members: [
        {
          id: 'member_1',
          groupId: 'group_1',
          displayName: '张伟',
          role: 'owner',
          createdAt: '2026-06-01T00:00:00.000Z',
          updatedAt: '2026-06-01T00:00:00.000Z',
        },
      ],
      today: new Date('2026-06-29T12:00:00'),
    });

    expect(analysis.exerciseAnalyses.map((item) => item.key)).toEqual(expect.arrayContaining(['row', 'pullup', 'other']));
  });
});
