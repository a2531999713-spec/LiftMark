import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';

import type { AppScopeState } from './AppScope';
import { resolveAppScope } from './appScope.service';

type AppScopeContextValue = AppScopeState & { refresh(): Promise<void> };

const AppScopeContext = createContext<AppScopeContextValue | null>(null);

export function AppScopeProvider({ children }: PropsWithChildren) {
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<AppScopeState>({ status: 'loading', scope: null });

  const refresh = useCallback(async () => {
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      return () => {
        cancelled = true;
      };
    }

    void resolveAppScope({ userId, selectedGroupId })
      .then((scope) => {
        if (!cancelled) setState({ status: 'ready', scope });
      })
      .catch((error) => {
        if (!cancelled) {
          setState((current) => ({
            status: 'error',
            scope: current.scope?.userId === userId ? current.scope : null,
            message: error instanceof Error ? error.message : '应用作用域加载失败。',
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [revision, selectedGroupId, userId]);

  const value = useMemo<AppScopeContextValue>(() => {
    const visibleState: AppScopeState = !userId
      ? { status: 'noAccount', scope: null }
      : state.scope?.userId === userId
        ? state
        : { status: 'loading', scope: null };
    return { ...visibleState, refresh };
  }, [refresh, state, userId]);
  return <AppScopeContext.Provider value={value}>{children}</AppScopeContext.Provider>;
}

export function useAppScope(): AppScopeContextValue {
  const value = useContext(AppScopeContext);
  if (!value) throw new Error('useAppScope must be used inside AppScopeProvider.');
  return value;
}
