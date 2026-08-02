import { initializeLocalDatabase } from '@/data/local/db';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

import {
  countPendingSyncItems,
  listPendingSyncItems,
  markSyncItemFailed,
  markSyncItemSynced,
  markSyncItemsSyncing,
  reconcileDirtyWorkoutSyncQueue,
} from './syncQueue';
import type { SyncEntityType, SyncPreferences, SyncQueueItem, SyncSnapshot } from './syncTypes';
import { getInstallationDeviceId } from './device/deviceIdentity';
import { getSyncEntityDefinition } from './registry/syncEntityRegistry';
import { serializeLocalRow } from './serialization/serializers/localRow.serializer';

const defaultPreferences: SyncPreferences = {
  enabled: true,
  wifiOnly: true,
};

export const SYNC_NOT_CONFIGURED_MESSAGE = 'Cloud sync is queued locally and will retry when the server is available.';

type ServerSyncEntityType =
  | 'exercises'
  | 'workoutSessions'
  | 'workoutExerciseRecords'
  | 'workoutSets'
  | 'trainingPlans'
  | 'planCycles'
  | 'planCycleSummaries'
  | 'planPhases'
  | 'planDays'
  | 'planExercises'
  | 'trainingReports'
  | 'trainingReminders'
  | 'bodyMetrics'
  | 'bodyMetricGoals'
  | 'recoveryLogs'
  | 'progressionSuggestions'
  | 'settings';

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
  'workoutExerciseRecords',
  'workoutSets',
  'trainingPlans',
  'planCycles',
  'planCycleSummaries',
  'planPhases',
  'planDays',
  'planExercises',
  'trainingReports',
  'trainingReminders',
  'bodyMetrics',
  'bodyMetricGoals',
  'recoveryLogs',
  'progressionSuggestions',
  'settings',
]);

// push 前按 registry 显式字段读取本地业务数据并填充 payload。
// 背景：enqueueSyncCandidate 入队时大多未携带业务字段 payload（仅 localId/owner），
// 导致 buildServerEntity 推送到服务器的 payload 缺少 plan_id/type/start_week 等关键列，
// fullPull 时 applyPlanPhases 等无法恢复，本地 plan_phases.plan_id 为空 → plan_has_no_phases。
// 这里不会 SELECT *；新增字段必须先进入 registry 和 serializer 测试。
async function hydrateItemPayload(
  db: Awaited<ReturnType<typeof initializeLocalDatabase>>,
  item: SyncQueueItem,
): Promise<Record<string, unknown>> {
  const existing = item.payload ?? {};
  if (item.operation === 'delete') return existing;
  const definition = getSyncEntityDefinition(item.entityType);
  const table = definition.localTable;
  if (!table) return existing;
  try {
    const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    const available = new Set(columns.map((column) => column.name));
    const selectedFields = definition.fields.filter((field) => available.has(field));
    if (selectedFields.length === 0) return existing;
    const row = await db.getFirstAsync<Record<string, unknown>>(
      `SELECT ${selectedFields.join(', ')} FROM ${table} WHERE id = ? LIMIT 1`,
      item.localId,
    );
    if (!row) return existing;
    return { ...existing, ...serializeLocalRow(item.entityType, row) };
  } catch {
    return existing;
  }
}

function buildServerEntity(item: SyncQueueItem) {
  const payload = item.payload ?? {};
  const ownerPayload = item.ownerUserId
    ? {
        ...payload,
        ownerUserId: item.ownerUserId,
        owner_user_id: item.ownerUserId,
        userId: item.ownerUserId,
        user_id: item.ownerUserId,
      }
    : payload;
  return {
    clientId: item.localId,
    serverId: item.remoteId,
    groupId: typeof payload.groupId === 'string' ? payload.groupId : undefined,
    parentServerId:
      typeof payload.parentServerId === 'string'
        ? payload.parentServerId
        : typeof payload.sessionId === 'string'
          ? payload.sessionId
          : undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    title: typeof payload.title === 'string' ? payload.title : undefined,
    status: typeof payload.status === 'string' ? payload.status : undefined,
    updatedAt: item.updatedAt,
    deletedAt: item.operation === 'delete' ? new Date().toISOString() : undefined,
    payload: ownerPayload,
  };
}

function filterQueueItemsForUser(items: SyncQueueItem[], userId: string) {
  const owned: SyncQueueItem[] = [];
  let unboundCount = 0;
  let otherAccountCount = 0;

  for (const item of items) {
    if (item.ownerUserId === userId) {
      owned.push(item);
      continue;
    }
    if (!item.ownerUserId) {
      unboundCount += 1;
    } else {
      otherAccountCount += 1;
    }
  }

  return { owned, otherAccountCount, unboundCount };
}

