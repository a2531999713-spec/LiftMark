import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest } from '../../utils/errors';
import { createId } from '../../utils/ids';

const entityTableByType = {
  exercises: 'exercises',
  workoutSessions: 'workout_sessions',
  workoutSets: 'workout_sets',
  trainingPlans: 'training_plans',
  planDays: 'plan_days',
  planExercises: 'plan_exercises',
} as const;

type EntityType = keyof typeof entityTableByType;

const syncEntitySchema = z.object({
  clientId: z.string().min(1),
  serverId: z.string().optional(),
  groupId: z.string().optional().nullable(),
  parentServerId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const pushSchema = z.object({
  deviceId: z.string().min(1).optional(),
  changes: z.object({
    exercises: z.array(syncEntitySchema).optional(),
    workoutSessions: z.array(syncEntitySchema).optional(),
    workoutSets: z.array(syncEntitySchema).optional(),
    trainingPlans: z.array(syncEntitySchema).optional(),
    planDays: z.array(syncEntitySchema).optional(),
    planExercises: z.array(syncEntitySchema).optional(),
  }),
});

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

async function upsertEntity(userId: string, entityType: EntityType, item: z.infer<typeof syncEntitySchema>) {
  const tableName = entityTableByType[entityType];
  const payload = item.payload ?? {};
  const clientUpdatedAt = item.updatedAt ? new Date(item.updatedAt) : new Date();
  const existing = await db(tableName).where({ user_id: userId, client_id: item.clientId }).first();

  if (existing && new Date(existing.client_updated_at ?? existing.updated_at) > clientUpdatedAt) {
    return {
      clientId: item.clientId,
      serverId: existing.id,
      skipped: true,
      entityType,
    };
  }

  const serverId = existing?.id ?? item.serverId ?? createId(entityType.toLowerCase());
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
    await db(tableName).where({ id: serverId }).update(row);
  } else {
    await db(tableName).insert(row);
  }

  await db('sync_mappings')
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
  const sinceDate = since ? new Date(since) : new Date(0);
  const result: Record<EntityType, unknown[]> = {
    exercises: [],
    workoutSessions: [],
    workoutSets: [],
    trainingPlans: [],
    planDays: [],
    planExercises: [],
  };

  for (const [entityType, tableName] of Object.entries(entityTableByType) as [EntityType, string][]) {
    result[entityType] = await db(tableName)
      .select('*')
      .where({ user_id: userId })
      .where('updated_at', '>', sinceDate)
      .orderBy('updated_at', 'asc');
  }

  return result;
}

export async function registerSyncRoutes(app: FastifyInstance) {
  app.post('/sync/push', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = pushSchema.parse(request.body);
    const mappings = [];

    for (const entityType of Object.keys(entityTableByType) as EntityType[]) {
      const items = body.changes[entityType] ?? [];
      for (const item of items) {
        mappings.push(await upsertEntity(authUser.id, entityType, item));
      }
    }

    if (body.deviceId) {
      const now = new Date();
      await db('sync_state')
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
          sync_version: db.raw('sync_state.sync_version + 1'),
        });
    }

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
    const sessions = await db('workout_sessions').where({ user_id: authUser.id }).count<{ count: string }[]>({ count: '*' });
    return {
      status: 'idle',
      serverTime: new Date().toISOString(),
      syncedWorkoutSessions: Number(sessions[0]?.count ?? 0),
      devices: states,
    };
  });
}

