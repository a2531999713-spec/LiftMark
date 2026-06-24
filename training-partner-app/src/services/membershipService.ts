import { apiRequest, ApiClientError } from './apiClient';
import { readStoredSession } from './auth/tokenStorage';

export type Membership = {
  activatedProGroupCount: number;
  expiresAt?: string | null;
  id: string;
  isLifetime: boolean;
  proGroupLimit: number;
  source: 'activation_code' | 'admin_grant' | 'payment_reserved';
  startsAt: string;
  type: 'free' | 'pro' | 'lifetime';
  userId: string;
};

type MembershipResponse = {
  membership: Membership;
};

export async function getMembership() {
  const session = await readStoredSession();
  if (!session) return null;
  try {
    const response = await apiRequest<MembershipResponse>('/membership/me', {
      accessToken: session.accessToken,
    });
    return response.membership;
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) return null;
    throw error;
  }
}

export async function redeemActivationCode(code: string) {
  const session = await readStoredSession();
  if (!session) {
    return { ok: false as const, message: '请先登录后再兑换激活码。' };
  }

  try {
    const response = await apiRequest<MembershipResponse & { ok: true }>('/activation-codes/redeem', {
      accessToken: session.accessToken,
      body: { code },
    });
    return { ok: true as const, membership: response.membership };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : '激活码兑换失败。',
    };
  }
}