async function markLocalEntitySynced(item: SyncQueueItem, remoteId: string | undefined, syncedAt: string) {
  const tableName = getSyncEntityDefinition(item.entityType).localTable;
  if (!tableName) return;

  const db = await initializeLocalDatabase();
  await db.runAsync(
    `UPDATE ${tableName}
     SET remote_id = COALESCE(?, remote_id),
         sync_status = 'synced',
         sync_error = NULL,
         last_synced_at = ?
     WHERE id = ?`,
    remoteId ?? null,
    syncedAt,
    item.localId,
  );
}

export async function getSyncSnapshot(): Promise<SyncSnapshot & { lastError?: string; serverStatus?: unknown }> {
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
      serverStatus: status,
      status: 'idle',
    };
  } catch (error) {
    return {
      lastSyncedAt: undefined,
      lastError: error instanceof Error ? error.message : 'Sync status failed to load.',
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
  if (!session) return { ok: false, message: 'Please sign in before using cloud sync.' };
  // Business rows are the source of truth. Repair missing workout queue entries
  // before every push so background/save-and-exit writes cannot remain local-only forever.
  await reconcileDirtyWorkoutSyncQueue();
  const pendingItems = await listPendingSyncItems({ includeAllAccounts: true });
  if (pendingItems.length === 0) {
    return { ok: true, message: 'No pending sync data.' };
  }

  const accountFiltered = filterQueueItemsForUser(pendingItems, session.user.id);
  const syncableItems = accountFiltered.owned.filter((item) => serverSyncEntityTypes.has(item.entityType));
  if (syncableItems.length === 0) {
    if (accountFiltered.unboundCount > 0 || accountFiltered.otherAccountCount > 0) {
      return {
        ok: true,
        message: `No syncable items for current account. ${accountFiltered.unboundCount} unbound and ${accountFiltered.otherAccountCount} other-account items were isolated.`,
      };
    }
    return { ok: true, message: 'No syncable items for the current account.' };
  }
  try {
    await markSyncItemsSyncing(syncableItems.map((item) => item.id));

    const changes: Record<ServerSyncEntityType, ReturnType<typeof buildServerEntity>[]> = {
      exercises: [],
      workoutSessions: [],
      workoutExerciseRecords: [],
      workoutSets: [],
      trainingPlans: [],
      planCycles: [],
      planCycleSummaries: [],
      planPhases: [],
      planDays: [],
      planExercises: [],
      trainingReports: [],
      trainingReminders: [],
      bodyMetrics: [],
      bodyMetricGoals: [],
      recoveryLogs: [],
      progressionSuggestions: [],
      settings: [],
    };

    const db = await initializeLocalDatabase();
    for (const item of syncableItems) {
      const hydratedPayload = await hydrateItemPayload(db, item);
      changes[item.entityType as ServerSyncEntityType].push(
        buildServerEntity({ ...item, payload: hydratedPayload }),
      );
    }

    const deviceId = await getInstallationDeviceId();
    const result = await apiRequest<SyncPushResponse>('/sync/push', {
      accessToken: session.accessToken,
      body: {
        changes,
        deviceId,
      },
    });

    const mappings = new Map((result.mappings ?? []).map((mapping) => [mapping.clientId, mapping]));
    await Promise.all(
      syncableItems.map(async (item) => {
        const remoteId = mappings.get(item.localId)?.serverId;
        await markSyncItemSynced(item.id, remoteId);
        await markLocalEntitySynced(item, remoteId, result.serverTime);
      }),
    );

    const unsupportedCount = accountFiltered.owned.length - syncableItems.length;
    const isolatedCount = accountFiltered.unboundCount + accountFiltered.otherAccountCount;
    const unsupportedSuffix = unsupportedCount > 0 ? `，另有 ${unsupportedCount} 条数据暂不支持当前同步通道。` : '';
    const isolationSuffix = isolatedCount > 0 ? ` 本机存在其他账号或未绑定数据 ${isolatedCount} 条，已隔离未上传。` : '';
    return { ok: true, message: `已推送 ${syncableItems.length} 条待同步数据${unsupportedSuffix}${isolationSuffix}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cloud sync failed. Training data remains on this device.';
    await Promise.all(syncableItems.map((item) => markSyncItemFailed(item.id, message)));
    return {
      ok: false,
      message,
    };
  }
}
