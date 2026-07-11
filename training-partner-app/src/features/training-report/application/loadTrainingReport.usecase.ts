import type { TrainingReportRepository } from '@/data/repositories/trainingReportRepository';
import { buildTrainingReportDetail } from '@/domain/report/trainingReport.service';

export async function loadTrainingReport(
  repository: TrainingReportRepository,
  sessionId: string,
) {
  const source = await repository.getTrainingReportSource(sessionId);
  return source ? buildTrainingReportDetail(source) : null;
}
