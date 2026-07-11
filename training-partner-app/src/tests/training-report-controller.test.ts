import { describe, expect, it } from '@jest/globals';

import {
  initialTrainingReportState,
  resolveTrainingReportErrorState,
  resolveTrainingReportLoadedState,
} from '@/features/training-report/model/trainingReport.controller';
import { buildTrainingReportDetail } from '@/domain/report/trainingReport.service';

describe('training report controller states', () => {
  it('distinguishes loading, empty, and error states', () => {
    expect(initialTrainingReportState.status).toBe('loading');
    expect(resolveTrainingReportLoadedState(null).status).toBe('empty');
    expect(resolveTrainingReportErrorState(new Error('读取失败'))).toMatchObject({ status: 'error', message: '读取失败' });
  });

  it('returns ready for an old record built without a persisted report', () => {
    const report = buildTrainingReportDetail({
      exercises: [],
      groupId: 'group-a',
      hasReport: false,
      ownerUserId: 'account-a',
      participantBodyweights: [],
      planId: 'free_training',
      sessionDate: '2026-07-11',
      sessionId: 'session-a',
      sessionTitle: '旧训练',
      sessionType: 'free',
      week: 1,
      weekday: 1,
    });
    const state = resolveTrainingReportLoadedState(report);
    expect(state.status).toBe('ready');
    if (state.status === 'ready') expect(state.report.isHistoricalFallback).toBe(true);
  });
});
