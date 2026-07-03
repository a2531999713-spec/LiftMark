import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest, forbidden, notFound } from '../../utils/errors';
import { createId } from '../../utils/ids';

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function canManageInvitations(member: any) {
  return member.role === 'owner' || member.role === 'coach';
}

async function requireInvitationManager(groupId: string, userId: string) {
  const member = await db('group_members')
    .where({ group_id: groupId, user_id: userId, status: 'active' })
    .whereNull('left_at')
    .first();
  if (!member) throw forbidden('你不在该小组中。');
  if (!canManageInvitations(member)) throw forbidden('只有组长或教练可以管理邀请码。');
  return member;
}

function toJoinedMemberDto(member: any, authUserId: string) {
  const avatarUrl = member.profile_avatar_url ?? member.user_avatar_url ?? null;
  return {
    id: member.id,
    groupId: member.group_id,
    userId: member.user_id,
    displayName: member.nickname,
    nickname: member.nickname,
    memberType: 'real',
    role: member.role,
    status: member.status,
    avatarUrl,
    isCurrentUser: member.user_id === authUserId,
    joinedAt: member.joined_at,
  };
}

export async function registerInvitationRoutes(app: FastifyInstance) {
  // 创建邀请码
  app.post('/groups/:id/invitations', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);
    const body = z.object({
      maxUses: z.number().int().min(1).max(100).optional().default(1),
      expiresInDays: z.number().int().min(1).max(365).optional(),
    }).parse(request.body ?? {});

    await requireInvitationManager(params.id, authUser.id);

    // 检查邀请码数量限制
    const existingCount = await db('group_invitations')
      .where({ group_id: params.id })
      .whereNull('disabled_at')
      .count<{ count: string }>({ count: '*' });
    if (Number(existingCount[0]?.count ?? 0) >= 5) {
      throw badRequest('每个小组最多同时存在 5 个有效邀请码。');
    }

    const code = generateCode();
    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const invitation = {
      id: createId('invit'),
      group_id: params.id,
      code,
      created_by_user_id: authUser.id,
      max_uses: body.maxUses,
      use_count: 0,
      expires_at: expiresAt,
      created_at: new Date(),
      updated_at: new Date(),
    };

    await db('group_invitations').insert(invitation);

    return {
      ok: true,
      invitation: {
        id: invitation.id,
        code: invitation.code,
        maxUses: invitation.max_uses,
        expiresAt: invitation.expires_at,
        createdAt: invitation.created_at,
      },
    };
  });

  // 获取邀请码列表
  app.get('/groups/:id/invitations', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string() }).parse(request.params);

    await requireInvitationManager(params.id, authUser.id);

    const invitations = await db('group_invitations')
      .where({ group_id: params.id })
      .whereNull('disabled_at')
      .orderBy('created_at', 'desc');

    return {
      invitations: invitations.map(inv => ({
        id: inv.id,
        code: inv.code,
        maxUses: inv.max_uses,
        useCount: inv.use_count,
        expiresAt: inv.expires_at,
        createdAt: inv.created_at,
      })),
    };
  });

  // 禁用邀请码
  app.delete('/groups/:id/invitations/:codeId', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = z.object({ id: z.string(), codeId: z.string() }).parse(request.params);

    await requireInvitationManager(params.id, authUser.id);

    const invitation = await db('group_invitations')
      .where({ id: params.codeId, group_id: params.id })
      .first();
    if (!invitation) throw notFound('邀请码不存在。');

    await db('group_invitations')
      .where({ id: params.codeId })
      .update({ disabled_at: new Date(), updated_at: new Date() });

    return { ok: true };
  });

  // 通过邀请码加入小组
  app.post('/invitations/:code/join', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const params = z.object({ code: z.string() }).parse(request.params);

    const invitation = await db('group_invitations')
      .where({ code: params.code })
      .whereNull('disabled_at')
      .first();

    if (!invitation) throw notFound('邀请码无效或已禁用。');
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      throw badRequest('邀请码已过期。');
    }
    if (invitation.use_count >= invitation.max_uses) {
      throw badRequest('邀请码使用次数已达上限。');
    }

    const group = await db('groups').where({ id: invitation.group_id }).whereNull('deleted_at').first();
    if (!group) throw notFound('小组不存在。');

    // 检查用户是否已是小组成员
    const existingMember = await db('group_members')
      .where({ group_id: invitation.group_id, user_id: authUser.id })
      .first();

    if (existingMember) {
      if (existingMember.status === 'active' && !existingMember.left_at) {
        return {
          ok: true,
          message: '你已经是该小组成员。',
          group: { id: group.id, name: group.name },
        };
      }
      const activeCount = await db('group_members')
        .where({ group_id: group.id, status: 'active' })
        .whereNull('left_at')
        .count<{ count: string }[]>({ count: '*' });
      if (Number(activeCount[0]?.count ?? 0) >= group.member_limit) {
        throw badRequest('该小组成员数量已达上限。');
      }
      // 重新加入
      await db('group_members')
        .where({ id: existingMember.id })
        .update({ status: 'active', left_at: null, updated_at: new Date() });
    } else {
      const activeCount = await db('group_members')
        .where({ group_id: group.id, status: 'active' })
        .whereNull('left_at')
        .count<{ count: string }[]>({ count: '*' });
      if (Number(activeCount[0]?.count ?? 0) >= group.member_limit) {
        throw badRequest('该小组成员数量已达上限。');
      }

      await db('group_members').insert({
        id: createId('gmem'),
        group_id: invitation.group_id,
        user_id: authUser.id,
        role: 'member',
        status: 'active',
        joined_at: new Date(),
        created_at: new Date(),
        updated_at: new Date(),
      });
    }

    // 更新邀请码使用次数
    await db('group_invitations')
      .where({ id: invitation.id })
      .update({ use_count: invitation.use_count + 1, updated_at: new Date() });

    const joinedMember = await db('group_members')
      .join('users', 'group_members.user_id', 'users.id')
      .leftJoin('member_profiles', function() {
        this.on('member_profiles.user_id', '=', 'users.id')
          .andOn('member_profiles.group_id', '=', 'group_members.group_id');
      })
      .where({ 'group_members.group_id': invitation.group_id, 'group_members.user_id': authUser.id })
      .select(
        'group_members.*',
        'users.nickname',
        'users.avatar_url as user_avatar_url',
        'member_profiles.avatar_url as profile_avatar_url',
      )
      .first();

    return {
      ok: true,
      group: { id: group.id, name: group.name },
      member: joinedMember ? toJoinedMemberDto(joinedMember, authUser.id) : null,
    };
  });
}
