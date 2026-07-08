import { API_BASE_URL } from '@/config/api';
import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { getMigrationVersions, getSchemaCheckResults, type SchemaCheckResult } from '@/data/local/schemaRepair';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { apiRequest } from '@/services/httpClient';
import { syncAllLocalGroupsToServer } from '@/services/profileSyncService';
import { requestImmediateSync } from '@/sync/syncService';
import { countPendingSyncItems } from '@/sync/syncQueue';
import { sync } from '@/sync/syncOrchestrator';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

type LocalCounts = {
  groups: number;
  groupMembers: number;
  localSyncQueueFailed: number;
  localSyncQueuePending: number;
  memberProfiles: number;
  planDays: number;
  planExercises: number;
  syncState: number;
  trainingPlans: number;
  workoutExerciseRecords: number;
  workoutSessions: number;
  workoutSets: number;
};

export type SyncDiagnostics = {
  accessTokenPresent: boolean;
  apiBaseUrl: string;
  avatarAccessStatus?: string;
  avatarUploadTestResult: string;
  currentUserId?: string;
  isLoggedIn: boolean;
  lastSyncError?: string;
  lastSyncedAt?: string;
  localCounts: LocalCounts;
  migrationVersions: number[];
  pendingCount: number;
  recentAvatarUrl?: string;
  schemaChecks: SchemaCheckResult[];
  serverHealth: 'ok' | 'failed' | 'unknown';
  serverHealthMessage?: string;
  serverStatus?: unknown;
};

async function countTable(tableName: string, userId?: string) {
  const db = await getDatabase();
  const row = userId
    ? await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName} WHERE owner_user_id = ?`, userId)
    : await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName}`);
  return row?.count ?? 0;
}

async function countAllRows(tableName: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName}`);
  return row?.count ?? 0;
}

async function countQueueByStatuses(userId: string | undefined, statuses: string[]) {
  const db = await getDatabase();
  const placeholders = statuses.map(() => '?').join(', ');
  const row = userId
    ? await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM local_sync_queue
         WHERE owner_user_id = ? AND status IN (${placeholders})`,
        userId,
        ...statuses,
      )
    : await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM local_sync_queue WHERE status IN (${placeholders})`,
        ...statuses,
      );
  return row?.count ?? 0;
}

async function getLastSyncError(userId?: string) {
  const db = await getDatabase();
  const row = userId
    ? await db.getFirstAsync<{ sync_error: string | null }>(
        `SELECT sync_error FROM local_sync_queue
         WHERE owner_user_id = ?
           AND sync_error IS NOT NULL
           AND sync_error <> ''
         ORDER BY updated_at DESC
         LIMIT 1`,
        userId,
      )
    : await db.getFirstAsync<{ sync_error: string | null }>(
        `SELECT sync_error FROM local_sync_queue
         WHERE sync_error IS NOT NULL AND sync_error <> ''
         ORDER BY updated_at DESC
         LIMIT 1`,
      );
  return row?.sync_error ?? undefined;
}

async function getRecentAvatarUrl(userId?: string) {
  const db = await getDatabase();
  const account = userId
    ? await db.getFirstAsync<{ avatar_url: string | null; avatar_thumb_url: string | null }>(
        `SELECT avatar_url, avatar_thumb_url
         FROM account_profile_cache
         WHERE user_id = ?
           AND (avatar_url IS NOT NULL OR avatar_thumb_url IS NOT NULL)
         ORDER BY updated_at DESC
         LIMIT 1`,
        userId,
      )
    : null;
  const member = userId
    ? await db.getFirstAsync<{ avatar_url: string | null; avatar_thumb_url: string | null }>(
        `SELECT avatar_url, avatar_thumb_url
         FROM member_profiles
         WHERE owner_user_id = ?
           AND (avatar_url IS NOT NULL OR avatar_thumb_url IS NOT NULL)
         ORDER BY updated_at DESC
         LIMIT 1`,
        userId,
      )
    : null;
  return resolveAvatarUrl(account?.avatar_thumb_url ?? account?.avatar_url ?? member?.avatar_thumb_url ?? member?.avatar_url);
}

async function checkServerHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
      return { serverHealth: 'failed' as const, serverHealthMessage: `HTTP ${response.status}` };
    }
    return { serverHealth: 'ok' as const, serverHealthMessage: '正常' };
  } catch (error) {
    return {
      serverHealth: 'failed' as const,
      serverHealthMessage: error instanceof Error ? error.message : 'health 检查失败',
    };
  }
}

export async function checkAvatarUrlAccess(url?: string) {
  if (!url) return '没有最近头像 URL';
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok ? `可访问 HTTP ${response.status}` : `不可访问 HTTP ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : '头像 URL 检测失败';
  }
}

