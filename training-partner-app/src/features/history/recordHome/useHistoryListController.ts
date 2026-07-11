import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { HistoryCycleOption, HistoryFilter, HistoryListItem } from '@/domain/history/history.types';
import type { DateRangeValue } from '@/features/history/shared/dateRange';

export type HistoryListControllerState =
  | { status: 'loading'; cycles: HistoryCycleOption[]; items: HistoryListItem[] }
  | { status: 'ready'; cycles: HistoryCycleOption[]; items: HistoryListItem[] }
  | { status: 'empty'; cycles: HistoryCycleOption[]; items: HistoryListItem[] }
  | { status: 'error'; cycles: HistoryCycleOption[]; items: HistoryListItem[]; message: string };

export function useHistoryListController(input: {
  currentPlanCycleId?: string | null;
  filter: HistoryFilter;
  groupId?: string | null;
  memberId?: string | null;
  range: DateRangeValue;
}) {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [state, setState] = useState<HistoryListControllerState>({ status: 'loading', cycles: [], items: [] });
  const load = useCallback(async () => {
    if (!input.groupId) {
      setState({ status: 'empty', cycles: [], items: [] });
      return;
    }
    setState((current) => ({ status: 'loading', cycles: current.cycles, items: current.items }));
    try {
      await initializeLocalDatabase();
      const [result, cycles] = await Promise.all([
        repositories.historyRepository.listHistoryItems({
          currentPlanCycleId: input.currentPlanCycleId,
          filter: input.filter,
          fromDate: input.range.fromDate,
          groupId: input.groupId,
          limit: 200,
          memberId: input.memberId,
          toDate: input.range.toDate,
        }),
        repositories.historyRepository.listHistoryCycleOptions(input.groupId),
      ]);
      setState({ status: result.items.length > 0 ? 'ready' : 'empty', cycles, items: result.items });
    } catch (error) {
      setState({
        status: 'error',
        cycles: [],
        items: [],
        message: error instanceof Error ? error.message : '历史记录加载失败。',
      });
    }
  }, [input.currentPlanCycleId, input.filter, input.groupId, input.memberId, input.range.fromDate, input.range.toDate, repositories]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { reload: load, state };
}
