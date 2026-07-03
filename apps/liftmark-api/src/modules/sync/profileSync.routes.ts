import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { createId } from '../../utils/ids';
import { syncUserAvatarToMemberProfiles } from './avatarSync';

/**
 * 同步用户头像到服务器
 */
export async function registerProfileSyncRoutes(app: FastifyInstance) {
  // 同步用户头像
  app.post('/sync/avatar', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = z.object({
      avatarUrl: z.string().nullable(),
    }).parse(request.body);

    await db.transaction(async (trx) => {
      await trx('users').where({ id: authUser.id }).update({
        avatar_url: body.avatarUrl,
        updated_at: new Date(),
      });
      await syncUserAvatarToMemberProfiles(trx, authUser.id, body.avatarUrl);
    });

    return { ok: true, avatarUrl: body.avatarUrl, avatar_url: body.avatarUrl };
  });

  // 同步小组到服务器
  app.post('/sync/groups', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = z.object({
      groups: z.array(z.object({
        id: z.string(),
        name: z.string(),
        createdAt: z.string(),
      })),
    }).parse(request.body);

    const results = [];
    for (const group of body.groups) {
      // 检查小组是否已存在
      const existing = await db('groups').where({ id: group.id }).first();

      if (!existing) {
        // 创建小组
        await db('groups').insert({
          id: group.id,
          name: group.name,
          owner_user_id: authUser.id,
          membership_enabled: true,
          member_limit: 4,
          group_limit: 2,
          invite_code: createId('join').slice(0, 16),
          created_at: new Date(group.createdAt),
          updated_at: new Date(),
        });

        // 将当前用户添加为成员
        await db('group_members').insert({
          id: createId('gmem'),
          group_id: group.id,
          user_id: authUser.id,
          role: 'owner',
          status: 'active',
          joined_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      results.push({ id: group.id, synced: true });
    }

    return { ok: true, results };
  });

  // 同步成员到服务器
  app.post('/sync/members', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = z.object({
      groupId: z.string(),
      members: z.array(z.object({
        id: z.string(),
        displayName: z.string(),
        userId: z.string().optional(),
        memberType: z.enum(['local', 'real']).optional(),
        avatarUrl: z.string().nullable().optional(),
        role: z.string().optional(),
        profile: z.object({
          bodyweight: z.number().optional(),
          bench1RM: z.number().optional(),
          squat1RM: z.number().optional(),
          deadlift1RM: z.number().optional(),
          overheadPress1RM: z.number().optional(),
          pullupReferenceWeight: z.number().optional(),
          barbellIncrement: z.number().optional(),
          dumbbellIncrement: z.number().optional(),
        }).optional(),
      })),
    }).parse(request.body);

    const results = [];
    for (const member of body.members) {
      if (!member.userId) {
        results.push({ id: member.id, synced: false, skipped: true, reason: 'local_member_without_user_id' });
        continue;
      }

      if (member.userId !== authUser.id) {
        results.push({ id: member.id, synced: false, skipped: true, reason: 'other_user_member' });
        continue;
      }

      // 检查成员是否已存在
      const existing = await db('group_members')
        .where({ group_id: body.groupId, user_id: authUser.id })
        .first();

      if (!existing) {
        // 创建成员
        await db('group_members').insert({
          id: member.id,
          group_id: body.groupId,
          user_id: authUser.id,
          role: member.role || 'member',
          status: 'active',
          joined_at: new Date(),
          created_at: new Date(),
          updated_at: new Date(),
        });
      }

      // 同步成员资料
      const existingProfile = await db('member_profiles')
        .where({ user_id: authUser.id, group_id: body.groupId })
        .first();

      const profilePatch = {
        avatar_url: member.avatarUrl ?? null,
        avatar_thumb_url: member.avatarUrl ?? null,
        avatar_updated_at: member.avatarUrl ? new Date() : null,
        bodyweight: member.profile?.bodyweight ?? null,
        bench_1rm: member.profile?.bench1RM ?? null,
        squat_1rm: member.profile?.squat1RM ?? null,
        deadlift_1rm: member.profile?.deadlift1RM ?? null,
        overhead_press_1rm: member.profile?.overheadPress1RM ?? null,
        pullup_reference_weight: member.profile?.pullupReferenceWeight ?? null,
        barbell_increment: member.profile?.barbellIncrement ?? 2.5,
        dumbbell_increment: member.profile?.dumbbellIncrement ?? 2.5,
        updated_at: new Date(),
      };

      if (existingProfile) {
        await db('member_profiles')
          .where({ id: existingProfile.id })
          .update(profilePatch);
      } else {
        await db('member_profiles').insert({
          id: createId('mprof'),
          user_id: authUser.id,
          group_id: body.groupId,
          ...profilePatch,
          created_at: new Date(),
        });
      }

      results.push({ id: member.id, synced: true });
    }

    return { ok: true, results };
  });

  // 拉取小组和成员数据
  app.get('/sync/groups-pull', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);

    // 获取用户所在的所有小组
    const groupMembers = await db('group_members')
      .join('groups', 'group_members.group_id', 'groups.id')
      .where('group_members.user_id', authUser.id)
      .where('group_members.status', 'active')
      .whereNull('group_members.left_at')
      .whereNull('groups.deleted_at')
      .select('groups.*', 'group_members.role');

    const groups = [];
    for (const gm of groupMembers) {
      // 获取小组的所有成员
      const members = await db('group_members')
        .join('users', 'group_members.user_id', 'users.id')
        .leftJoin('member_profiles', function() {
          this.on('member_profiles.user_id', '=', 'users.id')
            .andOn('member_profiles.group_id', '=', 'group_members.group_id');
        })
        .where('group_members.group_id', gm.id)
        .where('group_members.status', 'active')
        .whereNull('group_members.left_at')
        .select(
          'group_members.id as member_id',
          'users.id as user_id',
          'users.nickname',
          'users.avatar_url as user_avatar_url',
          'group_members.role',
          'member_profiles.avatar_url as profile_avatar_url',
          'member_profiles.avatar_thumb_url as profile_avatar_thumb_url',
          'member_profiles.avatar_updated_at',
          'member_profiles.bodyweight',
          'member_profiles.bench_1rm',
          'member_profiles.squat_1rm',
          'member_profiles.deadlift_1rm',
          'member_profiles.overhead_press_1rm',
          'member_profiles.pullup_reference_weight',
          'member_profiles.barbell_increment',
          'member_profiles.dumbbell_increment'
        );

      groups.push({
        id: gm.id,
        name: gm.name,
        role: gm.role,
        members: members.map(m => ({
          id: m.member_id,
          userId: m.user_id,
          nickname: m.nickname,
          displayName: m.nickname,
          avatarUrl: m.profile_avatar_url ?? m.user_avatar_url,
          avatarThumbUrl: m.profile_avatar_thumb_url ?? m.profile_avatar_url ?? m.user_avatar_url,
          avatarUpdatedAt: m.avatar_updated_at,
          memberType: 'real',
          role: m.role,
          profile: {
            bodyweight: m.bodyweight,
            bench1RM: m.bench_1rm,
            squat1RM: m.squat_1rm,
            deadlift1RM: m.deadlift_1rm,
            overheadPress1RM: m.overhead_press_1rm,
            pullupReferenceWeight: m.pullup_reference_weight,
            barbellIncrement: m.barbell_increment,
            dumbbellIncrement: m.dumbbell_increment,
          },
        })),
      });
    }

    return { groups };
  });
}
