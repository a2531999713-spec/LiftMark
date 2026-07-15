import type { ID } from '@/domain/common/ids';
import type {
  RecoveryLog,
  RecoveryTrendSummary,
  UpsertRecoveryLogInput,
} from '@/domain/recovery/recovery.types';

export type RecoveryLogScope = {
  memberId: ID;
  ownerUserId: ID;
};

export type RecoveryLogDateScope = RecoveryLogScope & {
  date: string;
};

export type ListMemberRecoveryLogsInput = RecoveryLogScope & {
  fromDate?: string;
  limit?: number;
  toDate?: string;
};

export interface RecoveryRepository {
  getDailyLog(input: RecoveryLogDateScope): Promise<RecoveryLog | null>;
  upsertDailyLog(input: UpsertRecoveryLogInput): Promise<RecoveryLog>;
  listMemberLogs(input: ListMemberRecoveryLogsInput): Promise<RecoveryLog[]>;
  getLatestLog(input: RecoveryLogScope): Promise<RecoveryLog | null>;
  getRecentAssessmentTrend(input: RecoveryLogScope & { limit?: number }): Promise<RecoveryTrendSummary>;
  softDeleteLog(input: RecoveryLogScope & { id: ID }): Promise<void>;
}
