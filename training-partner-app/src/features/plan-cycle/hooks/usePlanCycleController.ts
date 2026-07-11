import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { HistoryListItem } from '@/domain/history/history.types';
import type { PlanCycleOverview } from '@/domain/plan/plan.types';

export type PlanCycleControllerState =
  | { status: 'loading'; overview: null; sessions: HistoryListItem[] }
  | { status: 'empty'; overview: null; sessions: HistoryListItem[] }
  | { status: 'error'; overview: null; sessions: HistoryListItem[]; message: string }
  | { status: 'ready'; overview: PlanCycleOverview; sessions: HistoryListItem[] };

export function usePlanCycleController(planCycleId?: string) {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [isWorking, setWorking] = useState(false);
  const [state, setState] = useState<PlanCycleControllerState>({ status: 'loading', overview: null, sessions: [] });
  const load = useCallback(async () => {
    if (!planCycleId) {
      setState({ status: 'empty', overview: null, sessions: [] });
      return;
    }
    setState((current) => ({ status: 'loading', overview: null, sessions: current.sessions }));
    try {
      await initializeLocalDatabase();
      const overview = await repositories.planRepository.getPlanCycleOverview(planCycleId);
      const history = await repositories.historyRepository.listHistoryItems({
        filter: { kind: 'cycle', planCycleId },
        fromDate: overview.cycle.startDate,
        groupId: overview.cycle.groupId,
        limit: 200,
        toDate: overview.cycle.actualEndDate ?? overview.cycle.endDate ?? '2999-12-31',
      });
      setState({ status: 'ready', overview, sessions: history.items });
    } catch (error) {
      setState({
        status: 'error',
        overview: null,
        sessions: [],
        message: error instanceof Error ? error.message : '周期总结加载失败。',
      });
    }
  }, [planCycleId, repositories]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const complete = useCallback(async () => {
    if (!planCycleId) return;
    setWorking(true);
    try {
      await repositories.planRepository.completePlanCycle({ planCycleId });
      await load();
    } finally {
      setWorking(false);
    }
  }, [load, planCycleId, repositories]);

  const archive = useCallback(async () => {
    if (!planCycleId) return;
    setWorking(true);
    try {
      await repositories.planRepository.archivePlanCycle({ planCycleId });
      await load();
    } finally {
      setWorking(false);
    }
  }, [load, planCycleId, repositories]);

  return { archive, complete, isWorking, reload: load, state };
}
