import { initializeLocalDatabase } from '@/data/local/db';
import { getCurrentAccountUserId } from '@/data/local/accountScope';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { defaultStrengthPlanDaySeeds } from '@/data/seed/defaultStrengthPlan';
import { defaultDeloadPlanDaySeeds } from '@/data/seed/defaultDeloadPlan';
import { defaultHypertrophyPlanDaySeeds } from '@/data/seed/defaultHypertrophyPlan';

type LocalDatabase = Awaited<ReturnType<typeof initializeLocalDatabase>>;

type ServerRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  client_id: string | null;
  parent_server_id: string | null;
  name: string | null;
  title: string | null;
  status: string | null;
  member_client_id: string | null;
  exercise_client_id: string | null;
  actual_weight: number | null;
  actual_reps: number | null;
  sync_version: number | null;
  client_updated_at: string | null;
  deleted_at: string | null;
  payload: Record<string, unknown> | string | null;
  updated_at: string;
  created_at: string;
};

type PullResponse = {
  serverTime: string;
  changes: Record<string, ServerRow[]>;
};

type DbValue = string | number | null;

const LAST_PULL_AT_KEY_PREFIX = 'last_pull_at';
const DEVICE_ID = 'liftmark-mobile';

function pick(payload: Record<string, unknown> | null, keys: string[]): unknown {
  if (!payload) return undefined;
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : null;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asInt(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.trunc(n);
}

function asBoolInt(value: unknown): number {
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'number') return value !== 0 ? 1 : 0;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    return trimmed === 'true' || trimmed === '1' ? 1 : 0;
  }
  return 0;
}

function normalizePayload(row: ServerRow): Record<string, unknown> {
  const raw = row.payload;
  if (raw && typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  return {};
}

function resolveTimestamp(row: ServerRow): string {
  return row.client_updated_at ?? row.updated_at ?? new Date().toISOString();
}

function getLastPullAtKey(userId: string): string {
  return `${LAST_PULL_AT_KEY_PREFIX}:${userId}`;
}

async function getLastPullAt(db: LocalDatabase, userId: string): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_state WHERE key = ? LIMIT 1',
      getLastPullAtKey(userId),
    );
    return row?.value ?? new Date(0).toISOString();
  } catch {
    return new Date(0).toISOString();
  }
}

