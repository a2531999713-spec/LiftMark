export type HistoryChartScope = 'personal' | 'group';

export type HistoryDateFilterMode = 'range' | 'single_day';

export type HistoryChartMode =
  | 'range_overall_trend'
  | 'range_exercise_trend'
  | 'single_day_exercise_breakdown'
  | 'single_day_set_breakdown'
  | 'group_range_trend'
  | 'group_single_day_contribution'
  | 'empty';

export type HistoryChartDecisionInput = {
  dateFilter: HistoryDateFilterMode;
  scope: HistoryChartScope;
  selectedExerciseId?: string | null;
  selectedMemberId?: string | null;
};

export function getHistoryChartMode(input: HistoryChartDecisionInput): HistoryChartMode {
  if (input.scope === 'personal' && !input.selectedMemberId) {
    return 'empty';
  }

  const hasExercise = Boolean(input.selectedExerciseId);
  const isSingleDay = input.dateFilter === 'single_day';

  if (input.scope === 'group') {
    if (isSingleDay) {
      return 'group_single_day_contribution';
    }
    return 'group_range_trend';
  }

  if (isSingleDay && hasExercise) {
    return 'single_day_set_breakdown';
  }

  if (isSingleDay) {
    return 'single_day_exercise_breakdown';
  }

  return hasExercise ? 'range_exercise_trend' : 'range_overall_trend';
}
