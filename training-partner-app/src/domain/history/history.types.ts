import type { ID } from '../common/ids';
import type { PlanCycleStatus } from '../plan/plan.types';
import type { TrainingReportSessionType } from '../report/trainingReport.types';

export type HistoryFilterKind = 'all' | 'current_cycle' | 'cycle' | 'free' | 'manual';

export type HistoryFilter = {
  kind: HistoryFilterKind;
  planCycleId?: ID;
};

export type HistoryListItem = {
  completedSets: number;
  cycleName?: string;
  cycleStatus?: PlanCycleStatus;
  date: string;
  durationSeconds: number;
  exerciseCount: number;
  hasCompleteReport: boolean;
  id: ID;
  mainExerciseNames: string[];
  ownerUserId: ID;
  participantNames: string[];
  planCycleId?: ID;
  planName?: string;
  sessionType: TrainingReportSessionType;
  title: string;
  totalReps: number;
  totalVolume: number;
  week: number;
  weekday: number;
};

export type HistoryCycleOption = {
  cycleId: ID;
  cycleName: string;
  endDate?: string;
  planName: string;
  sessionCount: number;
  startDate: string;
  status: PlanCycleStatus;
};

export type HistoryQueryResult = {
  filter: HistoryFilter;
  items: HistoryListItem[];
};
