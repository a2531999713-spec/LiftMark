import type { HistoryFilter } from '@/domain/history/history.types';

export type ScopedHistoryFilterState = {
  contextKey: string;
  filter: HistoryFilter;
};

export const defaultHistoryFilter: HistoryFilter = { kind: 'all' };

export function resolveScopedHistoryFilter(
  current: ScopedHistoryFilterState,
  nextContextKey: string,
): ScopedHistoryFilterState {
  if (current.contextKey === nextContextKey) return current;
  return { contextKey: nextContextKey, filter: defaultHistoryFilter };
}
