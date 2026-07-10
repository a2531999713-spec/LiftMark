import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest } from '../../utils/errors';
import { createId } from '../../utils/ids';

const entityTableByType = {
  exercises: 'exercises',
  workoutSessions: 'workout_sessions',
  workoutExerciseRecords: 'workout_exercise_records',
  workoutSets: 'workout_sets',
  trainingPlans: 'training_plans',
  planCycles: 'plan_cycles',
  planCycleSummaries: 'plan_cycle_summaries',
  planPhases: 'plan_phases',
  planDays: 'plan_days',
  planExercises: 'plan_exercises',
  trainingReports: 'training_reports',
  trainingReminders: 'training_reminders',
  bodyMetrics: 'body_metrics',
  bodyMetricGoals: 'body_metric_goals',
  recoveryLogs: 'recovery_logs',
  progressionSuggestions: 'progression_suggestions',
  settings: 'settings',
} as const;

type EntityType = keyof typeof entityTableByType;
type SyncDb = typeof db | Knex.Transaction;

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
      workoutExerciseRecords: z.array(syncEntitySchema).optional(),
      workoutSets: z.array(syncEntitySchema).optional(),
      trainingPlans: z.array(syncEntitySchema).optional(),
      planCycles: z.array(syncEntitySchema).optional(),
      planCycleSummaries: z.array(syncEntitySchema).optional(),
      planPhases: z.array(syncEntitySchema).optional(),
      planDays: z.array(syncEntitySchema).optional(),
      planExercises: z.array(syncEntitySchema).optional(),
      trainingReports: z.array(syncEntitySchema).optional(),
      trainingReminders: z.array(syncEntitySchema).optional(),
      bodyMetrics: z.array(syncEntitySchema).optional(),
      bodyMetricGoals: z.array(syncEntitySchema).optional(),
      recoveryLogs: z.array(syncEntitySchema).optional(),
      progressionSuggestions: z.array(syncEntitySchema).optional(),
      settings: z.array(syncEntitySchema).optional(),
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
      // 表可能尚未通过迁移创建（如迁移 010 未运行），跳过而非整体 500
      console.warn(`[sync/pull] table "${tableName}" query failed, returning empty:`, tableError instanceof Error ? tableError.message : tableError);
      result[entityType] = [];
    }
  }

  return result;
}

export async function registerSyncRoutes(app: FastifyInstance) {
  app.post('/sync/push', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = pushSchema.parse(request.body);
    const mappings: Awaited<ReturnType<typeof upsertEntity>>[] = [];

    await db.transaction(async (trx) => {
      for (const entityType of Object.keys(entityTableByType) as EntityType[]) {
        const items = body.changes[entityType] ?? [];
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
