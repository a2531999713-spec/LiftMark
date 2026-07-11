import type { HomeState } from './home.types';

export function selectHomeData<TData>(state: HomeState<TData>): TData | undefined {
  return 'data' in state ? state.data : undefined;
}

export function shouldBlockHomeWithError<TData>(state: HomeState<TData>): boolean {
  return state.status === 'error' && !state.data;
}
