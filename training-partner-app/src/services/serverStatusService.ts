import { API_BASE_URL } from '@/config/api';

import { apiRequest } from './httpClient';

export type ServerConnectionStatus = {
  baseUrl: string;
  checkedAt?: string;
  latencyMs?: number;
  message: string;
  service?: string;
  status: 'checking' | 'online' | 'offline';
};

type HealthResponse = {
  ok: boolean;
  service: string;
  time: string;
};

export function getInitialServerStatus(): ServerConnectionStatus {
  return {
    baseUrl: API_BASE_URL,
    message: '待检测',
    status: 'checking',
  };
}

export async function checkServerHealth(): Promise<ServerConnectionStatus> {
  const startedAt = Date.now();
  try {
    const health = await apiRequest<HealthResponse>('/health');
    return {
      baseUrl: API_BASE_URL,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: health.ok ? '服务器已连接' : '服务器返回异常',
      service: health.service,
      status: health.ok ? 'online' : 'offline',
    };
  } catch (error) {
    return {
      baseUrl: API_BASE_URL,
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : '服务器连接失败',
      status: 'offline',
    };
  }
}
