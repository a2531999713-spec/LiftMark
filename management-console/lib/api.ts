// 后端 API 调用客户端 - 自动注入鉴权 token、错误处理

const configuredApiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const API_BASE = configuredApiBase?.replace(/\/$/, '') ?? '';
export const PUBLIC_UPLOAD_BASE = `${API_BASE.replace(/\/api$/, '')}/uploads`;

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
  if (!API_BASE) {
    throw new ApiRequestError(500, 'API_BASE_NOT_CONFIGURED', '管理后台尚未配置 API 地址。');
  }
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
type LoginResponseRaw = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    phone: string | null;
    email: string | null;
    nickname: string;
    avatar_url: string | null;
    liftmarkId?: string;
    liftmark_id?: string;
    role: string;
    status: string;
    createdAt?: string;
    created_at?: string;
    lastLoginAt?: string | null;
    last_login_at?: string | null;
  };
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: AdminUser;
};

export async function login(account: string, password: string): Promise<LoginResponse> {
  const raw = await api.post<LoginResponseRaw>('/admin/auth/login', { account, password });
  const user: AdminUser = {
    id: raw.user.id,
    phone: raw.user.phone,
    email: raw.user.email,
    nickname: raw.user.nickname,
    avatarUrl: raw.user.avatar_url,
    liftmarkId: raw.user.liftmarkId ?? raw.user.liftmark_id ?? '',
    role: 'admin',
    status: raw.user.status,
    createdAt: raw.user.createdAt ?? raw.user.created_at ?? '',
    lastLoginAt: raw.user.lastLoginAt ?? raw.user.last_login_at ?? null,
  };
  setToken(raw.accessToken);
  setStoredUser(user);
  return { accessToken: raw.accessToken, refreshToken: raw.refreshToken, user };
}

// 退出登录
export function logout() {
  clearAuth();
  if (typeof window !== 'undefined') {
    window.location.href = '/admin/login';
  }
}
