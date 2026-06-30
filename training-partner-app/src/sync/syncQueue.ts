import { initializeLocalDatabase } from '@/data/local/db';
import { createId } from '@/domain/common/ids';

import type { SyncEntity, SyncQueueItem, SyncStatus } from './syncTypes';

type SyncQueueRow = {
  attempts: number;
  created_at: string;
  entity_type: SyncQueueItem['entityType'];
  id: string;
  last_attempted_at: string | null;
  local_id: string;
  operation: SyncQueueItem['operation'];
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
    payload: JSON.parse(row.payload) as Record<string, unknown>,
    remoteId: row.remote_id ?? undefined,
    status: row.status,
    syncError: row.sync_error ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function enqueueSyncCandidate(entity: SyncEntity): Promise<void> {
  const db = await initializeLocalDatabase();
  const now = new Date().toISOString();
  const status = normalizeQueueStatus(entity);
  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM local_sync_queue
     WHERE entity_type = ? AND local_id = ? AND status IN ('pending_create', 'pending_update', 'pending_delete', 'sync_failed')
     ORDER BY created_at DESC
     LIMIT 1`,
    entity.entityType,
    entity.localId,
  );

  if (existing) {
    await db.runAsync(
      `UPDATE local_sync_queue
       SET remote_id = ?, operation = ?, status = ?, payload = ?, sync_error = NULL, updated_at = ?
       WHERE id = ?`,
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
      id, entity_type, local_id, remote_id, operation, status, payload,
      attempts, sync_error, last_attempted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    createId('sync_queue'),
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
  const row = await db.getFirstAsync<{ count: number }>(
    `SELECT COUNT(*) AS count FROM local_sync_queue
     WHERE status IN ('pending_create', 'pending_update', 'pending_delete', 'sync_failed')`,
  );
  return row?.count ?? 0;
}

export async function listPendingSyncItems(limit = 50): Promise<SyncQueueItem[]> {
  const db = await initializeLocalDatabase();
  const rows = await db.getAllAsync<SyncQueueRow>(
    `SELECT * FROM local_sync_queue
     WHERE status IN ('pending_create', 'pending_update', 'pending_delete', 'sync_failed')
     ORDER BY updated_at ASC
     LIMIT ?`,
    limit,
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
