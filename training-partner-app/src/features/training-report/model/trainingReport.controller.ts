import type { TrainingReportDetail } from '@/domain/report/trainingReport.types';

export type TrainingReportControllerState =
  | { status: 'loading'; report: null }
  | { status: 'empty'; report: null }
  | { status: 'error'; report: null; message: string }
  | { status: 'ready'; report: TrainingReportDetail };

export const initialTrainingReportState: TrainingReportControllerState = { status: 'loading', report: null };

export function resolveTrainingReportLoadedState(report: TrainingReportDetail | null): TrainingReportControllerState {
  return report ? { status: 'ready', report } : { status: 'empty', report: null };
}

export function resolveTrainingReportErrorState(error: unknown): TrainingReportControllerState {
  return {
    status: 'error',
    report: null,
    message: error instanceof Error ? error.message : '训练报告加载失败。',
  };
}
