import { API_BASE_URL, API_REQUEST_TIMEOUT_MS } from '@/config/api';

export { API_BASE_URL };

export type ApiClientOptions = {
  accessToken?: string;
  body?: unknown;
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
};

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

function hasChineseText(message?: string) {
  return Boolean(message && /[\u4e00-\u9fff]/.test(message));
}

function getStatusMessage(status: number, serverMessage?: string) {
  if (serverMessage && hasChineseText(serverMessage)) return serverMessage;
  if (status === 400 || status === 422) return '请求参数有误，请检查后重试。';
  if (status === 401) return '登录状态已过期，请重新登录。';
  if (status === 403) return '当前账号没有权限执行该操作。';
  if (status === 404) return '接口不存在，请检查服务配置。';
  if (status === 429) return '操作过于频繁，请稍后再试。';
  if (status >= 500) return '服务器暂时不可用，请稍后重试。';
  return serverMessage || '服务器请求失败，请稍后重试。';
}

function isNetworkError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!(error instanceof Error)) return false;
  return /fetch failed|network request failed|failed to connect|connectexception|econnrefused|enetunreach/i.test(
    error.message,
  );
}

function getNetworkErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : '';
  if (/network request failed/i.test(message)) return '网络连接失败，请稍后重试。';
  return '无法连接服务器，请检查网络后重试。';
}

function isTimeoutError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return error.name === 'AbortError' || /timeout|aborted/i.test(error.message);
}

export function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof ApiClientError) return error;
  if (isTimeoutError(error)) return new ApiClientError(0, '请求超时，请稍后重试。', 'REQUEST_TIMEOUT');
  if (isNetworkError(error)) return new ApiClientError(0, getNetworkErrorMessage(error), 'NETWORK_ERROR');
  return new ApiClientError(0, '服务器请求失败，请稍后重试。', 'UNKNOWN_ERROR');
}

export async function apiRequest<T>(path: string, options: ApiClientOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_REQUEST_TIMEOUT_MS);
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });

    const text = await response.text();
    let data: { error?: string; message?: string } | null = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        if (response.ok) {
          throw new ApiClientError(response.status, '服务器返回异常，请稍后重试。', 'INVALID_JSON');
        }
      }
    }

    if (!response.ok) {
      throw new ApiClientError(response.status, getStatusMessage(response.status, data?.message), data?.error);
    }

    return data as T;
  } catch (error) {
    throw toApiClientError(error);
  } finally {
    clearTimeout(timeout);
  }
}
