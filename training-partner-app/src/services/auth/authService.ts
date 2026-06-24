import { ApiClientError, apiRequest } from '@/services/apiClient';

import type {
  AuthService,
  AuthServiceResult,
  AuthSession,
  AuthUser,
  CodeLoginInput,
  LoginInput,
  RegisterInput,
  SendCodeInput,
} from './authTypes';
import { clearStoredSession, readStoredSession, saveStoredSession } from './tokenStorage';

export const AUTH_NOT_CONFIGURED_MESSAGE = '登录接口待接入，请配置服务器地址和认证接口。';
export const AUTH_SERVER_UNAVAILABLE_MESSAGE = '服务器暂时不可用，本机训练功能仍可继续使用。';

type ApiUser = {
  avatar_url?: string | null;
  email?: string | null;
  id: string;
  liftmarkId?: string;
  nickname: string;
  phone?: string | null;
  role?: 'user' | 'admin';
  status?: 'normal' | 'disabled';
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: ApiUser;
};

type MeResponse = {
  user: ApiUser;
};

function toAuthUser(user: ApiUser): AuthUser {
  return {
    id: user.id,
    liftmarkId: user.liftmarkId ?? `LM${user.id.slice(-8).toUpperCase()}`,
    displayName: user.nickname,
    avatarUrl: user.avatar_url ?? undefined,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
    role: user.role,
    status: user.status,
  };
}

function toSession(response: AuthResponse): AuthSession {
  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: toAuthUser(response.user),
  };
}

function messageFromError(error: unknown) {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof TypeError) return AUTH_SERVER_UNAVAILABLE_MESSAGE;
  return error instanceof Error ? error.message : '账号请求失败。';
}

class ApiAuthService implements AuthService {
  async getCurrentSession() {
    const stored = await readStoredSession();
    if (!stored) return null;

    try {
      const response = await apiRequest<MeResponse>('/auth/me', {
        accessToken: stored.accessToken,
      });
      const session = { ...stored, user: toAuthUser(response.user), isOffline: false };
      await saveStoredSession(session);
      return session;
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        const refreshed = await this.refreshToken(stored.refreshToken);
        return refreshed.ok ? refreshed.session : null;
      }

      return {
        ...stored,
        isOffline: true,
      };
    }
  }

  async login(input: LoginInput): Promise<AuthServiceResult> {
    try {
      const response = await apiRequest<AuthResponse>('/auth/login', {
        body: {
          account: input.identifier.trim(),
          password: input.password,
        },
      });
      const session = toSession(response);
      await saveStoredSession(session);
      return { ok: true, session };
    } catch (error) {
      return { ok: false, message: messageFromError(error) };
    }
  }

  async loginWithCode(input: CodeLoginInput): Promise<AuthServiceResult> {
    try {
      const response = await apiRequest<AuthResponse>('/auth/login-with-code', {
        body: input,
      });
      const session = toSession(response);
      await saveStoredSession(session);
      return { ok: true, session };
    } catch (error) {
      return { ok: false, message: messageFromError(error) };
    }
  }

  async logout() {
    const stored = await readStoredSession();
    if (stored) {
      try {
        await apiRequest('/auth/logout', {
          accessToken: stored.accessToken,
          body: { refreshToken: stored.refreshToken },
        });
      } catch {
        // 本地退出不能被网络失败阻塞。
      }
    }
    await clearStoredSession();
  }

  async refreshToken(refreshToken?: string): Promise<AuthServiceResult> {
    if (!refreshToken) return { ok: false, message: '登录状态已过期，请重新登录。' };
    try {
      const response = await apiRequest<AuthResponse>('/auth/refresh', {
        body: { refreshToken },
      });
      const session = toSession(response);
      await saveStoredSession(session);
      return { ok: true, session };
    } catch (error) {
      await clearStoredSession();
      return { ok: false, message: messageFromError(error) };
    }
  }

  async register(input: RegisterInput): Promise<AuthServiceResult> {
    try {
      const response = await apiRequest<AuthResponse>('/auth/register', {
        body: {
          phone: input.identifier.trim(),
          password: input.password,
          nickname: input.displayName.trim(),
        },
      });
      const session = toSession(response);
      await saveStoredSession(session);
      return { ok: true, session };
    } catch (error) {
      return { ok: false, message: messageFromError(error) };
    }
  }

  async sendCode(input: SendCodeInput) {
    try {
      return await apiRequest<{ debugCode?: string; ok: true }>('/auth/send-code', {
        body: input,
      });
    } catch (error) {
      return { ok: false as const, message: messageFromError(error) };
    }
  }
}

export function createAuthService(): AuthService {
  return new ApiAuthService();
}
