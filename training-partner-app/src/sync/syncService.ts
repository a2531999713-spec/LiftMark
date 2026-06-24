import type { SyncPreferences, SyncSnapshot } from './syncTypes';
import { apiRequest } from '@/services/apiClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

const defaultPreferences: SyncPreferences = {
  enabled: false,
  wifiOnly: true,
};

export const SYNC_NOT_CONFIGURED_MESSAGE = '云同步接口待接入。当前训练数据仍会先保存到本机 SQLite。';

export async function getSyncSnapshot(): Promise<SyncSnapshot> {
  const session = await readStoredSession();
  if (!session) {
    return {
      lastSyncedAt: undefined,
      pendingCount: 0,
      preferences: defaultPreferences,
      status: 'disabled',
    };
  }

  const status = await apiRequest<{ serverTime: string; syncedWorkoutSessions: number }>('/sync/status', {
    accessToken: session.accessToken,
  });
  return {
    lastSyncedAt: status.serverTime,
    pendingCount: 0,
    preferences: defaultPreferences,
    status: 'idle',
  };
}

export async function updateSyncPreferences(preferences: SyncPreferences): Promise<SyncSnapshot> {
  return {
    lastSyncedAt: undefined,
    pendingCount: 0,
    preferences,
    status: preferences.enabled ? 'paused' : 'disabled',
  };
}

export async function requestImmediateSync(): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const session = await readStoredSession();
  if (!session) return { ok: false, message: '请先登录后再使用云同步。' };
  await apiRequest('/sync/push', {
    accessToken: session.accessToken,
    body: {
      changes: {},
    },
  });
  return { ok: true, message: '同步服务已连接。本地训练队列会在后续版本接入。' };
}
