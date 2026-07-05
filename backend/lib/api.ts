// 后端 API 调用客户端 - 自动注入鉴权 token、错误处理

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://47.100.239.29/api';

const TOKEN_KEY = 'liftmark_admin_token';
const USER_KEY = 'liftmark_admin_user';

export type AdminUser = {
  id: string;
  phone: string | null;
  email: string | null;
  nickname: string;
  avatarUrl: string | null;
  liftmarkId: string;
  role: 'admin';
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type ApiError = {
  error: string;
  message: string;
  statusCode?: number;
  issues?: unknown[];
};

export class ApiRequestError extends Error {
  statusCode: number;
  code: string;
  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    window.localStorage.setItem(TOKEN_KEY, token);
  } else {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredUser(): AdminUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setStoredUser(user: AdminUser | null) {
  if (typeof window === 'undefined') return;
  if (user) {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    window.localStorage.removeItem(USER_KEY);
  }
}

export function clearAuth() {
  setToken(null);
  setStoredUser(null);
}

type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

async function request<T>(
  method: string,
  path: string,
  options?: { query?: QueryParams; body?: unknown; auth?: boolean },
): Promise<T> {
  const url = buildUrl(path, options?.query);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (options?.auth !== false) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    const err = (data && typeof data === 'object' ? data : {}) as ApiError;
    if (response.status === 401) {
      // Token 失效，清空
      clearAuth();
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }
    throw new ApiRequestError(
      response.status,
      err.error || 'API_ERROR',
      err.message || `请求失败 (${response.status})`,
    );
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: QueryParams) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  delete: <T>(path: string) => request<T>('DELETE', path),
};

// ===== 登录 =====
export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

export async function login(account: string, password: string): Promise<LoginResponse> {
  const result = await api.post<LoginResponse>('/admin/auth/login', { account, password });
  setToken(result.accessToken);
  setStoredUser(result.user);
  return result;
}

// 退出登录
export function logout() {
  clearAuth();
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login';
  }
}