async function setLastPullAt(db: LocalDatabase, userId: string, value: string): Promise<void> {
  try {
    const key = getLastPullAtKey(userId);
    await db.runAsync(
      `INSERT INTO sync_state (id, key, value, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      `sync_state_${key}`,
      key,
      value,
      new Date().toISOString(),
    );
  } catch (error) {
    console.warn('[sync] failed to update last_pull_at', error instanceof Error ? error.message : error);
  }
}

type RemoteIdUpsertInput = {
  table: string;
  localId: string;
  remoteId: string;
  reclaimExisting?: boolean;
  serverUpdatedAt: string;
  serverDeletedAt: string | null;
  currentUserId: string;
  insertColumns: string[];
  insertValues: DbValue[];
  updateColumns: string[];
  updateValues: DbValue[];
};

type ExistingRemoteRow = {
  id: string;
  owner_user_id: string | null;
  remote_id: string | null;
  sync_status: string;
  updated_at: string | null;
};

async function upsertWithRemoteId(db: LocalDatabase, input: RemoteIdUpsertInput): Promise<boolean> {
  const { table, localId, remoteId, serverUpdatedAt, serverDeletedAt, currentUserId } = input;

  const existingByRemoteId = await db.getFirstAsync<ExistingRemoteRow>(
    `SELECT id, owner_user_id, remote_id, sync_status, updated_at FROM ${table} WHERE remote_id = ? LIMIT 1`,
    remoteId,
  );
  let existing =
    existingByRemoteId ??
    (await db.getFirstAsync<ExistingRemoteRow>(
      `SELECT id, owner_user_id, remote_id, sync_status, updated_at FROM ${table} WHERE id = ? LIMIT 1`,
      localId,
    ));

  // 跨账号归属保护：本地已存在该行但属于其他账号时，绝不覆盖 owner_user_id。
  // 增量 pull：跳过（SKIP），避免把 188 的数据改给 176 或反之。
  // fullPull（从云端恢复）：把当前账号云端返回的同一行认领回当前账号（reclaim）。
  //   这样"从云端恢复"能真正恢复 176 数据，即使本地曾被 188 污染。
  const ownershipMismatch = existing && existing.owner_user_id !== currentUserId;
  let reclaimedOwnership = false;
  if (ownershipMismatch) {
    if (input.reclaimExisting && existing) {
      console.warn(
        '[sync/pull] CROSS-ACCOUNT RECLAIM (fullPull)',
        table,
        'local_id=', localId,
        'remote_id=', remoteId,
        'local_owner=', existing.owner_user_id,
        'current_user=', currentUserId,
      );
      existing = { ...existing, owner_user_id: currentUserId };
      reclaimedOwnership = true;
    } else {
      console.warn(
        '[sync/pull] CROSS-ACCOUNT SKIP',
        table,
        'local_id=', localId,
        'remote_id=', remoteId,
        'local_owner=', existing!.owner_user_id,
        'current_user=', currentUserId,
      );
      // 仅补 remote_id（若本地为空），不改归属、不改业务字段
      if (existing && !existing.remote_id) {
        await db.runAsync(
          `UPDATE ${table} SET remote_id = ? WHERE id = ?`,
          remoteId,
          existing.id,
        );
      }
      return false;
    }
  }

  if (serverDeletedAt) {
    if (existing) {
      await db.runAsync(
        `UPDATE ${table}
         SET remote_id = ?, deleted_at = ?, sync_status = 'synced', last_synced_at = ?
         WHERE id = ?`,
        remoteId,
        serverDeletedAt,
        serverUpdatedAt,
        existing.id,
      );
    }
    return true;
  }

  if (!existing) {
    const columns = [...input.insertColumns, 'owner_user_id', 'remote_id', 'sync_status', 'last_synced_at'];
    const values: DbValue[] = [...input.insertValues, currentUserId, remoteId, 'synced', serverUpdatedAt];
    const placeholders = columns.map(() => '?').join(', ');
    try {
      await db.runAsync(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
        ...values,
      );
    } catch (error) {
      console.error('[sync/pull] INSERT ERROR for', table, 'remote_id=', remoteId, ':', error instanceof Error ? error.message : error);
      throw error;
    }
    return true;
  }

  // 到这里 existing.owner_user_id === currentUserId（同账号），可安全覆盖
  const hasLocalChanges = existing.sync_status !== 'synced';
  if (!reclaimedOwnership && hasLocalChanges && existing.updated_at) {
    const localTs = new Date(existing.updated_at).getTime();
    const serverTs = new Date(serverUpdatedAt).getTime();
    if (!Number.isNaN(localTs) && !Number.isNaN(serverTs) && serverTs <= localTs) {
      await db.runAsync(
        `UPDATE ${table} SET remote_id = COALESCE(remote_id, ?) WHERE id = ?`,
        remoteId,
        existing.id,
      );
      return false;
    }
  }

  const setColumns = reclaimedOwnership
    ? [...input.updateColumns, 'owner_user_id', 'sync_status', 'last_synced_at', 'remote_id']
    : [...input.updateColumns, 'sync_status', 'last_synced_at', 'remote_id'];
  const setValues: DbValue[] = reclaimedOwnership
    ? [...input.updateValues, currentUserId, 'synced', serverUpdatedAt, remoteId]
    : [...input.updateValues, 'synced', serverUpdatedAt, remoteId];
  const assignments = setColumns.map((column) => `${column} = ?`).join(', ');
  await db.runAsync(`UPDATE ${table} SET ${assignments} WHERE id = ?`, ...setValues, existing.id);
  return true;
}

type IdUpsertInput = {
  table: string;
  id: string;
  ownerUserId?: string;
  reclaimExisting?: boolean;
  serverDeletedAt: string | null;
  insertColumns: string[];
  insertValues: DbValue[];
  updateColumns: string[];
  updateValues: DbValue[];
};

async function upsertById(db: LocalDatabase, input: IdUpsertInput): Promise<boolean> {
  const { table, id, serverDeletedAt } = input;

  if (serverDeletedAt) {
    await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, id);
    return true;
  }

  const existing = await db.getFirstAsync<{ id: string; owner_user_id?: string | null }>(
    `SELECT * FROM ${table} WHERE id = ? LIMIT 1`,
    id,
  );

  const ownershipMismatch =
    existing?.owner_user_id &&
    input.ownerUserId &&
    existing.owner_user_id !== input.ownerUserId;
  if (ownershipMismatch && !input.reclaimExisting) {
    console.warn(
      '[sync/pull] CROSS-ACCOUNT SKIP',
      table,
      'local_id=', id,
      'local_owner=', existing.owner_user_id,
      'current_user=', input.ownerUserId,
    );
    return false;
  }

  if (!existing) {
    const placeholders = input.insertColumns.map(() => '?').join(', ');
    await db.runAsync(
      `INSERT INTO ${table} (${input.insertColumns.join(', ')}) VALUES (${placeholders})`,
      ...input.insertValues,
    );
    return true;
  }

  if (ownershipMismatch) {
    console.warn(
      '[sync/pull] CROSS-ACCOUNT RECLAIM (fullPull)',
      table,
      'local_id=', id,
      'local_owner=', existing.owner_user_id,
      'current_user=', input.ownerUserId,
    );
  }

  const updateColumns = input.ownerUserId ? [...input.updateColumns, 'owner_user_id'] : input.updateColumns;
  const updateValues = input.ownerUserId ? [...input.updateValues, input.ownerUserId] : input.updateValues;
  const assignments = updateColumns.map((column) => `${column} = ?`).join(', ');
  await db.runAsync(`UPDATE ${table} SET ${assignments} WHERE id = ?`, ...updateValues, id);
  return true;
}

async function applyExercises(db: LocalDatabase, rows: ServerRow[]): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const id = asString(pick(payload, ['id'])) ?? row.client_id ?? row.id;
    if (!id) continue;

    const insertValues: DbValue[] = [
      id,
      asString(pick(payload, ['name'])) ?? row.name ?? '',
      asString(pick(payload, ['source'])) ?? 'system',
      asString(pick(payload, ['category'])) ?? 'other',
      asString(pick(payload, ['movementPattern', 'movement_pattern'])) ?? 'other',
      asString(pick(payload, ['targetMuscle', 'target_muscle'])) ?? '',
      asString(pick(payload, ['secondaryMuscle', 'secondary_muscle'])),
      asString(pick(payload, ['equipment'])) ?? 'other',
      asString(pick(payload, ['difficulty'])),
      asString(pick(payload, ['notes'])),
      asString(pick(payload, ['createdAt', 'created_at'])) ?? row.created_at,
      asString(pick(payload, ['updatedAt', 'updated_at'])) ?? row.updated_at,
    ];

    const updateValues: DbValue[] = insertValues.slice(1, 11);

    const wrote = await upsertById(db, {
      table: 'exercises',
      id,
      serverDeletedAt: row.deleted_at,
      insertColumns: [
        'id', 'name', 'source', 'category', 'movement_pattern', 'target_muscle', 'secondary_muscle',
        'equipment', 'difficulty', 'notes', 'created_at', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'name', 'source', 'category', 'movement_pattern', 'target_muscle', 'secondary_muscle',
        'equipment', 'difficulty', 'notes', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyTrainingPlans(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const remoteId = row.id;
    const serverUpdatedAt = resolveTimestamp(row);
    const insertValues: DbValue[] = [
      asString(pick(payload, ['id'])) ?? row.client_id ?? remoteId,
      asString(pick(payload, ['name'])) ?? row.name ?? '',
      asString(pick(payload, ['creatorId', 'creator_id'])) ?? currentUserId,
      asString(pick(payload, ['visibility'])) ?? 'private',
      asString(pick(payload, ['goal'])) ?? 'strength',
      asInt(pick(payload, ['durationWeeks', 'duration_weeks'])) ?? 1,
      asInt(pick(payload, ['frequencyPerWeek', 'frequency_per_week'])) ?? 1,
      asString(pick(payload, ['description'])),
      asString(pick(payload, ['source'])) ?? 'imported',
      asString(pick(payload, ['originSchemeId', 'origin_scheme_id'])),
      asInt(pick(payload, ['version'])) ?? 1,
      asString(pick(payload, ['createdAt', 'created_at'])) ?? row.created_at,
      asString(pick(payload, ['updatedAt', 'updated_at'])) ?? serverUpdatedAt,
    ];

    const updateValues: DbValue[] = [
      insertValues[1],
      insertValues[2],
      insertValues[3],
      insertValues[4],
      insertValues[5],
      insertValues[6],
      insertValues[7],
      insertValues[8],
      insertValues[9],
      insertValues[10],
      serverUpdatedAt,
    ];

    const wrote = await upsertWithRemoteId(db, {
      table: 'plan_templates',
      localId: insertValues[0] as string,
      remoteId,
      reclaimExisting,
      serverUpdatedAt,
      serverDeletedAt: row.deleted_at,
      currentUserId,
      insertColumns: [
        'id', 'name', 'creator_id', 'visibility', 'goal', 'duration_weeks', 'frequency_per_week',
        'description', 'source', 'origin_scheme_id', 'version', 'created_at', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'name', 'creator_id', 'visibility', 'goal', 'duration_weeks', 'frequency_per_week',
        'description', 'source', 'origin_scheme_id', 'version', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyPlanPhases(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const remoteId = row.id;
    const serverUpdatedAt = resolveTimestamp(row);
    const insertValues: DbValue[] = [
      asString(pick(payload, ['id'])) ?? row.client_id ?? remoteId,
      asString(pick(payload, ['planId', 'plan_id'])) ?? '',
      asString(pick(payload, ['name'])) ?? row.name ?? '训练阶段',
      asString(pick(payload, ['type'])) ?? 'custom',
      asInt(pick(payload, ['startWeek', 'start_week'])) ?? 1,
      asInt(pick(payload, ['endWeek', 'end_week'])) ?? 1,
      asInt(pick(payload, ['orderIndex', 'order_index'])) ?? 1,
      asString(pick(payload, ['createdAt', 'created_at'])) ?? row.created_at,
      asString(pick(payload, ['updatedAt', 'updated_at'])) ?? serverUpdatedAt,
    ];

    const updateValues: DbValue[] = [
      insertValues[1],
      insertValues[2],
      insertValues[3],
      insertValues[4],
      insertValues[5],
      insertValues[6],
      serverUpdatedAt,
    ];

    const wrote = await upsertWithRemoteId(db, {
      table: 'plan_phases',
      localId: insertValues[0] as string,
      remoteId,
      reclaimExisting,
      serverUpdatedAt,
      serverDeletedAt: row.deleted_at,
      currentUserId,
      insertColumns: [
        'id', 'plan_id', 'name', 'type', 'start_week', 'end_week', 'order_index', 'created_at', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'plan_id', 'name', 'type', 'start_week', 'end_week', 'order_index', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyPlanDays(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const id = asString(pick(payload, ['id'])) ?? row.client_id ?? row.id;
    if (!id) continue;

    const planId = asString(pick(payload, ['planId', 'plan_id'])) ?? '';
    const phaseId = asString(pick(payload, ['phaseId', 'phase_id'])) ?? '';
    const week = asInt(pick(payload, ['week'])) ?? 1;
    const weekday = asInt(pick(payload, ['weekday'])) ?? 1;
    const title = asString(pick(payload, ['title'])) ?? '';
    const focus = asString(pick(payload, ['focus'])) ?? '';
    const notes = asString(pick(payload, ['notes']));

    const insertValues: DbValue[] = [
      id,
      currentUserId,
      planId,
      phaseId,
      week,
      weekday,
      title,
      focus,
      notes,
    ];

    // 服务器 phase_id 为空时，不覆盖本地 phase_id（保留本地 seed 的内置计划阶段关联）
    const updateColumns: string[] = ['plan_id', 'week', 'weekday', 'title', 'focus', 'notes'];
    const updateValues: DbValue[] = [planId, week, weekday, title, focus, notes];
    if (phaseId) {
      updateColumns.unshift('phase_id');
      updateValues.unshift(phaseId);
    }

    const wrote = await upsertById(db, {
      table: 'plan_days',
      id,
      ownerUserId: currentUserId,
      reclaimExisting,
      serverDeletedAt: row.deleted_at,
      insertColumns: ['id', 'owner_user_id', 'plan_id', 'phase_id', 'week', 'weekday', 'title', 'focus', 'notes'],
      insertValues,
      updateColumns,
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyPlanExercises(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const id = asString(pick(payload, ['id'])) ?? row.client_id ?? row.id;
    if (!id) continue;

    const insertValues: DbValue[] = [
      id,
      currentUserId,
      asString(pick(payload, ['planDayId', 'plan_day_id'])) ?? '',
      asString(pick(payload, ['exerciseId', 'exercise_id'])) ?? '',
      asString(pick(payload, ['priority'])) ?? 'A',
      asInt(pick(payload, ['orderIndex', 'order_index'])) ?? 0,
      asInt(pick(payload, ['sets'])),
      asInt(pick(payload, ['reps'])),
      asInt(pick(payload, ['repMin', 'rep_min'])),
      asInt(pick(payload, ['repMax', 'rep_max'])),
      asString(pick(payload, ['intensityType', 'intensity_type'])) ?? 'manual',
      asNumber(pick(payload, ['percent1RM', 'percent_1rm'])),
      asNumber(pick(payload, ['rpeTarget', 'rpe_target'])),
      asNumber(pick(payload, ['rirTarget', 'rir_target'])),
      asNumber(pick(payload, ['fixedWeight', 'fixed_weight'])),
      asString(pick(payload, ['referenceLift', 'reference_lift'])) ?? 'none',
      asInt(pick(payload, ['restSeconds', 'rest_seconds'])),
      asString(pick(payload, ['progressionRuleId', 'progression_rule_id'])),
      asString(pick(payload, ['notes'])),
    ];

    const updateValues: DbValue[] = insertValues.slice(2);

    const wrote = await upsertById(db, {
      table: 'plan_exercises',
      id,
      ownerUserId: currentUserId,
      reclaimExisting,
      serverDeletedAt: row.deleted_at,
      insertColumns: [
        'id', 'owner_user_id', 'plan_day_id', 'exercise_id', 'priority', 'order_index', 'sets', 'reps',
        'rep_min', 'rep_max', 'intensity_type', 'percent_1rm', 'rpe_target', 'rir_target', 'fixed_weight',
        'reference_lift', 'rest_seconds', 'progression_rule_id', 'notes',
      ],
      insertValues,
      updateColumns: [
        'plan_day_id', 'exercise_id', 'priority', 'order_index', 'sets', 'reps', 'rep_min', 'rep_max',
        'intensity_type', 'percent_1rm', 'rpe_target', 'rir_target', 'fixed_weight', 'reference_lift',
        'rest_seconds', 'progression_rule_id', 'notes',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyWorkoutSessions(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const remoteId = row.id;
    const serverUpdatedAt = resolveTimestamp(row);
    const insertValues: DbValue[] = [
      asString(pick(payload, ['id'])) ?? row.client_id ?? remoteId,
      asString(pick(payload, ['groupId', 'group_id'])) ?? row.group_id ?? '',
      asString(pick(payload, ['planId', 'plan_id'])) ?? '',
      asString(pick(payload, ['phaseId', 'phase_id'])),
      asString(pick(payload, ['date'])) ?? '',
      asInt(pick(payload, ['week'])) ?? 1,
      asInt(pick(payload, ['weekday'])) ?? 1,
      asString(pick(payload, ['title'])) ?? row.title ?? '',
      asString(pick(payload, ['status'])) ?? row.status ?? 'draft',
      asString(pick(payload, ['trainingMode', 'training_mode'])) ?? 'group_local',
      asString(pick(payload, ['startedAt', 'started_at'])),
      asString(pick(payload, ['finishedAt', 'finished_at'])),
      asString(pick(payload, ['createdAt', 'created_at'])) ?? row.created_at,
      asString(pick(payload, ['updatedAt', 'updated_at'])) ?? serverUpdatedAt,
    ];

    const updateValues: DbValue[] = [
      insertValues[1],
      insertValues[2],
      insertValues[3],
      insertValues[4],
      insertValues[5],
      insertValues[6],
      insertValues[7],
      insertValues[8],
      insertValues[9],
      insertValues[10],
      insertValues[11],
      serverUpdatedAt,
    ];

    const wrote = await upsertWithRemoteId(db, {
      table: 'workout_sessions',
      localId: insertValues[0] as string,
      remoteId,
      reclaimExisting,
      serverUpdatedAt,
      serverDeletedAt: row.deleted_at,
      currentUserId,
      insertColumns: [
        'id', 'group_id', 'plan_id', 'phase_id', 'date', 'week', 'weekday', 'title', 'status',
        'training_mode', 'started_at', 'finished_at', 'created_at', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'group_id', 'plan_id', 'phase_id', 'date', 'week', 'weekday', 'title', 'status',
        'training_mode', 'started_at', 'finished_at', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyWorkoutExerciseRecords(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const remoteId = row.id;
    const serverUpdatedAt = resolveTimestamp(row);
    const insertValues: DbValue[] = [
      asString(pick(payload, ['id'])) ?? row.client_id ?? remoteId,
      asString(pick(payload, ['sessionId', 'session_id'])) ?? '',
      asString(pick(payload, ['planExerciseId', 'plan_exercise_id'])),
      asString(pick(payload, ['exerciseId', 'exercise_id'])) ?? row.exercise_client_id ?? '',
      asInt(pick(payload, ['orderIndex', 'order_index'])) ?? 0,
      asString(pick(payload, ['replacedFromExerciseId', 'replaced_from_exercise_id'])),
      asString(pick(payload, ['priority'])) ?? 'A',
      asInt(pick(payload, ['plannedSets', 'planned_sets'])),
      asInt(pick(payload, ['plannedReps', 'planned_reps'])),
      asInt(pick(payload, ['plannedRepMin', 'planned_rep_min'])),
      asInt(pick(payload, ['plannedRepMax', 'planned_rep_max'])),
      asNumber(pick(payload, ['plannedRpe', 'planned_rpe'])),
      asNumber(pick(payload, ['plannedRir', 'planned_rir'])),
      asNumber(pick(payload, ['plannedPercent1RM', 'planned_percent_1rm'])),
      asInt(pick(payload, ['plannedRestSeconds', 'planned_rest_seconds'])),
      asString(pick(payload, ['notes'])),
      serverUpdatedAt,
    ];

    const updateValues: DbValue[] = insertValues.slice(1);

    const wrote = await upsertWithRemoteId(db, {
      table: 'workout_exercise_records',
      localId: insertValues[0] as string,
      remoteId,
      reclaimExisting,
      serverUpdatedAt,
      serverDeletedAt: row.deleted_at,
      currentUserId,
      insertColumns: [
        'id', 'session_id', 'plan_exercise_id', 'exercise_id', 'order_index',
        'replaced_from_exercise_id', 'priority', 'planned_sets', 'planned_reps', 'planned_rep_min',
        'planned_rep_max', 'planned_rpe', 'planned_rir', 'planned_percent_1rm', 'planned_rest_seconds',
        'notes', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'session_id', 'plan_exercise_id', 'exercise_id', 'order_index', 'replaced_from_exercise_id',
        'priority', 'planned_sets', 'planned_reps', 'planned_rep_min', 'planned_rep_max', 'planned_rpe',
        'planned_rir', 'planned_percent_1rm', 'planned_rest_seconds', 'notes', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyWorkoutSets(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const remoteId = row.id;
    const serverUpdatedAt = resolveTimestamp(row);
    const insertValues: DbValue[] = [
      asString(pick(payload, ['id'])) ?? row.client_id ?? remoteId,
      asString(pick(payload, ['sessionId', 'session_id'])) ?? '',
      asString(pick(payload, ['exerciseRecordId', 'exercise_record_id'])) ?? '',
      asString(pick(payload, ['memberId', 'member_id'])) ?? row.member_client_id ?? '',
      asInt(pick(payload, ['setNumber', 'set_number'])) ?? 0,
      asNumber(pick(payload, ['plannedWeight', 'planned_weight'])),
      asNumber(pick(payload, ['actualWeight', 'actual_weight'])) ?? row.actual_weight,
      asInt(pick(payload, ['plannedReps', 'planned_reps'])),
      asInt(pick(payload, ['actualReps', 'actual_reps'])) ?? row.actual_reps,
      asNumber(pick(payload, ['rpe'])),
      asNumber(pick(payload, ['rir'])),
      asInt(pick(payload, ['actualRestSeconds', 'actual_rest_seconds'])),
      asBoolInt(pick(payload, ['completed'])),
      asBoolInt(pick(payload, ['skipped'])),
      asString(pick(payload, ['notes'])),
      asString(pick(payload, ['createdAt', 'created_at'])) ?? row.created_at,
      asString(pick(payload, ['updatedAt', 'updated_at'])) ?? serverUpdatedAt,
    ];

    const updateValues: DbValue[] = [
      insertValues[1],
      insertValues[2],
      insertValues[3],
      insertValues[4],
      insertValues[5],
      insertValues[6],
      insertValues[7],
      insertValues[8],
      insertValues[9],
      insertValues[10],
      insertValues[11],
      insertValues[12],
      insertValues[13],
      insertValues[14],
      serverUpdatedAt,
    ];

    const wrote = await upsertWithRemoteId(db, {
      table: 'workout_sets',
      localId: insertValues[0] as string,
      remoteId,
      reclaimExisting,
      serverUpdatedAt,
      serverDeletedAt: row.deleted_at,
      currentUserId,
      insertColumns: [
        'id', 'session_id', 'exercise_record_id', 'member_id', 'set_number', 'planned_weight',
        'actual_weight', 'planned_reps', 'actual_reps', 'rpe', 'rir', 'actual_rest_seconds',
        'completed', 'skipped', 'notes', 'created_at', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'session_id', 'exercise_record_id', 'member_id', 'set_number', 'planned_weight', 'actual_weight',
        'planned_reps', 'actual_reps', 'rpe', 'rir', 'actual_rest_seconds', 'completed', 'skipped',
        'notes', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyBodyMetrics(
  db: LocalDatabase,
  rows: ServerRow[],
  currentUserId: string,
  reclaimExisting: boolean,
): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const remoteId = row.id;
    const serverUpdatedAt = resolveTimestamp(row);
    const insertValues: DbValue[] = [
      asString(pick(payload, ['id'])) ?? row.client_id ?? remoteId,
      asString(pick(payload, ['memberId', 'member_id'])) ?? row.member_client_id ?? '',
      asString(pick(payload, ['date'])) ?? '',
      asNumber(pick(payload, ['weightKg', 'weight_kg'])),
      asNumber(pick(payload, ['bodyFatPercent', 'body_fat_percent'])),
      asNumber(pick(payload, ['chestCm', 'chest_cm'])),
      asNumber(pick(payload, ['waistCm', 'waist_cm'])),
      asNumber(pick(payload, ['hipCm', 'hip_cm'])),
      asNumber(pick(payload, ['bicepCm', 'bicep_cm'])),
      asNumber(pick(payload, ['thighCm', 'thigh_cm'])),
      asNumber(pick(payload, ['calfCm', 'calf_cm'])),
      asString(pick(payload, ['notes'])),
      asString(pick(payload, ['createdAt', 'created_at'])) ?? row.created_at,
      asString(pick(payload, ['updatedAt', 'updated_at'])) ?? serverUpdatedAt,
    ];

    const updateValues: DbValue[] = [
      insertValues[1],
      insertValues[2],
      insertValues[3],
      insertValues[4],
      insertValues[5],
      insertValues[6],
      insertValues[7],
      insertValues[8],
      insertValues[9],
      insertValues[10],
      insertValues[11],
      serverUpdatedAt,
    ];

    const wrote = await upsertWithRemoteId(db, {
      table: 'body_metrics',
      localId: insertValues[0] as string,
      remoteId,
      reclaimExisting,
      serverUpdatedAt,
      serverDeletedAt: row.deleted_at,
      currentUserId,
      insertColumns: [
        'id', 'member_id', 'date', 'weight_kg', 'body_fat_percent', 'chest_cm', 'waist_cm', 'hip_cm',
        'bicep_cm', 'thigh_cm', 'calf_cm', 'notes', 'created_at', 'updated_at',
      ],
      insertValues,
      updateColumns: [
        'member_id', 'date', 'weight_kg', 'body_fat_percent', 'chest_cm', 'waist_cm', 'hip_cm',
        'bicep_cm', 'thigh_cm', 'calf_cm', 'notes', 'updated_at',
      ],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

type PullEntityCounts = {
  groupMembers: number;
  groups: number;
  planDays: number;
  planExercises: number;
  planPhases: number;
  trainingPlans: number;
  workoutExerciseRecords: number;
  workoutSessions: number;
  workoutSets: number;
};

type PullResult = {
  ok: boolean;
  pulled: number;
  localCounts?: PullEntityCounts;
  message?: string;
  remoteCounts?: PullEntityCounts;
  serverTime?: string;
};

function countChangeRows(changes: Record<string, ServerRow[]>, key: keyof PullEntityCounts): number {
  const value = changes[key];
  return Array.isArray(value) ? value.length : 0;
}

function buildRemoteCounts(changes: Record<string, ServerRow[]>): PullEntityCounts {
  return {
    groupMembers: 0,
    groups: 0,
    planDays: countChangeRows(changes, 'planDays'),
    planExercises: countChangeRows(changes, 'planExercises'),
    planPhases: countChangeRows(changes, 'planPhases'),
    trainingPlans: countChangeRows(changes, 'trainingPlans'),
    workoutExerciseRecords: countChangeRows(changes, 'workoutExerciseRecords'),
    workoutSessions: countChangeRows(changes, 'workoutSessions'),
    workoutSets: countChangeRows(changes, 'workoutSets'),
  };
}

async function countFirst(db: LocalDatabase, sql: string, ...params: DbValue[]): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(sql, ...params);
  return row?.count ?? 0;
}

async function countVisibleLocalData(db: LocalDatabase, currentUserId: string): Promise<PullEntityCounts> {
  const [
    groups,
    groupMembers,
    trainingPlans,
    planPhases,
    planDays,
    planExercises,
    workoutSessions,
    workoutExerciseRecords,
    workoutSets,
  ] = await Promise.all([
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM groups
       WHERE deleted_at IS NULL
         AND (owner_user_id = ? OR EXISTS (
           SELECT 1 FROM group_members gm
           WHERE gm.group_id = groups.id
             AND gm.user_id = ?
             AND gm.deleted_at IS NULL
         ))`,
      currentUserId,
      currentUserId,
    ),
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM group_members
       WHERE owner_user_id = ? AND deleted_at IS NULL`,
      currentUserId,
    ),
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM plan_templates
       WHERE owner_user_id = ? AND deleted_at IS NULL AND source != 'system'`,
      currentUserId,
    ),
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM plan_phases
       WHERE owner_user_id = ? AND deleted_at IS NULL`,
      currentUserId,
    ),
    countFirst(db, 'SELECT COUNT(*) AS count FROM plan_days WHERE owner_user_id = ?', currentUserId),
    countFirst(db, 'SELECT COUNT(*) AS count FROM plan_exercises WHERE owner_user_id = ?', currentUserId),
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM workout_sessions
       WHERE owner_user_id = ? AND deleted_at IS NULL`,
      currentUserId,
    ),
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM workout_exercise_records
       WHERE owner_user_id = ? AND deleted_at IS NULL`,
      currentUserId,
    ),
    countFirst(
      db,
      `SELECT COUNT(*) AS count FROM workout_sets
       WHERE owner_user_id = ? AND deleted_at IS NULL`,
      currentUserId,
    ),
  ]);

  return {
    groupMembers,
    groups,
    planDays,
    planExercises,
    planPhases,
    trainingPlans,
    workoutExerciseRecords,
    workoutSessions,
    workoutSets,
  };
}

async function reconcileActivePlanAfterPull(db: LocalDatabase, currentUserId: string): Promise<string | null> {
  const group = await db.getFirstAsync<{
    active_plan_id: string | null;
    current_week: number;
    id: string;
  }>(
    `SELECT id, active_plan_id, current_week FROM groups
     WHERE deleted_at IS NULL
       AND (owner_user_id = ? OR EXISTS (
         SELECT 1 FROM group_members gm
         WHERE gm.group_id = groups.id
           AND gm.user_id = ?
           AND gm.deleted_at IS NULL
       ))
     ORDER BY created_at ASC
     LIMIT 1`,
    currentUserId,
    currentUserId,
  );
  if (!group) return null;

  if (group.active_plan_id) {
    const activePlan = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM plan_templates
       WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      group.active_plan_id,
      currentUserId,
    );
    if (activePlan) return null;
  }

  const recentSessionPlan = await db.getFirstAsync<{ plan_id: string }>(
    `SELECT plan_id FROM workout_sessions
     WHERE owner_user_id = ?
       AND deleted_at IS NULL
       AND plan_id IS NOT NULL
       AND plan_id != ''
     ORDER BY date DESC, updated_at DESC
     LIMIT 1`,
    currentUserId,
  );
  const fallbackPlanId = recentSessionPlan?.plan_id
    ? await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM plan_templates
         WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL
         LIMIT 1`,
        recentSessionPlan.plan_id,
        currentUserId,
      )
    : await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM plan_templates
         WHERE owner_user_id = ?
           AND deleted_at IS NULL
           AND source != 'system'
         ORDER BY updated_at DESC, created_at DESC
         LIMIT 1`,
        currentUserId,
      );

  if (!fallbackPlanId?.id) return null;

  const currentWeek = Math.max(1, group.current_week || 1);
  const phase = await db.getFirstAsync<{ type: string }>(
    `SELECT type FROM plan_phases
     WHERE plan_id = ?
       AND owner_user_id = ?
       AND deleted_at IS NULL
       AND start_week <= ?
       AND end_week >= ?
     ORDER BY order_index ASC
     LIMIT 1`,
    fallbackPlanId.id,
    currentUserId,
    currentWeek,
    currentWeek,
  );

  await db.runAsync(
    `UPDATE groups
     SET active_plan_id = ?,
         current_phase_type = COALESCE(?, current_phase_type),
         updated_at = ?
     WHERE id = ?`,
    fallbackPlanId.id,
    phase?.type ?? null,
    new Date().toISOString(),
    group.id,
  );
  console.log('[RESTORE] reconciled active plan', {
    groupId: group.id,
    planId: fallbackPlanId.id,
    userId: currentUserId,
  });
  return fallbackPlanId.id;
}

function validateFullPullVisibility(remoteCounts: PullEntityCounts, localCounts: PullEntityCounts): string[] {
  const failures: string[] = [];
  const checks: [keyof PullEntityCounts, string][] = [
    ['workoutSessions', '训练记录'],
    ['workoutExerciseRecords', '动作记录'],
    ['workoutSets', '训练组'],
    ['trainingPlans', '训练计划'],
    ['planPhases', '计划阶段'],
    ['planDays', '训练日'],
    ['planExercises', '计划动作'],
  ];

  for (const [key, label] of checks) {
    if (remoteCounts[key] > 0 && localCounts[key] === 0) {
      failures.push(`${label}远端 ${remoteCounts[key]} 条，本地当前账号可见 0 条`);
    }
  }
  return failures;
}

function buildPullMessage(
  remoteCounts: PullEntityCounts,
  localCounts: PullEntityCounts,
  reconciledPlanId: string | null,
): string {
  const parts = [
    `训练 ${localCounts.workoutSessions}/${remoteCounts.workoutSessions}`,
    `组 ${localCounts.workoutSets}/${remoteCounts.workoutSets}`,
    `动作记录 ${localCounts.workoutExerciseRecords}/${remoteCounts.workoutExerciseRecords}`,
    `计划 ${localCounts.trainingPlans}/${remoteCounts.trainingPlans}`,
    `训练日 ${localCounts.planDays}/${remoteCounts.planDays}`,
  ];
  const suffix = reconciledPlanId ? `；已恢复当前计划 ${reconciledPlanId}` : '';
  return `云端拉取已完成：${parts.join('，')}${suffix}`;
}

export async function pullFromServer(
  options?: { fullPull?: boolean },
): Promise<PullResult> {
  const session = await readStoredSession();
  if (!session) {
    return { ok: false, pulled: 0, message: '未登录，跳过拉取同步数据。' };
  }

  const currentUserId = await getCurrentAccountUserId();
  if (!currentUserId) {
    return { ok: false, pulled: 0, message: '无法确定当前账号，跳过拉取同步数据。' };
  }

  const db = await initializeLocalDatabase();
  const since = options?.fullPull ? new Date(0).toISOString() : await getLastPullAt(db, currentUserId);
  const path = `/sync/pull?since=${encodeURIComponent(since)}&deviceId=${DEVICE_ID}`;

  console.log('[sync/pull] calling', path);
  console.log('[RESTORE] currentUserId=', currentUserId, 'fullPull=', options?.fullPull, 'since=', since);
  const result = await apiRequest<PullResponse>(path, {
    accessToken: session.accessToken,
  });

  const changes = result.changes ?? {};
  const remoteCounts = buildRemoteCounts(changes);
  const totalCount = Object.values(changes).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  console.log('[sync/pull] received', totalCount, 'records:',
    Object.entries(changes).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : 0}`).join(', '));
  console.log('[RESTORE] pulled sessions=', remoteCounts.workoutSessions,
    'pulled sets=', remoteCounts.workoutSets,
    'pulled records=', remoteCounts.workoutExerciseRecords,
    'pulled plans=', remoteCounts.trainingPlans,
    'pulled days=', remoteCounts.planDays,
    'pulled exercises=', remoteCounts.planExercises);

  let pulled = 0;
  const reclaimExisting = Boolean(options?.fullPull);

  const applySteps: [string, () => Promise<number>][] = [
    ['exercises', () => applyExercises(db, (changes.exercises as ServerRow[] | undefined) ?? [])],
    ['trainingPlans', () => applyTrainingPlans(db, (changes.trainingPlans as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['planPhases', () => applyPlanPhases(db, (changes.planPhases as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['planDays', () => applyPlanDays(db, (changes.planDays as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['planExercises', () => applyPlanExercises(db, (changes.planExercises as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['workoutSessions', () => applyWorkoutSessions(db, (changes.workoutSessions as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['workoutExerciseRecords', () => applyWorkoutExerciseRecords(db, (changes.workoutExerciseRecords as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['workoutSets', () => applyWorkoutSets(db, (changes.workoutSets as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
    ['bodyMetrics', () => applyBodyMetrics(db, (changes.bodyMetrics as ServerRow[] | undefined) ?? [], currentUserId, reclaimExisting)],
  ];

  const errors: string[] = [];
  for (const step of applySteps) {
    const name = step[0];
    const fn = step[1];
    try {
      const n = await fn();
      console.log('[sync/pull] applied', n, 'for', name);
      if (name === 'workoutSessions') console.log('[RESTORE] inserted/applied sessions=', n);
      if (name === 'workoutSets') console.log('[RESTORE] inserted/applied sets=', n);
      if (name === 'workoutExerciseRecords') console.log('[RESTORE] inserted/applied records=', n);
      if (name === 'trainingPlans') console.log('[RESTORE] inserted/applied plans=', n);
      if (name === 'planPhases') console.log('[RESTORE] inserted/applied phases=', n);
      if (name === 'planDays') console.log('[RESTORE] inserted/applied days=', n);
      if (name === 'planExercises') console.log('[RESTORE] inserted/applied plan exercises=', n);
      pulled += n;
    } catch (error) {
      console.error('[sync/pull] ERROR applying', name, ':', error instanceof Error ? error.message : error);
      errors.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      pulled,
      remoteCounts,
      serverTime: result.serverTime,
      message: `云端数据拉取未完全应用，已保留上次同步游标：${errors.join('; ')}`,
    };
  }

  const reconciledPlanId = options?.fullPull ? await reconcileActivePlanAfterPull(db, currentUserId) : null;
  if (options?.fullPull) {
    await repairBuiltInPlanPhaseLinks(db);
  }
  const localCounts = await countVisibleLocalData(db, currentUserId);
  console.log('[RESTORE] visible counts after pull=', JSON.stringify(localCounts));

  if (options?.fullPull) {
    const visibilityFailures = validateFullPullVisibility(remoteCounts, localCounts);
    if (visibilityFailures.length > 0) {
      return {
        ok: false,
        localCounts,
        pulled,
        remoteCounts,
        serverTime: result.serverTime,
        message: `云端恢复未完成：${visibilityFailures.join('；')}`,
      };
    }
  }

  await setLastPullAt(db, currentUserId, result.serverTime);
  console.log('[sync/pull] done, total applied:', pulled);

  return {
    ok: true,
    localCounts,
    message: buildPullMessage(remoteCounts, localCounts, reconciledPlanId),
    pulled,
    remoteCounts,
    serverTime: result.serverTime,
  };
}

/**
 * 修复内置计划 plan_days.phase_id 关联。
 * 服务器 plan_phases 数据缺失时，fullPull 可能导致本地 plan_days.phase_id 被清空，
 * 这里用内置 seed 数据的 phase_id 修复本地 plan_days。
 */
async function repairBuiltInPlanPhaseLinks(db: LocalDatabase): Promise<void> {
  const seedDays = [
    ...defaultStrengthPlanDaySeeds,
    ...defaultDeloadPlanDaySeeds,
    ...defaultHypertrophyPlanDaySeeds,
  ];
  let repaired = 0;
  for (const day of seedDays) {
    const result = await db.runAsync(
      `UPDATE plan_days SET phase_id = ? WHERE id = ? AND (phase_id IS NULL OR phase_id = '')`,
      day.phaseId,
      day.id,
    );
    if (result.changes > 0) repaired += result.changes;
  }
  if (repaired > 0) {
    console.log('[RESTORE] repaired plan_days.phase_id for built-in plan:', repaired);
  }
}
