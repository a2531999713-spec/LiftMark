import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { createId } from '../../utils/ids';
import { assertGroupMember } from '../groups/groups.routes';

const groupParamsSchema = z.object({
  id: z.string().min(1),
});

const uploadSchema = z.object({
  sessions: z.array(z.record(z.string(), z.unknown())).optional(),
  sets: z.array(z.record(z.string(), z.unknown())).optional(),
});

function stringValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

function numberValue(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim()) return Number(value);
  }
  return null;
}

async function upsertGroupSession(userId: string, groupId: string, payload: Record<string, unknown>) {
  const clientId = stringValue(payload, ['clientId', 'id', 'localId']) ?? createId('client');
  const existing = await db('workout_sessions').where({ user_id: userId, client_id: clientId }).first();
  const serverId = existing?.id ?? createId('ws');
  const now = new Date();
  const row = {
    id: serverId,
    user_id: userId,
    group_id: groupId,
    client_id: clientId,
    title: stringValue(payload, ['title', 'name']) ?? existing?.title ?? '训练记录',
    status: stringValue(payload, ['status']) ?? existing?.status ?? 'completed',
    client_updated_at: stringValue(payload, ['updatedAt', 'updated_at']) ? new Date(String(stringValue(payload, ['updatedAt', 'updated_at']))) : now,
    deleted_at: stringValue(payload, ['deletedAt', 'deleted_at']) ? new Date(String(stringValue(payload, ['deletedAt', 'deleted_at']))) : null,
    payload,
    sync_version: (existing?.sync_version ?? 0) + 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  if (existing) {
    await db('workout_sessions').where({ id: serverId }).update(row);
  } else {
    await db('workout_sessions').insert(row);
  }
  return serverId;
}

async function upsertGroupSet(userId: string, groupId: string, payload: Record<string, unknown>) {
  const clientId = stringValue(payload, ['clientId', 'id', 'localId']) ?? createId('client');
  const existing = await db('workout_sets').where({ user_id: userId, client_id: clientId }).first();
  const serverId = existing?.id ?? createId('wset');
  const now = new Date();
  const row = {
    id: serverId,
    user_id: userId,
    group_id: groupId,
    client_id: clientId,
    parent_server_id: stringValue(payload, ['sessionServerId', 'sessionId', 'session_id']),
    member_client_id: stringValue(payload, ['memberId', 'member_id', 'memberClientId']),
    exercise_client_id: stringValue(payload, ['exerciseId', 'exercise_id', 'exerciseClientId']),
    actual_weight: numberValue(payload, ['actualWeight', 'actual_weight', 'weight']),
    actual_reps: numberValue(payload, ['actualReps', 'actual_reps', 'reps']),
    status: stringValue(payload, ['status']) ?? 'completed',
    client_updated_at: stringValue(payload, ['updatedAt', 'updated_at']) ? new Date(String(stringValue(payload, ['updatedAt', 'updated_at']))) : now,
    payload,
    sync_version: (existing?.sync_version ?? 0) + 1,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  if (existing) {
    await db('workout_sets').where({ id: serverId }).update(row);
  } else {
    await db('workout_sets').insert(row);
  }
  return serverId;
}

export async function registerWorkoutRoutes(app: FastifyInstance) {
  app.post('/groups/:id/workouts/upload', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await assertGroupMember(params.id, authUser.id);
    const body = uploadSchema.parse(request.body);

    const sessionIds = [];
    const setIds = [];
    for (const session of body.sessions ?? []) {
      sessionIds.push(await upsertGroupSession(authUser.id, params.id, session));
    }
    for (const set of body.sets ?? []) {
      setIds.push(await upsertGroupSet(authUser.id, params.id, set));
    }

    return { ok: true, sessionIds, setIds };
  });

  app.get('/groups/:id/workouts', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await assertGroupMember(params.id, authUser.id);
    const workouts = await db('workout_sessions')
      .where({ group_id: params.id })
      .whereNull('deleted_at')
      .orderBy('client_updated_at', 'desc')
      .limit(100);
    return { workouts };
  });

  app.get('/groups/:id/stats/overview', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await assertGroupMember(params.id, authUser.id);
    const sessionCount = await db('workout_sessions').where({ group_id: params.id }).whereNull('deleted_at').count<{ count: string }[]>({ count: '*' });
    const volume = await db('workout_sets')
      .where({ group_id: params.id })
      .sum<{ total_volume: string }[]>({ total_volume: db.raw('COALESCE(actual_weight, 0) * COALESCE(actual_reps, 0)') });
    return {
      completedWorkouts: Number(sessionCount[0]?.count ?? 0),
      totalVolume: Number(volume[0]?.total_volume ?? 0),
    };
  });

  app.get('/groups/:id/stats/members', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await assertGroupMember(params.id, authUser.id);
    const rows = await db('workout_sets')
      .select('member_client_id')
      .where({ group_id: params.id })
      .groupBy('member_client_id')
      .count<{ member_client_id: string; set_count: string }[]>({ set_count: '*' })
      .sum({ total_volume: db.raw('COALESCE(actual_weight, 0) * COALESCE(actual_reps, 0)') });
    return { members: rows };
  });

  app.get('/groups/:id/stats/exercises', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await assertGroupMember(params.id, authUser.id);
    const rows = await db('workout_sets')
      .select('exercise_client_id')
      .where({ group_id: params.id })
      .groupBy('exercise_client_id')
      .count<{ exercise_client_id: string; set_count: string }[]>({ set_count: '*' })
      .sum({ total_volume: db.raw('COALESCE(actual_weight, 0) * COALESCE(actual_reps, 0)') });
    return { exercises: rows };
  });

  app.get('/groups/:id/stats/compare', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await assertGroupMember(params.id, authUser.id);
    const rows = await db('workout_sets')
      .select('member_client_id', 'exercise_client_id')
      .where({ group_id: params.id })
      .groupBy('member_client_id', 'exercise_client_id')
      .count<{ member_client_id: string; exercise_client_id: string; set_count: string }[]>({ set_count: '*' })
      .sum({ total_volume: db.raw('COALESCE(actual_weight, 0) * COALESCE(actual_reps, 0)') });
    return { compare: rows };
  });
}

