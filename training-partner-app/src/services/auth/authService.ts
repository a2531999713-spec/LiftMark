import { ApiClientError, apiRequest } from '@/services/httpClient';

import type {
  AuthService,
  AuthServiceResult,
  AuthSession,
  AuthUser,
  CodeLoginInput,
  LoginInput,
  RegisterInput,
  SendCodeInput,
  SendCodeResult,
} from './authTypes';
import { clearStoredSession, readStoredSession, saveStoredSession } from './tokenStorage';

export const AUTH_NOT_CONFIGURED_MESSAGE = '登录接口待接入，请配置服务器地址和认证接口。';
export const AUTH_SERVER_UNAVAILABLE_MESSAGE = '服务器连接失败，请检查网络或稍后再试。';

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

function messageFromError(error: unknown, scope: 'auth' | 'sms' | 'code_login' | 'password_login' = 'auth') {
  if (error instanceof ApiClientError) {
    if (error.code === 'NETWORK_ERROR') return AUTH_SERVER_UNAVAILABLE_MESSAGE;
    if (error.code === 'REQUEST_TIMEOUT') return '请求超时，请稍后重试。';
    if (error.status === 429) return '验证码发送过于频繁，请稍后再试。';
    if (scope === 'sms' && error.status === 404) return '验证码服务正在配置中，请稍后再试。';
    if (scope === 'sms' && error.status >= 500) return '验证码发送失败，请稍后再试。';
    if (scope === 'code_login' && (error.status === 400 || error.status === 401 || error.status === 422)) {
      return '验证码错误或已过期。';
    }
    if (scope === 'password_login' && (error.status === 400 || error.status === 401 || error.status === 422)) {
      return '手机号 / 练刻 ID 或密码错误。';
    }
    return error.message;
  }
  if (error instanceof TypeError) return AUTH_SERVER_UNAVAILABLE_MESSAGE;
  return error instanceof Error ? error.message : '账号请求失败。';
}

function isTransientNetworkError(error: unknown) {
  return (
    error instanceof ApiClientError &&
    (error.code === 'NETWORK_ERROR' || error.code === 'REQUEST_TIMEOUT' || error.status >= 500)
  );
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
        if (refreshed.ok) return refreshed.session;

        const preserved = await readStoredSession();
        return preserved ? { ...preserved, isOffline: true } : null;
      }

      return {
        ...stored,
        isOffline: true,
      };
    }
  }

  async login(input: LoginInput): Promise<AuthServiceResult> {
    try {
      const response = await apiRequest<AuthResponse>('/auth/password/login', {
        body: {
          identifier: input.identifier.trim(),
          password: input.password,
        },
      });
      const session = toSession(response);
      await saveStoredSession(session);
      return { ok: true, session };
    } catch (error) {
      return { ok: false, message: messageFromError(error, 'password_login') };
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
      return { ok: false, message: messageFromError(error, 'code_login') };
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
      if (!isTransientNetworkError(error)) {
        await clearStoredSession();
      }
      return { ok: false, message: messageFromError(error) };
    }
  }

  async register(input: RegisterInput): Promise<AuthServiceResult> {
    try {
      const response = await apiRequest<AuthResponse>('/auth/register', {
        body: {
          code: input.code.trim(),
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

  async sendCode(input: SendCodeInput): Promise<SendCodeResult> {
    try {
      return await apiRequest<{ debugCode?: string; message?: string; ok: true }>('/auth/send-code', {
        body: input,
      });
    } catch (error) {
      console.warn('[auth] sendCode failed', error instanceof Error ? error.message : 'unknown error');
      return { ok: false as const, message: messageFromError(error, 'sms') };
    }
  }
}

export function createAuthService(): AuthService {
  return new ApiAuthService();
}
