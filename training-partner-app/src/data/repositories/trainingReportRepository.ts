import type { TrainingReportSource } from '@/domain/report/trainingReport.types';

export interface TrainingReportRepository {
  getTrainingReportSource(sessionId: string): Promise<TrainingReportSource | null>;
}
