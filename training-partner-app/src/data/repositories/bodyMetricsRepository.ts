import type { ID } from '@/domain/common/ids';
import type { BodyMetric, BodyMetricGoal, UpsertBodyMetricGoalInput, UpsertBodyMetricInput } from '@/domain/body/body-metrics.types';

export interface BodyMetricsRepository {
  getGoal(memberId: ID): Promise<BodyMetricGoal | null>;
  getMetricForDate(memberId: ID, date: string): Promise<BodyMetric | null>;
  listMetrics(memberId: ID, limit?: number): Promise<BodyMetric[]>;
  upsertGoal(input: UpsertBodyMetricGoalInput): Promise<BodyMetricGoal>;
  upsertMetric(input: UpsertBodyMetricInput): Promise<BodyMetric>;
}
