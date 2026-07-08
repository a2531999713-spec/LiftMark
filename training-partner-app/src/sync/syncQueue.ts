import { initializeLocalDatabase } from '@/data/local/db';
import { createId } from '@/domain/common/ids';
import { getCurrentAccountUserId } from '@/data/local/accountScope';

import type { SyncEntity, SyncQueueItem, SyncStatus } from './syncTypes';

type SyncQueueRow = {
  attempts: number;
  created_at: string;
  entity_type: SyncQueueItem['entityType'];
  id: string;
  last_attempted_at: string | null;
  local_id: string;
  operation: SyncQueueItem['operation'];
  owner_user_id: string | null;
  payload: string;
  remote_id: string | null;
  status: SyncStatus;
  sync_error: string | null;
  updated_at: string;
};

const pendingStatuses: SyncStatus[] = ['pending_create', 'pending_update', 'pending_delete', 'sync_failed'];

function normalizeQueueStatus(entity: SyncEntity): SyncStatus {
  if (entity.status === 'pending_create' || entity.status === 'pending_update' || entity.status === 'pending_delete') {
    return entity.status;
  }
  if (entity.operation === 'create') return 'pending_create';
  if (entity.operation === 'delete') return 'pending_delete';
  return 'pending_update';
}

function mapQueueRow(row: SyncQueueRow): SyncQueueItem {
  return {
    attempts: row.attempts,
    entityType: row.entity_type,
    id: row.id,
    lastAttemptedAt: row.last_attempted_at ?? undefined,
    localId: row.local_id,
    operation: row.operation,
    ownerUserId: row.owner_user_id ?? undefined,
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    remoteId: row.remote_id ?? undefined,
    status: row.status,
    syncError: row.sync_error ?? undefined,
    updatedAt: row.updated_at,
  };
}

