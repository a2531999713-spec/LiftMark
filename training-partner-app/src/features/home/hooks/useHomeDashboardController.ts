import { useCallback, useReducer, useRef } from 'react';

import { homeReducer } from '../model/home.reducer';
import type { HomeState } from '../model/home.types';

export function useHomeDashboardController<TData>() {
  const [state, dispatch] = useReducer(homeReducer<TData>, { status: 'loading' } as HomeState<TData>);
  const requestId = useRef(0);

  const runLoad = useCallback(async (loader: () => Promise<{ data: TData; status: Exclude<HomeState<TData>['status'], 'loading' | 'error'> }>) => {
    const currentRequest = ++requestId.current;
    dispatch({ type: 'loadStarted' });
    try {
      const result = await loader();
      if (currentRequest === requestId.current) {
        dispatch({ type: 'loadSucceeded', ...result });
      }
    } catch (error) {
      if (currentRequest === requestId.current) {
        dispatch({ type: 'loadFailed', message: error instanceof Error ? error.message : '首页加载失败。' });
      }
    }
  }, []);

  const cancelLoad = useCallback(() => {
    requestId.current += 1;
  }, []);

  return { cancelLoad, runLoad, state };
}
