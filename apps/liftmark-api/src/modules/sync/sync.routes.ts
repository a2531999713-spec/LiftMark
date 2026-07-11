import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { z } from 'zod';
import { syncEntitySchema, syncPushSchema } from '@liftmark/shared';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest } from '../../utils/errors';
import { createId } from '../../utils/ids';
import { syncEntityTableByType, type SyncEntityType } from './sync.contract';
import { assertSyncSchemaReady } from './sync.schema-health';
import { isUndefinedTableError } from './sync.schema-errors';

const entityTableByType = syncEntityTableByType;
type EntityType = SyncEntityType;
type SyncDb = typeof db | Knex.Transaction;

function getPayloadNumber(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim()) return Number(value);
  }
  return null;
}

function getPayloadString(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

function assertPayloadUserMatchesToken(userId: string, payload: Record<string, unknown>) {
  const payloadUserId = getPayloadString(payload, [
    'ownerUserId',
    'owner_user_id',
    'accountUserId',
    'account_user_id',
    'userId',
    'user_id',
  ]);
  if (payloadUserId && payloadUserId !== userId) {
    throw badRequest('sync payload user_id does not match authenticated user.');
  }
}

async function upsertEntity(conn: SyncDb, userId: string, entityType: EntityType, item: z.infer<typeof syncEntitySchema>) {
  const tableName = entityTableByType[entityType];
  const payload = item.payload ?? {};
  assertPayloadUserMatchesToken(userId, payload);
  const clientUpdatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();
  const existingByClientId = await conn(tableName).where({ user_id: userId, client_id: item.clientId }).first();
  const existingByServerId = item.serverId
    ? await conn(tableName).where({ user_id: userId, id: item.serverId }).first()
    : null;
  const existing = existingByClientId ?? existingByServerId;

  if (existing && new Date(existing.client_updated_at ?? existing.updated_at) > clientUpdatedAt) {
    return {
      clientId: item.clientId,
      serverId: existing.id,
      skipped: true,
      entityType,
    };
  }

  const serverId = existing?.id ?? createId(entityType.toLowerCase());
  const row = {
    id: serverId,
    user_id: userId,
    group_id: item.groupId ?? existing?.group_id ?? null,
    client_id: item.clientId,
    parent_server_id: item.parentServerId ?? existing?.parent_server_id ?? null,
    name: item.name ?? getPayloadString(payload, ['name']) ?? existing?.name ?? null,
    title: item.title ?? getPayloadString(payload, ['title']) ?? existing?.title ?? null,
    status: item.status ?? getPayloadString(payload, ['status']) ?? existing?.status ?? null,
    member_client_id: getPayloadString(payload, ['memberId', 'member_id', 'memberClientId']) ?? existing?.member_client_id ?? null,
    exercise_client_id: getPayloadString(payload, ['exerciseId', 'exercise_id', 'exerciseClientId']) ?? existing?.exercise_client_id ?? null,
    actual_weight: getPayloadNumber(payload, ['actualWeight', 'actual_weight', 'weight']),
    actual_reps: getPayloadNumber(payload, ['actualReps', 'actual_reps', 'reps']),
    sync_version: (existing?.sync_version ?? 0) + 1,
    client_updated_at: clientUpdatedAt,
    deleted_at: item.deletedAt ? new Date(item.deletedAt) : null,
    payload,
    updated_at: new Date(),
    created_at: existing?.created_at ?? new Date(),
  };

  if (existing) {
    await conn(tableName).where({ id: serverId }).update(row);
  } else {
    await conn(tableName).insert(row);
  }

  await conn('sync_mappings')
    .insert({
      id: createId('map'),
      user_id: userId,
      entity_type: entityType,
      client_id: item.clientId,
      server_id: serverId,
      created_at: new Date(),
    })
    .onConflict(['user_id', 'entity_type', 'client_id'])
    .merge({ server_id: serverId });

  return {
    clientId: item.clientId,
    serverId,
    skipped: false,
    entityType,
  };
}

async function listChanges(userId: string, since?: string) {
  await assertSyncSchemaReady();
  const sinceDate = since ? new Date(since) : new Date(0);
  const result: Record<EntityType, unknown[]> = {
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

  for (const [entityType, tableName] of Object.entries(entityTableByType) as [EntityType, string][]) {
    try {
      result[entityType] = await db(tableName)
        .select('*')
        .where({ user_id: userId })
        .where('updated_at', '>', sinceDate)
        .orderBy('updated_at', 'asc');
    } catch (tableError) {
      if (isUndefinedTableError(tableError)) {
        appSchemaLogger(tableName, tableError);
        await assertSyncSchemaReady();
      }
      throw tableError;
    }
  }

  return result;
}

function appSchemaLogger(tableName: string, error: unknown) {
  console.error(
    `[sync/pull] required table "${tableName}" is unavailable`,
    error instanceof Error ? error.message : error,
  );
}

export async function registerSyncRoutes(app: FastifyInstance) {
  app.post('/sync/push', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = syncPushSchema.parse(request.body);
    const changes = body.changes as Partial<Record<EntityType, z.infer<typeof syncEntitySchema>[]>>;
    const mappings: Awaited<ReturnType<typeof upsertEntity>>[] = [];

    await db.transaction(async (trx) => {
      for (const entityType of Object.keys(entityTableByType) as EntityType[]) {
        const items = changes[entityType] ?? [];
        for (const item of items) {
          mappings.push(await upsertEntity(trx, authUser.id, entityType, item));
        }
      }

      if (body.deviceId) {
        const now = new Date();
        await trx('sync_state')
          .insert({
            id: createId('syncstate'),
            user_id: authUser.id,
            device_id: body.deviceId,
            last_pushed_at: now,
            sync_version: 1,
            created_at: now,
            updated_at: now,
          })
          .onConflict(['user_id', 'device_id'])
          .merge({
            last_pushed_at: now,
            updated_at: now,
            sync_version: trx.raw('sync_state.sync_version + 1'),
          });
      }
    });

    return {
      ok: true,
      serverTime: new Date().toISOString(),
      mappings,
    };
  });

  app.get('/sync/pull', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const query = z.object({ since: z.string().optional(), deviceId: z.string().optional() }).parse(request.query);
    if (query.since && Number.isNaN(new Date(query.since).getTime())) {
      throw badRequest('since 时间格式不正确。');
    }

    if (query.deviceId) {
      const now = new Date();
      await db('sync_state')
        .insert({
          id: createId('syncstate'),
          user_id: authUser.id,
          device_id: query.deviceId,
          last_pulled_at: now,
          sync_version: 1,
          created_at: now,
          updated_at: now,
        })
        .onConflict(['user_id', 'device_id'])
        .merge({
          last_pulled_at: now,
          updated_at: now,
        });
    }

    return {
      serverTime: new Date().toISOString(),
      changes: await listChanges(authUser.id, query.since),
    };
  });

  app.get('/sync/status', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const states = await db('sync_state').where({ user_id: authUser.id }).orderBy('updated_at', 'desc');
    const [sessions, exerciseRecords, sets, mappings] = await Promise.all([
      db('workout_sessions').where({ user_id: authUser.id }).count<{ count: string }[]>({ count: '*' }),
      db('workout_exercise_records').where({ user_id: authUser.id }).count<{ count: string }[]>({ count: '*' }),
      db('workout_sets').where({ user_id: authUser.id }).count<{ count: string }[]>({ count: '*' }),
      db('sync_mappings').where({ user_id: authUser.id }).count<{ count: string }[]>({ count: '*' }),
    ]);
    return {
      status: 'idle',
      serverTime: new Date().toISOString(),
      syncedWorkoutSessions: Number(sessions[0]?.count ?? 0),
      syncedWorkoutExerciseRecords: Number(exerciseRecords[0]?.count ?? 0),
      syncedWorkoutSets: Number(sets[0]?.count ?? 0),
      syncMappings: Number(mappings[0]?.count ?? 0),
      devices: states,
    };
  });
}
