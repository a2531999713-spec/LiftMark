import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

import {
  countPendingSyncItems,
  listPendingSyncItems,
  markSyncItemFailed,
  markSyncItemSynced,
  markSyncItemsSyncing,
} from './syncQueue';
import type { SyncEntityType, SyncPreferences, SyncQueueItem, SyncSnapshot } from './syncTypes';

const defaultPreferences: SyncPreferences = {
  enabled: true,
  wifiOnly: true,
};

export const SYNC_NOT_CONFIGURED_MESSAGE = '云同步已接入本地队列。云端不可用时，训练数据会保存在本机缓存并等待重试。';

type ServerSyncEntityType = 'exercises' | 'workoutSessions' | 'workoutSets' | 'trainingPlans' | 'planDays' | 'planExercises';

type SyncPushResponse = {
  mappings?: {
    clientId: string;
    entityType: ServerSyncEntityType;
    serverId: string;
    skipped: boolean;
  }[];
  ok: boolean;
  serverTime: string;
};

const serverSyncEntityTypes = new Set<SyncEntityType>([
  'exercises',
  'workoutSessions',
  'workoutSets',
  'trainingPlans',
  'planDays',
  'planExercises',
]);

function buildServerEntity(item: SyncQueueItem) {
  const payload = item.payload ?? {};
  return {
    clientId: item.localId,
    serverId: item.remoteId,
    groupId: typeof payload.groupId === 'string' ? payload.groupId : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    title: typeof payload.title === 'string' ? payload.title : undefined,
    status: typeof payload.status === 'string' ? payload.status : undefined,
    updatedAt: item.updatedAt,
    deletedAt: item.operation === 'delete' ? new Date().toISOString() : undefined,
    payload,
  };
}

export async function getSyncSnapshot(): Promise<SyncSnapshot> {
  const session = await readStoredSession();
  const pendingCount = await countPendingSyncItems();
  if (!session) {
    return {
      lastSyncedAt: undefined,
      pendingCount,
      preferences: defaultPreferences,
      status: 'disabled',
    };
  }

  try {
    const status = await apiRequest<{ serverTime: string; syncedWorkoutSessions: number }>('/sync/status', {
      accessToken: session.accessToken,
    });
    return {
      lastSyncedAt: status.serverTime,
      pendingCount,
      preferences: defaultPreferences,
      status: 'idle',
    };
  } catch {
    return {
      lastSyncedAt: undefined,
      pendingCount,
      preferences: defaultPreferences,
      status: 'failed',
    };
  }
}

export async function updateSyncPreferences(preferences: SyncPreferences): Promise<SyncSnapshot> {
  const pendingCount = await countPendingSyncItems();
  return {
    lastSyncedAt: undefined,
    pendingCount,
    preferences,
    status: preferences.enabled ? 'paused' : 'disabled',
  };
}

export async function requestImmediateSync(): Promise<{ ok: true; message?: string } | { ok: false; message: string }> {
  const session = await readStoredSession();
  if (!session) return { ok: false, message: '请先登录后再使用云同步。' };
  const pendingItems = await listPendingSyncItems();
  if (pendingItems.length === 0) {
    return { ok: true, message: '没有待同步数据。' };
  }

  const syncableItems = pendingItems.filter((item) => serverSyncEntityTypes.has(item.entityType));
  if (syncableItems.length === 0) {
    return { ok: false, message: '当前待同步实体暂未被服务端接口支持。' };
  }

  try {
    await markSyncItemsSyncing(syncableItems.map((item) => item.id));

    const changes: Record<ServerSyncEntityType, ReturnType<typeof buildServerEntity>[]> = {
      exercises: [],
      workoutSessions: [],
      workoutSets: [],
      trainingPlans: [],
      planDays: [],
      planExercises: [],
    };

    for (const item of syncableItems) {
      changes[item.entityType as ServerSyncEntityType].push(buildServerEntity(item));
    }

    const result = await apiRequest<SyncPushResponse>('/sync/push', {
      accessToken: session.accessToken,
      body: {
        changes,
        deviceId: 'liftmark-mobile',
      },
    });

    const mappings = new Map((result.mappings ?? []).map((mapping) => [mapping.clientId, mapping]));
    await Promise.all(
      syncableItems.map((item) => markSyncItemSynced(item.id, mappings.get(item.localId)?.serverId)),
    );

    return { ok: true, message: `已推送 ${syncableItems.length} 条待同步数据。` };
  } catch (error) {
    const message = error instanceof Error ? error.message : '云同步服务连接失败，本地训练不受影响。';
    await Promise.all(syncableItems.map((item) => markSyncItemFailed(item.id, message)));
    return {
      ok: false,
      message,
    };
  }
}
