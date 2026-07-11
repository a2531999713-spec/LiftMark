import type { HomeState } from './home.types';

export type HomeAction<TData> =
  | { type: 'loadStarted' }
  | { type: 'loadSucceeded'; status: Exclude<HomeState<TData>['status'], 'loading' | 'error'>; data: TData }
  | { type: 'loadFailed'; message: string; recoverable?: boolean };

export function homeReducer<TData>(state: HomeState<TData>, action: HomeAction<TData>): HomeState<TData> {
  switch (action.type) {
    case 'loadStarted':
      return { status: 'loading', data: 'data' in state ? state.data : undefined };
    case 'loadSucceeded':
      return { status: action.status, data: action.data } as HomeState<TData>;
    case 'loadFailed':
      return {
        status: 'error',
        message: action.message,
        recoverable: action.recoverable ?? Boolean('data' in state && state.data),
        data: 'data' in state ? state.data : undefined,
      };
  }
}
