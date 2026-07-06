import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { createId } from '../../utils/ids';

const groupParamsSchema = z.object({
  id: z.string().min(1),
});

const roomParamsSchema = z.object({
  id: z.string().min(1),
});

const roomEventBodySchema = z.object({
  eventType: z.string().min(1).max(80),
  payload: z.record(z.string(), z.unknown()).default({}),
});

async function requireGroupMember(groupId: string, userId: string) {
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, status: 'active' })
    .whereNull('left_at')
    .first();
  if (!member) throw forbidden('You are not an active member of this group.');
  return member;
}

async function findRoomForUser(roomId: string, userId: string) {
  const room = await db('training_rooms').where({ id: roomId }).first();
  if (!room) throw notFound('Training room not found.');
  if (room.group_id) {
    await requireGroupMember(room.group_id, userId);
  } else if (room.created_by_user_id !== userId) {
    throw forbidden('You do not have access to this room.');
  }
  return room;
}

async function ensureRoomMember(roomId: string, userId: string) {
  const activeMember = await db('training_room_members')
    .where({ room_id: roomId, user_id: userId })
    .whereNull('left_at')
    .first();
  if (activeMember) return activeMember;

  const now = new Date();
  const existingMember = await db('training_room_members')
    .where({ room_id: roomId, user_id: userId })
    .orderBy('joined_at', 'desc')
    .first();

  if (existingMember) {
    await db('training_room_members').where({ id: existingMember.id }).update({
      joined_at: now,
      left_at: null,
    });
    return db('training_room_members').where({ id: existingMember.id }).first();
  }

  const row = {
    id: createId('trm'),
    room_id: roomId,
    user_id: userId,
    joined_at: now,
    left_at: null,
  };
  await db('training_room_members').insert(row);
  return row;
}

async function addRoomEvent(roomId: string, userId: string | null, eventType: string, payload: Record<string, unknown> = {}) {
  await db('training_room_events').insert({
    id: createId('trevt'),
    room_id: roomId,
    user_id: userId,
    event_type: eventType,
    payload,
    created_at: new Date(),
  });
}

async function getRoomDetails(roomId: string) {
  const room = await db('training_rooms')
    .leftJoin('groups', 'training_rooms.group_id', 'groups.id')
    .leftJoin('users as creator', 'training_rooms.created_by_user_id', 'creator.id')
    .select('training_rooms.*', 'groups.name as group_name', 'creator.nickname as creator_name')
    .where('training_rooms.id', roomId)
    .first();
  if (!room) throw notFound('Training room not found.');

  const members = await db('training_room_members')
    .leftJoin('users', 'training_room_members.user_id', 'users.id')
    .select(
      'training_room_members.*',
      'users.nickname',
      'users.avatar_url',
      'users.liftmark_id',
    )
    .where('training_room_members.room_id', roomId)
    .orderBy('training_room_members.joined_at', 'asc');

  const events = await db('training_room_events')
    .leftJoin('users', 'training_room_events.user_id', 'users.id')
    .select('training_room_events.*', 'users.nickname as user_name')
    .where('training_room_events.room_id', roomId)
    .orderBy('training_room_events.created_at', 'asc')
    .limit(300);

  return { room, members, events };
}

export async function registerTrainingRoomRoutes(app: FastifyInstance) {
  app.post('/groups/:id/training-rooms', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await requireGroupMember(params.id, authUser.id);

    const group = await db('groups').where({ id: params.id }).whereNull('deleted_at').first();
    if (!group) throw notFound('Group not found.');

    const now = new Date();
    const room = await db.transaction(async (trx) => {
      const existingRoom = await trx('training_rooms')
        .where({ group_id: params.id })
        .whereIn('status', ['reserved', 'active'])
        .whereNull('ended_at')
        .orderBy('created_at', 'desc')
        .first();

      if (existingRoom) return existingRoom;

      const roomRow = {
        id: createId('room'),
        group_id: params.id,
        created_by_user_id: authUser.id,
        status: 'active',
        started_at: now,
        ended_at: null,
        created_at: now,
        updated_at: now,
      };
      await trx('training_rooms').insert(roomRow);
      await trx('training_room_events').insert({
        id: createId('trevt'),
        room_id: roomRow.id,
        user_id: authUser.id,
        event_type: 'room_created',
        payload: { groupId: params.id },
        created_at: now,
      });
      return roomRow;
    });

    await ensureRoomMember(room.id, authUser.id);
    await addRoomEvent(room.id, authUser.id, 'member_joined', {});
    return getRoomDetails(room.id);
  });

  app.get('/groups/:id/training-rooms/current', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await requireGroupMember(params.id, authUser.id);

    const room = await db('training_rooms')
      .where({ group_id: params.id })
      .whereIn('status', ['reserved', 'active'])
      .whereNull('ended_at')
      .orderBy('created_at', 'desc')
      .first();
    if (!room) return { room: null, members: [], events: [] };
    return getRoomDetails(room.id);
  });

  app.get('/training-rooms/:id', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = roomParamsSchema.parse(request.params);
    const room = await findRoomForUser(params.id, authUser.id);
    return getRoomDetails(room.id);
  });

  app.post('/training-rooms/:id/join', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = roomParamsSchema.parse(request.params);
    const room = await findRoomForUser(params.id, authUser.id);
    if (room.ended_at || room.status === 'ended') {
      throw badRequest('Training room has ended.');
    }
    await ensureRoomMember(room.id, authUser.id);
    await addRoomEvent(room.id, authUser.id, 'member_joined', {});
    return getRoomDetails(room.id);
  });

  app.post('/training-rooms/:id/events', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = roomParamsSchema.parse(request.params);
    const body = roomEventBodySchema.parse(request.body);
    const room = await findRoomForUser(params.id, authUser.id);
    if (room.ended_at || room.status === 'ended') {
      throw badRequest('Training room has ended.');
    }
    await ensureRoomMember(room.id, authUser.id);
    await addRoomEvent(room.id, authUser.id, body.eventType, body.payload);
    return { ok: true };
  });

  app.post('/training-rooms/:id/leave', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = roomParamsSchema.parse(request.params);
    const room = await findRoomForUser(params.id, authUser.id);
    await db('training_room_members')
      .where({ room_id: room.id, user_id: authUser.id })
      .whereNull('left_at')
      .update({ left_at: new Date() });
    await addRoomEvent(room.id, authUser.id, 'member_left', {});
    return { ok: true };
  });

  app.post('/training-rooms/:id/end', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = roomParamsSchema.parse(request.params);
    const room = await findRoomForUser(params.id, authUser.id);
    const group = room.group_id ? await db('groups').where({ id: room.group_id }).first() : null;
    const canEnd = room.created_by_user_id === authUser.id || group?.owner_user_id === authUser.id || authUser.role === 'admin';
    if (!canEnd) throw forbidden('Only the creator, group owner, or admin can end this room.');

    const now = new Date();
    await db('training_rooms').where({ id: room.id }).update({
      status: 'ended',
      ended_at: now,
      updated_at: now,
    });
    await db('training_room_members').where({ room_id: room.id }).whereNull('left_at').update({ left_at: now });
    await addRoomEvent(room.id, authUser.id, 'room_ended', {});
    return getRoomDetails(room.id);
  });
}
