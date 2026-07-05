import { initializeLocalDatabase } from '@/data/local/db';
import { getCurrentAccountUserId } from '@/data/local/accountScope';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

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
  const existing =
    existingByRemoteId ??
    (await db.getFirstAsync<ExistingRemoteRow>(
      `SELECT id, owner_user_id, remote_id, sync_status, updated_at FROM ${table} WHERE id = ? LIMIT 1`,
      localId,
    ));

  if (serverDeletedAt) {
    if (existing) {
      await db.runAsync(
        `UPDATE ${table}
         SET owner_user_id = ?, remote_id = ?, deleted_at = ?, sync_status = 'synced', last_synced_at = ?
         WHERE id = ?`,
        currentUserId,
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

  const ownershipMismatch = existing.owner_user_id !== currentUserId;
  const hasLocalChanges = !ownershipMismatch && existing.sync_status !== 'synced';
  if (hasLocalChanges && existing.updated_at) {
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

  const setColumns = [...input.updateColumns, 'owner_user_id', 'sync_status', 'last_synced_at', 'remote_id'];
  const setValues: DbValue[] = [...input.updateValues, currentUserId, 'synced', serverUpdatedAt, remoteId];
  const assignments = setColumns.map((column) => `${column} = ?`).join(', ');
  await db.runAsync(`UPDATE ${table} SET ${assignments} WHERE id = ?`, ...setValues, existing.id);
  return true;
}

type IdUpsertInput = {
  table: string;
  id: string;
  ownerUserId?: string;
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

  if (!existing) {
    const placeholders = input.insertColumns.map(() => '?').join(', ');
    await db.runAsync(
      `INSERT INTO ${table} (${input.insertColumns.join(', ')}) VALUES (${placeholders})`,
      ...input.insertValues,
    );
    return true;
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

async function applyTrainingPlans(db: LocalDatabase, rows: ServerRow[], currentUserId: string): Promise<number> {
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
      asString(pick(payload, ['source'])) ?? 'system',
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

async function applyPlanDays(db: LocalDatabase, rows: ServerRow[], currentUserId: string): Promise<number> {
  let applied = 0;
  for (const row of rows) {
    const payload = normalizePayload(row);
    const id = asString(pick(payload, ['id'])) ?? row.client_id ?? row.id;
    if (!id) continue;

    const insertValues: DbValue[] = [
      id,
      currentUserId,
      asString(pick(payload, ['planId', 'plan_id'])) ?? '',
      asString(pick(payload, ['phaseId', 'phase_id'])) ?? '',
      asInt(pick(payload, ['week'])) ?? 1,
      asInt(pick(payload, ['weekday'])) ?? 1,
      asString(pick(payload, ['title'])) ?? '',
      asString(pick(payload, ['focus'])) ?? '',
      asString(pick(payload, ['notes'])),
    ];

    const updateValues: DbValue[] = [
      insertValues[2],
      insertValues[3],
      insertValues[4],
      insertValues[5],
      insertValues[6],
      insertValues[7],
      insertValues[8],
    ];

    const wrote = await upsertById(db, {
      table: 'plan_days',
      id,
      ownerUserId: currentUserId,
      serverDeletedAt: row.deleted_at,
      insertColumns: ['id', 'owner_user_id', 'plan_id', 'phase_id', 'week', 'weekday', 'title', 'focus', 'notes'],
      insertValues,
      updateColumns: ['plan_id', 'phase_id', 'week', 'weekday', 'title', 'focus', 'notes'],
      updateValues,
    });
    if (wrote) applied += 1;
  }
  return applied;
}

async function applyPlanExercises(db: LocalDatabase, rows: ServerRow[], currentUserId: string): Promise<number> {
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

async function applyWorkoutSessions(db: LocalDatabase, rows: ServerRow[], currentUserId: string): Promise<number> {
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

async function applyWorkoutSets(db: LocalDatabase, rows: ServerRow[], currentUserId: string): Promise<number> {
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

async function applyBodyMetrics(db: LocalDatabase, rows: ServerRow[], currentUserId: string): Promise<number> {
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

export async function pullFromServer(
  options?: { fullPull?: boolean },
): Promise<{ ok: boolean; pulled: number; serverTime?: string; message?: string }> {
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
  const result = await apiRequest<PullResponse>(path, {
    accessToken: session.accessToken,
  });

  const changes = result.changes ?? {};
  const totalCount = Object.values(changes).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  console.log('[sync/pull] received', totalCount, 'records:',
    Object.entries(changes).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : 0}`).join(', '));

  let pulled = 0;

  const applySteps: [string, () => Promise<number>][] = [
    ['exercises', () => applyExercises(db, (changes.exercises as ServerRow[] | undefined) ?? [])],
    ['trainingPlans', () => applyTrainingPlans(db, (changes.trainingPlans as ServerRow[] | undefined) ?? [], currentUserId)],
    ['planDays', () => applyPlanDays(db, (changes.planDays as ServerRow[] | undefined) ?? [], currentUserId)],
    ['planExercises', () => applyPlanExercises(db, (changes.planExercises as ServerRow[] | undefined) ?? [], currentUserId)],
    ['workoutSessions', () => applyWorkoutSessions(db, (changes.workoutSessions as ServerRow[] | undefined) ?? [], currentUserId)],
    ['workoutExerciseRecords', () => applyWorkoutExerciseRecords(db, (changes.workoutExerciseRecords as ServerRow[] | undefined) ?? [], currentUserId)],
    ['workoutSets', () => applyWorkoutSets(db, (changes.workoutSets as ServerRow[] | undefined) ?? [], currentUserId)],
    ['bodyMetrics', () => applyBodyMetrics(db, (changes.bodyMetrics as ServerRow[] | undefined) ?? [], currentUserId)],
  ];

  const errors: string[] = [];
  for (const step of applySteps) {
    const name = step[0];
    const fn = step[1];
    try {
      const n = await fn();
      console.log('[sync/pull] applied', n, 'for', name);
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
      serverTime: result.serverTime,
      message: `云端数据拉取未完全应用，已保留上次同步游标：${errors.join('; ')}`,
    };
  }

  await setLastPullAt(db, currentUserId, result.serverTime);
  console.log('[sync/pull] done, total applied:', pulled);

  return { ok: true, pulled, serverTime: result.serverTime };
}
