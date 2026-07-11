import { describe, expect, it } from '@jest/globals';

import {
  buildTrainingReportDetail,
  estimateTrainingCalories,
  getTrainingIntensityLevel,
} from '@/domain/report/trainingReport.service';
import type { TrainingReportSource } from '@/domain/report/trainingReport.types';

function createSource(): TrainingReportSource {
  return {
    exercises: [{
      exerciseId: 'exercise-bench',
      exerciseName: '杠铃卧推',
      isTemporary: false,
      recordId: 'record-1',
      sets: [
        { completed: true, memberId: 'member-a', memberName: '成员甲', reps: 5, setNumber: 1, skipped: false, weight: 80 },
        { completed: true, memberId: 'member-b', memberName: '成员乙', reps: 8, setNumber: 1, skipped: false, weight: 40 },
        { completed: false, memberId: 'member-a', memberName: '成员甲', reps: 5, setNumber: 2, skipped: true, weight: 80 },
      ],
    }],
    finishedAt: '2026-07-11T11:00:00.000Z',
    groupId: 'group-1',
    hasReport: false,
    ownerUserId: 'account-a',
    participantBodyweights: [
      { memberId: 'member-a', memberName: '成员甲', weightKg: 80 },
      { memberId: 'member-b', memberName: '成员乙' },
    ],
    planId: 'plan-1',
    sessionDate: '2026-07-11',
    sessionId: 'session-1',
    sessionTitle: '上肢力量',
    sessionType: 'planned',
    startedAt: '2026-07-11T10:00:00.000Z',
    week: 2,
    weekday: 3,
  };
}

describe('training report domain', () => {
  it('calculates completed sets, reps, volume, exercises, and members', () => {
    const report = buildTrainingReportDetail(createSource());
    expect(report.totalSets).toBe(2);
    expect(report.totalReps).toBe(13);
    expect(report.totalVolume).toBe(720);
    expect(report.exerciseCount).toBe(1);
    expect(report.members).toHaveLength(2);
    expect(report.isHistoricalFallback).toBe(true);
  });

  it('uses the default bodyweight only for participants without a weight', () => {
    const estimate = estimateTrainingCalories({
      durationSeconds: 3600,
      intensity: 'medium',
      participantBodyweightsKg: [80, undefined],
    });
    expect(estimate.estimatedCalories).toBe(725);
    expect(estimate.usedDefaultBodyweight).toBe(true);
    expect(estimate.estimatedCaloriesMin).toBeLessThan(estimate.estimatedCaloriesMax);
  });

  it('classifies report intensity deterministically', () => {
    expect(getTrainingIntensityLevel({ durationSeconds: 20 * 60, totalSets: 6, totalVolume: 1_000 })).toBe('low');
    expect(getTrainingIntensityLevel({ durationSeconds: 40 * 60, totalSets: 12, totalVolume: 4_000 })).toBe('medium');
    expect(getTrainingIntensityLevel({ durationSeconds: 80 * 60, totalSets: 25, totalVolume: 13_000 })).toBe('high');
  });
});
