import { useCallback, useMemo, useState } from 'react';

import type { AuthGateSheetsProps } from '@/components/auth';
import {
  decideFeatureAccess,
  type AccessContext,
  type BlockedAccessDecision,
  type FeatureKey,
} from '@/domain/auth';
import { useAuthStore } from '@/store/authStore';

type FeatureContext = Omit<AccessContext, 'authMode'>;

export function useAuthGate() {
  const authMode = useAuthStore((state) => state.authMode);
  const [authPrompt, setAuthPrompt] = useState<BlockedAccessDecision | null>(null);
  const [proPrompt, setProPrompt] = useState<BlockedAccessDecision | null>(null);
  const [noticePrompt, setNoticePrompt] = useState<BlockedAccessDecision | null>(null);

  const guardFeature = useCallback(
    (feature: FeatureKey, context: FeatureContext = {}) => {
      const decision = decideFeatureAccess(feature, { ...context, authMode });
      if (decision.allowed) {
        return true;
      }

      if (decision.reason === 'login_required') {
        setAuthPrompt(decision);
      } else if (decision.reason === 'pro_required' || decision.reason === 'limit_reached') {
        setProPrompt(decision);
      } else {
        setNoticePrompt(decision);
      }

      return false;
    },
    [authMode],
  );

  const sheets = useMemo<AuthGateSheetsProps>(
    () => ({
      authPrompt,
      noticePrompt,
      onCloseAuth: () => setAuthPrompt(null),
      onCloseNotice: () => setNoticePrompt(null),
      onClosePro: () => setProPrompt(null),
      proPrompt,
    }),
    [authPrompt, noticePrompt, proPrompt],
  );

  return {
    authMode,
    guardFeature,
    sheets,
  };
}
