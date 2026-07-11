import type { HistoryCycleOption, HistoryFilter, HistoryQueryResult } from '@/domain/history/history.types';

export type ListHistoryItemsInput = {
  currentPlanCycleId?: string | null;
  filter: HistoryFilter;
  fromDate: string;
  groupId: string;
  limit?: number;
  memberId?: string | null;
  toDate: string;
};

export interface HistoryRepository {
  listHistoryItems(input: ListHistoryItemsInput): Promise<HistoryQueryResult>;
  listHistoryCycleOptions(groupId: string): Promise<HistoryCycleOption[]>;
}
