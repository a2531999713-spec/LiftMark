export type WeeklyTrainingSummary = {
  completedSets: number;
  durationSeconds: number;
  sessionCount: number;
  volume: number;
};

export type HomeDashboardSnapshot = {
  completedPlanDayKeys: string[];
  lastPerformanceByExerciseId: Record<string, string>;
  recentVisibleSessionCount: number;
  weeklyOverview: WeeklyTrainingSummary;
};

export type HomeState<TData> =
  | { status: 'loading'; data?: TData }
  | { status: 'noGroup'; data: TData }
  | { status: 'noMember'; data: TData }
  | { status: 'noActivePlan'; data: TData }
  | { status: 'planCompleted'; data: TData }
  | { status: 'restDay'; data: TData }
  | { status: 'ready'; data: TData }
  | { status: 'error'; recoverable: boolean; message: string; data?: TData };
