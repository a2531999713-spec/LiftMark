import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { createId } from '../../utils/ids';
import { getOrCreateMembership } from '../memberships/membership.service';

const groupParamsSchema = z.object({
  id: z.string().min(1),
});

const createGroupSchema = z.object({
  name: z.string().min(1).max(40),
});

function memberLimitForMembership(membership: any) {
  if (membership.type === 'pro' || membership.type === 'lifetime') return 4;
  return 2;
}

function groupLimitForMembership(membership: any) {
  if (membership.type === 'pro' || membership.type === 'lifetime') return Math.max(1, membership.pro_group_limit ?? 2);
  return 1;
}

async function requireGroupMember(groupId: string, userId: string) {
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, status: 'active' })
    .whereNull('left_at')
    .first();
  if (!member) throw forbidden('你不在该小组中。');
  return member;
}

function toGroupDto(group: any) {
  return {
    id: group.id,
    name: group.name,
    ownerUserId: group.owner_user_id,
    activatedByUserId: group.activated_by_user_id,
    membershipEnabled: group.membership_enabled,
    memberLimit: group.member_limit,
    groupLimit: group.group_limit,
    inviteCode: group.invite_code,
    createdAt: group.created_at,
    updatedAt: group.updated_at,
  };
}

function toGroupMemberDto(member: any) {
  return {
    id: member.id,
    groupId: member.group_id,
    userId: member.user_id,
    role: member.role,
    status: member.status,
    nickname: member.nickname,
    avatarUrl: member.avatar_url,
    joinedAt: member.joined_at,
    leftAt: member.left_at,
  };
}

export async function registerGroupRoutes(app: FastifyInstance) {
  app.post('/groups', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = createGroupSchema.parse(request.body);
    const membership = await getOrCreateMembership(authUser.id);
    const ownerGroupCount = await db('groups')
      .where({ owner_user_id: authUser.id })
      .whereNull('deleted_at')
      .count<{ count: string }[]>({ count: '*' });

    if (Number(ownerGroupCount[0]?.count ?? 0) >= groupLimitForMembership(membership)) {
      throw badRequest('当前会员状态可创建的小组数量已达上限。');
    }

    const now = new Date();
    const groupId = createId('grp');
    const group = {
      id: groupId,
      name: body.name.trim(),
      owner_user_id: authUser.id,
      activated_by_user_id: membership.type === 'free' ? null : authUser.id,
      membership_enabled: membership.type !== 'free',
      member_limit: memberLimitForMembership(membership),
      group_limit: groupLimitForMembership(membership),
      invite_code: createId('join').slice(0, 16),
      created_at: now,
      updated_at: now,
    };

    await db.transaction(async (trx) => {
      await trx('groups').insert(group);
      await trx('group_members').insert({
        id: createId('gmem'),
        group_id: groupId,
        user_id: authUser.id,
        role: 'owner',
        status: 'active',
        joined_at: now,
        created_at: now,
        updated_at: now,
      });
    });

    return { group: toGroupDto(group) };
  });

  app.get('/groups', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const groups = await db('groups')
      .join('group_members', 'groups.id', 'group_members.group_id')
      .select('groups.*', 'group_members.role')
      .where('group_members.user_id', authUser.id)
      .where('group_members.status', 'active')
      .whereNull('group_members.left_at')
      .whereNull('groups.deleted_at')
      .orderBy('groups.created_at', 'desc');
    return { groups: groups.map(toGroupDto) };
  });

  app.get('/groups/:id', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await requireGroupMember(params.id, authUser.id);
    const group = await db('groups').where({ id: params.id }).whereNull('deleted_at').first();
    if (!group) throw notFound('小组不存在。');
    return { group: toGroupDto(group) };
  });

  app.post('/groups/:id/join', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    const group = await db('groups').where({ id: params.id }).whereNull('deleted_at').first();
    if (!group) throw notFound('小组不存在。');

    const activeCount = await db('group_members')
      .where({ group_id: group.id, status: 'active' })
      .whereNull('left_at')
      .count<{ count: string }[]>({ count: '*' });
    if (Number(activeCount[0]?.count ?? 0) >= group.member_limit) {
      throw badRequest('该小组成员数量已达上限。');
    }

    const existing = await db('group_members').where({ group_id: group.id, user_id: authUser.id }).first();
    if (existing) {
      await db('group_members').where({ id: existing.id }).update({
        status: 'active',
        left_at: null,
        updated_at: new Date(),
      });
    } else {
      await db('group_members').insert({
        id: createId('gmem'),
        group_id: group.id,
        user_id: authUser.id,
        role: 'member',
        status: 'active',
        joined_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    return { ok: true };
  });

  app.post('/groups/:id/leave', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    const member = await requireGroupMember(params.id, authUser.id);
    if (member.role === 'owner') {
      throw badRequest('组长暂不能直接退出小组，请先转让或删除小组。');
    }
    await db('group_members').where({ id: member.id }).update({
      status: 'left',
      left_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true };
  });

  app.get('/groups/:id/members', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = groupParamsSchema.parse(request.params);
    await requireGroupMember(params.id, authUser.id);
    const members = await db('group_members')
      .join('users', 'group_members.user_id', 'users.id')
      .select('group_members.*', 'users.nickname', 'users.avatar_url')
      .where('group_members.group_id', params.id)
      .where('group_members.status', 'active')
      .whereNull('group_members.left_at')
      .orderBy('group_members.joined_at', 'asc');
    return { members: members.map(toGroupMemberDto) };
  });
}

export async function assertGroupMember(groupId: string, userId: string) {
  return requireGroupMember(groupId, userId);
}