async function resolveEntityOwnerUserId(
  db: Awaited<ReturnType<typeof initializeLocalDatabase>>,
  entity: SyncEntity,
): Promise<string | null> {
  const payloadOwner =
    typeof entity.payload?.ownerUserId === 'string'
      ? entity.payload.ownerUserId
      : typeof entity.payload?.owner_user_id === 'string'
        ? entity.payload.owner_user_id
        : undefined;
  if (entity.ownerUserId !== undefined) return entity.ownerUserId;
  if (payloadOwner) return payloadOwner;

  switch (entity.entityType) {
    case 'workoutSessions': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(ws.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM workout_sessions ws
         LEFT JOIN groups ON groups.id = ws.group_id
         WHERE ws.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'workoutExerciseRecords': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(record.owner_user_id, session.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM workout_exercise_records record
         LEFT JOIN workout_sessions session ON session.id = record.session_id
         LEFT JOIN groups ON groups.id = session.group_id
         WHERE record.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'workoutSets': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(ws.owner_user_id, session.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM workout_sets ws
         LEFT JOIN workout_sessions session ON session.id = ws.session_id
         LEFT JOIN groups ON groups.id = session.group_id
         WHERE ws.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'trainingPlans': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(owner_user_id, creator_id) AS owner_user_id
         FROM plan_templates
         WHERE id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'planCycles': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(pc.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM plan_cycles pc
         LEFT JOIN groups ON groups.id = pc.group_id
         WHERE pc.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'planCycleSummaries': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(pcs.owner_user_id, pc.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM plan_cycle_summaries pcs
         LEFT JOIN plan_cycles pc ON pc.id = pcs.plan_cycle_id
         LEFT JOIN groups ON groups.id = pcs.group_id
         WHERE pcs.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'planPhases': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(pp.owner_user_id, pt.owner_user_id, pt.creator_id) AS owner_user_id
         FROM plan_phases pp
         LEFT JOIN plan_templates pt ON pt.id = pp.plan_id
         WHERE pp.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'planDays': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(pd.owner_user_id, pt.owner_user_id, pt.creator_id) AS owner_user_id
         FROM plan_days pd
         LEFT JOIN plan_templates pt ON pt.id = pd.plan_id
         WHERE pd.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'planExercises': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(pe.owner_user_id, pd.owner_user_id, pt.owner_user_id, pt.creator_id) AS owner_user_id
         FROM plan_exercises pe
         LEFT JOIN plan_days pd ON pd.id = pe.plan_day_id
         LEFT JOIN plan_templates pt ON pt.id = pd.plan_id
         WHERE pe.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'bodyMetrics': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(bm.owner_user_id, gm.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM body_metrics bm
         LEFT JOIN group_members gm ON gm.id = bm.member_id
         LEFT JOIN groups ON groups.id = gm.group_id
         WHERE bm.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'trainingReports': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(tr.owner_user_id, ws.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM training_reports tr
         LEFT JOIN workout_sessions ws ON ws.id = tr.workout_session_id
         LEFT JOIN groups ON groups.id = tr.group_id
         WHERE tr.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'trainingReminders': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(rem.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM training_reminders rem
         LEFT JOIN groups ON groups.id = rem.group_id
         WHERE rem.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'bodyMetricGoals': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(bmg.owner_user_id, gm.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM body_metric_goals bmg
         LEFT JOIN group_members gm ON gm.id = bmg.member_id
         LEFT JOIN groups ON groups.id = gm.group_id
         WHERE bmg.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'recoveryLogs': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(rl.owner_user_id, gm.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM recovery_logs rl
         LEFT JOIN group_members gm ON gm.id = rl.member_id
         LEFT JOIN groups ON groups.id = gm.group_id
         WHERE rl.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'progressionSuggestions': {
      const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
        `SELECT COALESCE(ps.owner_user_id, ws.owner_user_id, groups.owner_user_id) AS owner_user_id
         FROM progression_suggestions ps
         LEFT JOIN workout_sessions ws ON ws.id = ps.session_id
         LEFT JOIN groups ON groups.id = ws.group_id
         WHERE ps.id = ?`,
        entity.localId,
      );
      return row?.owner_user_id ?? null;
    }
    case 'settings':
      return getCurrentAccountUserId();
    default:
      return null;
  }
}

function ownerFilterSql(userId: string | null) {
  return userId
    ? { sql: 'owner_user_id = ?', params: [userId] }
    : { sql: 'owner_user_id IS NULL', params: [] };
}

export async function enqueueSyncCandidate(entity: SyncEntity): Promise<void> {
  const db = await initializeLocalDatabase();
  const now = new Date().toISOString();
  const status = normalizeQueueStatus(entity);
  const resolvedOwner = await resolveEntityOwnerUserId(db, entity);
  const currentUserId = await getCurrentAccountUserId();
  // 跨账号保护：解析出的 owner 若属于他账号，说明本地数据被污染，不入队推送，避免用当前 token 上传他账号数据
  if (resolvedOwner && currentUserId && resolvedOwner !== currentUserId) {
    console.warn(
      '[syncQueue] CROSS-ACCOUNT SKIP enqueue',
      entity.entityType,
      'local_id=', entity.localId,
      'resolved_owner=', resolvedOwner,
      'current_user=', currentUserId,
    );
    return;
  }
  const ownerUserId = resolvedOwner ?? currentUserId;
  const ownerFilter = ownerFilterSql(ownerUserId);
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM local_sync_queue
     WHERE entity_type = ? AND local_id = ? AND ${ownerFilter.sql}
       AND status IN ('pending_create', 'pending_update', 'pending_delete', 'sync_failed')
     ORDER BY created_at DESC
     LIMIT 1`,
    entity.entityType,
    entity.localId,
    ...ownerFilter.params,
  );

  if (existing) {
    await db.runAsync(
      `UPDATE local_sync_queue
       SET owner_user_id = ?, remote_id = ?, operation = ?, status = ?, payload = ?, sync_error = NULL, updated_at = ?
       WHERE id = ?`,
      ownerUserId,
      entity.remoteId ?? null,
      entity.operation,
      status,
      JSON.stringify(entity.payload ?? {}),
      entity.updatedAt ?? now,
      existing.id,
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO local_sync_queue (
      id, owner_user_id, entity_type, local_id, remote_id, operation, status, payload,
      attempts, sync_error, last_attempted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId('sync_queue'),
    ownerUserId,
    entity.entityType,
    entity.localId,
    entity.remoteId ?? null,
    entity.operation,
    status,
    JSON.stringify(entity.payload ?? {}),
    0,
    null,
    null,
    now,
    entity.updatedAt ?? now,
  );
}

export async function countPendingSyncItems(): Promise<number> {
  const db = await initializeLocalDatabase();
  const currentUserId = await getCurrentAccountUserId();
  const ownerFilter = ownerFilterSql(currentUserId);
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM local_sync_queue
     WHERE ${ownerFilter.sql}
       AND status IN ('pending_create', 'pending_update', 'pending_delete', 'sync_failed')`,
    ...ownerFilter.params,
  );
  return row?.count ?? 0;
}

export async function listPendingSyncItems(options: { includeAllAccounts?: boolean } = {}): Promise<SyncQueueItem[]> {
  const db = await initializeLocalDatabase();
  const currentUserId = await getCurrentAccountUserId();
  const ownerFilter = options.includeAllAccounts ? null : ownerFilterSql(currentUserId);
  const rows = await db.getAllAsync<SyncQueueRow>(
    `SELECT * FROM local_sync_queue
     WHERE ${ownerFilter ? `${ownerFilter.sql} AND ` : ''}status IN ('pending_create', 'pending_update', 'pending_delete', 'sync_failed')
     ORDER BY updated_at ASC`,
    ...(ownerFilter?.params ?? []),
  );
  return rows.map(mapQueueRow);
}

export async function markSyncItemsSyncing(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await initializeLocalDatabase();
  const placeholders = ids.map(() => '?').join(', ');
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_sync_queue
     SET status = 'syncing', attempts = attempts + 1, last_attempted_at = ?, updated_at = ?
     WHERE id IN (${placeholders})`,
    now,
    now,
    ...ids,
  );
}

export async function markSyncItemSynced(id: string, remoteId?: string): Promise<void> {
  const db = await initializeLocalDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_sync_queue
     SET remote_id = COALESCE(?, remote_id), status = 'synced', sync_error = NULL, updated_at = ?
     WHERE id = ?`,
    remoteId ?? null,
    now,
    id,
  );
}

export async function markSyncItemFailed(id: string, message: string): Promise<void> {
  const db = await initializeLocalDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE local_sync_queue
     SET status = 'sync_failed', sync_error = ?, updated_at = ?
     WHERE id = ?`,
    message,
    now,
    id,
  );
}

export { pendingStatuses };