export async function loadSyncDiagnostics(): Promise<SyncDiagnostics> {
  await initializeLocalDatabase();
  const session = await readStoredSession();
  const currentUserId = session?.user.id;
  const db = await getDatabase();
  const [pendingCount, lastSyncError, recentAvatarUrl, health, localCounts, schemaChecks, migrationVersions] = await Promise.all([
    countPendingSyncItems(),
    getLastSyncError(currentUserId),
    getRecentAvatarUrl(currentUserId),
      checkServerHealth(),
      Promise.all([
        countTable('groups', currentUserId),
        countTable('group_members', currentUserId),
        countTable('member_profiles', currentUserId),
        countTable('plan_templates', currentUserId),
        countTable('plan_days', currentUserId),
        countTable('plan_exercises', currentUserId),
        countTable('workout_sessions', currentUserId),
        countTable('workout_exercise_records', currentUserId),
        countTable('workout_sets', currentUserId),
        countQueueByStatuses(currentUserId, ['pending_create', 'pending_update', 'pending_delete']),
        countQueueByStatuses(currentUserId, ['sync_failed']),
        countAllRows('sync_state'),
      ]).then(([
        groups,
        groupMembers,
        memberProfiles,
        trainingPlans,
        planDays,
        planExercises,
        workoutSessions,
        workoutExerciseRecords,
        workoutSets,
        localSyncQueuePending,
        localSyncQueueFailed,
        syncState,
      ]) => ({
        groups,
        groupMembers,
        localSyncQueueFailed,
        localSyncQueuePending,
        memberProfiles,
        planDays,
        planExercises,
        syncState,
        trainingPlans,
        workoutExerciseRecords,
        workoutSessions,
        workoutSets,
      })),
    getSchemaCheckResults(db),
    getMigrationVersions(db),
  ]);

  let serverStatus: unknown;
  let lastSyncedAt: string | undefined;
  if (session?.accessToken) {
    try {
      serverStatus = await apiRequest('/sync/status', { accessToken: session.accessToken });
      if (
        serverStatus &&
        typeof serverStatus === 'object' &&
        'serverTime' in serverStatus &&
        typeof serverStatus.serverTime === 'string'
      ) {
        lastSyncedAt = serverStatus.serverTime;
      }
    } catch (error) {
      serverStatus = { error: error instanceof Error ? error.message : 'sync/status 请求失败' };
    }
  }

  const avatarAccessStatus = await checkAvatarUrlAccess(recentAvatarUrl);

  return {
    accessTokenPresent: Boolean(session?.accessToken),
    apiBaseUrl: API_BASE_URL,
    avatarAccessStatus,
    avatarUploadTestResult: recentAvatarUrl ? avatarAccessStatus : '尚无最近头像 URL',
    currentUserId,
    isLoggedIn: Boolean(session),
    lastSyncError,
    lastSyncedAt,
    localCounts,
    migrationVersions,
    pendingCount,
    recentAvatarUrl,
    schemaChecks,
    serverHealth: health.serverHealth,
    serverHealthMessage: health.serverHealthMessage,
    serverStatus,
  };
}

export async function runManualUploadSync() {
  const groupResult = await syncAllLocalGroupsToServer();
  const queueResult = await requestImmediateSync();
  return {
    ok: groupResult.ok && queueResult.ok,
    message: [groupResult.message, queueResult.message].filter(Boolean).join('；') || '手动上传已执行。',
  };
}

export async function runManualPullSync() {
  return sync({ fullPull: true });
}

export async function repairLocalSchema() {
  const { ensureLocalSchemaCompatibility } = await import('@/data/local/schemaRepair');
  await initializeLocalDatabase();
  const db = await getDatabase();
  await ensureLocalSchemaCompatibility(db);
  return { ok: true, message: '本地数据库结构修复完成。' };
}
