import { API_BASE_URL } from '@/config/api';
import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { getMigrationVersions, getSchemaCheckResults, type SchemaCheckResult } from '@/data/local/schemaRepair';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { apiRequest } from '@/services/httpClient';
import { syncAllLocalGroupsToServer, syncServerDataToLocal } from '@/services/profileSyncService';
import { requestImmediateSync } from '@/sync/syncService';
import { countPendingSyncItems } from '@/sync/syncQueue';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

type LocalCounts = {
  groupMembers: number;
  memberProfiles: number;
  workoutSessions: number;
  workoutSets: number;
};

export type SyncDiagnostics = {
  accessTokenPresent: boolean;
  apiBaseUrl: string;
  avatarAccessStatus?: string;
  avatarUploadTestResult: string;
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

async function countTable(tableName: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(`SELECT COUNT(*) AS count FROM ${tableName}`);
  return row?.count ?? 0;
}

async function getLastSyncError() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ sync_error: string | null }>(
    `SELECT sync_error FROM local_sync_queue
     WHERE sync_error IS NOT NULL AND sync_error <> ''
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
  return row?.sync_error ?? undefined;
}

async function getRecentAvatarUrl() {
  const db = await getDatabase();
  const account = await db.getFirstAsync<{ avatar_url: string | null; avatar_thumb_url: string | null }>(
    `SELECT avatar_url, avatar_thumb_url
     FROM account_profile_cache
     WHERE avatar_url IS NOT NULL OR avatar_thumb_url IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
  const member = await db.getFirstAsync<{ avatar_url: string | null; avatar_thumb_url: string | null }>(
    `SELECT avatar_url, avatar_thumb_url
     FROM member_profiles
     WHERE avatar_url IS NOT NULL OR avatar_thumb_url IS NOT NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
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
  const db = await getDatabase();
  const [pendingCount, lastSyncError, recentAvatarUrl, health, localCounts, schemaChecks, migrationVersions] = await Promise.all([
    countPendingSyncItems(),
    getLastSyncError(),
    getRecentAvatarUrl(),
    checkServerHealth(),
    Promise.all([
      countTable('group_members'),
      countTable('member_profiles'),
      countTable('workout_sessions'),
      countTable('workout_sets'),
    ]).then(([groupMembers, memberProfiles, workoutSessions, workoutSets]) => ({
      groupMembers,
      memberProfiles,
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
  await syncServerDataToLocal();
  return { ok: true, message: '手动拉取已执行。' };
}

export async function repairLocalSchema() {
  const { ensureLocalSchemaCompatibility } = await import('@/data/local/schemaRepair');
  await initializeLocalDatabase();
  const db = await getDatabase();
  await ensureLocalSchemaCompatibility(db);
  return { ok: true, message: '本地数据库结构修复完成。' };
}
