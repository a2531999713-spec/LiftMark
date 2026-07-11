import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import { loadTrainingReport } from '../application/loadTrainingReport.usecase';
import {
  initialTrainingReportState,
  resolveTrainingReportErrorState,
  resolveTrainingReportLoadedState,
  type TrainingReportControllerState,
} from '../model/trainingReport.controller';

export function useTrainingReportController(sessionId?: string) {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [state, setState] = useState<TrainingReportControllerState>(initialTrainingReportState);
  const load = useCallback(async () => {
    if (!sessionId) {
      setState({ status: 'empty', report: null });
      return;
    }
    setState({ status: 'loading', report: null });
    try {
      await initializeLocalDatabase();
      const report = await loadTrainingReport(repositories.trainingReportRepository, sessionId);
      setState(resolveTrainingReportLoadedState(report));
    } catch (error) {
      setState(resolveTrainingReportErrorState(error));
    }
  }, [repositories, sessionId]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  return { reload: load, state };
}
