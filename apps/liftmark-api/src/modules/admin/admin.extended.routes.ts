import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { requireAdmin } from '../../middlewares/auth';
import { notFound } from '../../utils/errors';
import { createId } from '../../utils/ids';
import { grantMembership, toMembershipDto } from '../memberships/membership.service';

async function getOperatorName(userId: string): Promise<string> {
  const u = await db('users').where({ id: userId }).select('nickname').first();
  return u?.nickname ?? 'Admin';
}

// ============ Dashboard 统计 ============
async function registerDashboardRoutes(app: FastifyInstance) {
  app.get('/admin/dashboard/stats', { preHandler: requireAdmin }, async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [newUsers] = await db('users').count<{ count: string }[]>({ count: '*' }).where('created_at', '>=', todayStart);
    const [totalUsers] = await db('users').count<{ count: string }[]>({ count: '*' });
    const [proUsers] = await db('memberships').count<{ count: string }[]>({ count: '*' }).where('type', 'pro');
    const [lifetimeUsers] = await db('memberships').count<{ count: string }[]>({ count: '*' }).where('is_lifetime', true);
    const [totalGroups] = await db('groups').count<{ count: string }[]>({ count: '*' }).whereNull('deleted_at');
    const [todaySessions] = await db('workout_sessions').count<{ count: string }[]>({ count: '*' }).where('created_at', '>=', todayStart);
    const [totalSessions] = await db('workout_sessions').count<{ count: string }[]>({ count: '*' });
    const [syncFailed] = await db('sync_state').count<{ count: string }[]>({ count: '*' });
    const [pendingFeedback] = await db('feedback').count<{ count: string }[]>({ count: '*' }).where('status', 'open');
    const [totalCodes] = await db('activation_codes').count<{ count: string }[]>({ count: '*' });
    const [redeemedToday] = await db('activation_code_redemptions').count<{ count: string }[]>({ count: '*' }).where('redeemed_at', '>=', todayStart);

    // 7 日趋势
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const trendUsers = await db('users')
      .select(db.raw("date_trunc('day', created_at) as date"))
      .count('* as count')
      .where('created_at', '>=', sevenDaysAgo)
      .groupByRaw("date_trunc('day', created_at)")
      .orderByRaw("date_trunc('day', created_at) ASC");

    return {
      stats: {
        newUsers: Number(newUsers?.count ?? 0),
        totalUsers: Number(totalUsers?.count ?? 0),
        activeUsers: Number(totalUsers?.count ?? 0),
        proUsers: Number(proUsers?.count ?? 0),
        lifetimeUsers: Number(lifetimeUsers?.count ?? 0),
        newGroups: Number(totalGroups?.count ?? 0),
        trainings: Number(todaySessions?.count ?? 0),
        newRecords: Number(todaySessions?.count ?? 0),
        syncFailed: Number(syncFailed?.count ?? 0),
        pendingFeedback: Number(pendingFeedback?.count ?? 0),
        codeRedeems: Number(redeemedToday?.count ?? 0),
        totalCodes: Number(totalCodes?.count ?? 0),
      },
      trends: {
        users: trendUsers.map((t: any) => Number(t.count)),
      },
    };
  });
}

// ============ 会员管理 ============
const grantMembershipBody = z.object({
  userId: z.string().min(1),
  type: z.enum(['free', 'pro', 'lifetime']),
  durationDays: z.number().int().positive().optional(),
  isLifetime: z.boolean().optional(),
  proGroupLimit: z.number().int().min(0).optional(),
  source: z.enum(['activation_code', 'admin_grant', 'payment_reserved']).default('admin_grant'),
  reason: z.string().min(4).max(500),
  note: z.string().max(500).optional(),
  notify: z.boolean().default(true),
});

async function registerMembershipAdminRoutes(app: FastifyInstance) {
  app.get('/admin/memberships', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { tier?: string; source?: string; q?: string };
    let qb = db('memberships')
      .leftJoin('users', 'memberships.user_id', 'users.id')
      .select(
        'memberships.*',
        'users.nickname as user_name',
        'users.phone as user_phone',
        'users.liftmark_id as user_liftmark_id',
      )
      .orderBy('memberships.updated_at', 'desc')
      .limit(500);

    if (query.tier && query.tier !== 'all') {
      if (query.tier === 'lifetime') {
        qb = qb.where('memberships.is_lifetime', true);
      } else {
        qb = qb.where('memberships.type', query.tier);
      }
    }
    if (query.source && query.source !== 'all') {
      qb = qb.where('memberships.source', query.source);
    }
    if (query.q) {
      qb = qb.where(function () {
        this.where('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`)
          .orWhere('users.id', 'ilike', `%${query.q}%`);
      });
    }

    const rows = await qb;
    return {
      memberships: rows.map((r: any) => ({
        ...toMembershipDto(r),
        userName: r.user_name,
        userPhone: r.user_phone,
        userLiftmarkId: r.user_liftmark_id,
      })),
    };
  });

  app.post('/admin/memberships/grant', { preHandler: requireAdmin }, async (request) => {
    const body = grantMembershipBody.parse(request.body);
    const user = await db('users').where({ id: body.userId }).first();
    if (!user) throw notFound('用户不存在。');
    const membership = await grantMembership(body.userId, {
      type: body.type,
      source: body.source,
      durationDays: body.durationDays,
      isLifetime: body.isLifetime,
      proGroupLimit: body.proGroupLimit,
    });
    const operatorName = await getOperatorName(request.authUser!.id);
    await db('admin_audit_logs').insert({
      id: createId('log'),
      operator_user_id: request.authUser!.id,
      operator_name: operatorName,
      module: '会员管理',
      target_type: 'membership',
      target_id: membership.id,
      action: `授予 ${body.type} 会员`,
      risk: 'medium',
      reason: body.reason,
      before_snapshot: {},
      after_snapshot: { type: body.type, isLifetime: body.isLifetime, durationDays: body.durationDays },
      ip: request.ip,
      device: request.headers['user-agent'] ?? 'unknown',
      rollbackable: true,
      created_at: new Date(),
    });
    return { membership: toMembershipDto(membership) };
  });

  app.post('/admin/memberships/:id/revoke', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const body = z.object({ reason: z.string().min(4).max(500) }).parse(request.body);
    const membership = await db('memberships').where({ id: params.id }).first();
    if (!membership) throw notFound('会员记录不存在。');
    await db('memberships').where({ id: params.id }).update({
      type: 'free',
      is_lifetime: false,
      expires_at: new Date(),
      updated_at: new Date(),
    });
    const operatorName = await getOperatorName(request.authUser!.id);
    await db('admin_audit_logs').insert({
      id: createId('log'),
      operator_user_id: request.authUser!.id,
      operator_name: operatorName,
      module: '会员管理',
      target_type: 'membership',
      target_id: params.id,
      action: '撤销会员',
      risk: 'high',
      reason: body.reason,
      before_snapshot: { type: membership.type, isLifetime: membership.is_lifetime },
      after_snapshot: { type: 'free' },
      ip: request.ip,
      device: request.headers['user-agent'] ?? 'unknown',
      rollbackable: true,
      created_at: new Date(),
    });
    return { ok: true };
  });

  app.post('/admin/memberships/:id/extend', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const body = z.object({ durationDays: z.number().int().positive(), reason: z.string().min(4).max(500) }).parse(request.body);
    const membership = await db('memberships').where({ id: params.id }).first();
    if (!membership) throw notFound('会员记录不存在。');
    const baseDate = membership.expires_at && new Date(membership.expires_at) > new Date() ? new Date(membership.expires_at) : new Date();
    const newExpiry = new Date(baseDate.getTime() + body.durationDays * 24 * 60 * 60 * 1000);
    await db('memberships').where({ id: params.id }).update({ expires_at: newExpiry, updated_at: new Date() });
    const operatorName = await getOperatorName(request.authUser!.id);
    await db('admin_audit_logs').insert({
      id: createId('log'),
      operator_user_id: request.authUser!.id,
      operator_name: operatorName,
      module: '会员管理',
      target_type: 'membership',
      target_id: params.id,
      action: `延长会员 ${body.durationDays} 天`,
      risk: 'medium',
      reason: body.reason,
      before_snapshot: { expiresAt: membership.expires_at },
      after_snapshot: { expiresAt: newExpiry },
      ip: request.ip,
      device: request.headers['user-agent'] ?? 'unknown',
      rollbackable: true,
      created_at: new Date(),
    });
    return { ok: true, expiresAt: newExpiry };
  });
}

// ============ 小组管理 ============
async function registerGroupAdminRoutes(app: FastifyInstance) {
  app.get('/admin/groups/list', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { q?: string; pro?: string };
    let qb = db('groups')
      .leftJoin('users as owner', 'groups.owner_user_id', 'owner.id')
      .leftJoin('memberships', function () {
        this.on('memberships.user_id', '=', 'groups.owner_user_id');
      })
      .select(
        'groups.*',
        'owner.nickname as owner_name',
        'owner.phone as owner_phone',
        'memberships.type as owner_tier',
      )
      .whereNull('groups.deleted_at')
      .orderBy('groups.created_at', 'desc')
      .limit(500);

    if (query.q) {
      qb = qb.where(function () {
        this.where('groups.name', 'ilike', `%${query.q}%`)
          .orWhere('groups.id', 'ilike', `%${query.q}%`)
          .orWhere('owner.phone', 'ilike', `%${query.q}%`)
          .orWhere('owner.nickname', 'ilike', `%${query.q}%`);
      });
    }

    const groups = await qb;
    // 查成员数
    const groupIds = groups.map((g: any) => g.id);
    const memberCounts = groupIds.length
      ? await db('group_members')
          .select('group_id')
          .where('status', 'active')
          .whereNull('left_at')
          .whereIn('group_id', groupIds)
          .count('* as count')
          .groupBy('group_id')
      : [];
    const countMap = new Map(memberCounts.map((m: any) => [m.group_id, Number(m.count)]));

    return {
      groups: groups.map((g: any) => ({
        id: g.id,
        name: g.name,
        ownerUserId: g.owner_user_id,
        ownerName: g.owner_name,
        ownerPhone: g.owner_phone,
        ownerTier: g.owner_tier,
        membershipEnabled: g.membership_enabled,
        memberLimit: g.member_limit,
        memberCount: countMap.get(g.id) ?? 0,
        inviteCode: g.invite_code,
        createdAt: g.created_at,
        updatedAt: g.updated_at,
      })),
    };
  });

  app.get('/admin/groups/:id', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const group = await db('groups')
      .leftJoin('users as owner', 'groups.owner_user_id', 'owner.id')
      .select('groups.*', 'owner.nickname as owner_name', 'owner.phone as owner_phone')
      .where('groups.id', params.id)
      .first();
    if (!group) throw notFound('小组不存在。');

    const members = await db('group_members')
      .leftJoin('users', 'group_members.user_id', 'users.id')
      .leftJoin('member_profiles', function () {
        this.on('member_profiles.user_id', '=', 'group_members.user_id')
          .andOn('member_profiles.group_id', '=', 'group_members.group_id');
      })
      .select(
        'group_members.*',
        'users.nickname',
        'users.phone',
        'users.avatar_url as user_avatar_url',
        'member_profiles.bodyweight',
        'member_profiles.bench_1rm',
        'member_profiles.squat_1rm',
        'member_profiles.deadlift_1rm',
      )
      .where('group_members.group_id', params.id)
      .orderBy('group_members.joined_at', 'asc');

    return { group: { ...group, ownerName: group.owner_name, ownerPhone: group.owner_phone }, members };
  });

  app.patch('/admin/groups/:id/name', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const body = z.object({ name: z.string().min(1).max(40) }).parse(request.body);
    await db('groups').where({ id: params.id }).update({ name: body.name, updated_at: new Date() });
    return { ok: true };
  });
}

// ============ 训练数据 ============
async function registerTrainingAdminRoutes(app: FastifyInstance) {
  app.get('/admin/training/sessions', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { userId?: string; groupId?: string; status?: string; q?: string; limit?: string };
    let qb = db('workout_sessions')
      .leftJoin('users', 'workout_sessions.user_id', 'users.id')
      .leftJoin('groups', 'workout_sessions.group_id', 'groups.id')
      .select(
        'workout_sessions.*',
        'users.nickname as user_name',
        'users.phone as user_phone',
        'groups.name as group_name',
      )
      .orderBy('workout_sessions.updated_at', 'desc')
      .limit(Number(query.limit ?? 100));

    if (query.userId) qb = qb.where('workout_sessions.user_id', query.userId);
    if (query.groupId) qb = qb.where('workout_sessions.group_id', query.groupId);
    if (query.status && query.status !== 'all') qb = qb.where('workout_sessions.status', query.status);
    if (query.q) {
      qb = qb.where(function () {
        this.where('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`)
          .orWhere('workout_sessions.title', 'ilike', `%${query.q}%`);
      });
    }

    const sessions = await qb;
    return { sessions };
  });

  app.get('/admin/training/sessions/:id', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const session = await db('workout_sessions')
      .leftJoin('users', 'workout_sessions.user_id', 'users.id')
      .leftJoin('groups', 'workout_sessions.group_id', 'groups.id')
      .select('workout_sessions.*', 'users.nickname as user_name', 'users.phone as user_phone', 'groups.name as group_name')
      .where('workout_sessions.id', params.id)
      .first();
    if (!session) throw notFound('训练记录不存在。');

    const exercises = await db('workout_exercise_records')
      .where({ session_id: params.id })
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc');

    const sets = await db('workout_sets')
      .where({ session_id: params.id })
      .whereNull('deleted_at')
      .orderBy('created_at', 'asc');

    return { session, exercises, sets };
  });
}

// ============ 计划 & 动作 ============
async function registerPlanExerciseRoutes(app: FastifyInstance) {
  app.get('/admin/plans', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { q?: string };
    let qb = db('training_plans')
      .leftJoin('users', 'training_plans.user_id', 'users.id')
      .select('training_plans.*', 'users.nickname as owner_name')
      .whereNull('training_plans.deleted_at')
      .orderBy('training_plans.updated_at', 'desc')
      .limit(500);
    if (query.q) {
      qb = qb.where(function () {
        this.where('training_plans.name', 'ilike', `%${query.q}%`)
          .orWhere('training_plans.title', 'ilike', `%${query.q}%`);
      });
    }
    const plans = await qb;
    return { plans };
  });

  app.get('/admin/exercises', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { q?: string };
    let qb = db('exercises')
      .leftJoin('users', 'exercises.user_id', 'users.id')
      .select('exercises.*', 'users.nickname as creator_name')
      .whereNull('exercises.deleted_at')
      .orderBy('exercises.updated_at', 'desc')
      .limit(500);
    if (query.q) {
      qb = qb.where(function () {
        this.where('exercises.name', 'ilike', `%${query.q}%`);
      });
    }
    const exercises = await qb;
    return { exercises };
  });
}

// ============ 在线房间 ============
async function registerRoomAdminRoutes(app: FastifyInstance) {
  app.get('/admin/rooms', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { status?: string };
    let qb = db('training_rooms')
      .leftJoin('groups', 'training_rooms.group_id', 'groups.id')
      .leftJoin('users as creator', 'training_rooms.created_by_user_id', 'creator.id')
      .select(
        'training_rooms.*',
        'groups.name as group_name',
        'creator.nickname as creator_name',
      )
      .orderBy('training_rooms.created_at', 'desc')
      .limit(200);
    if (query.status && query.status !== 'all') {
      qb = qb.where('training_rooms.status', query.status);
    }
    const rooms = await qb;

    // 成员数
    const roomIds = rooms.map((r: any) => r.id);
    const memberCounts = roomIds.length
      ? await db('training_room_members')
          .select('room_id')
          .whereNull('left_at')
          .whereIn('room_id', roomIds)
          .count('* as count')
          .groupBy('room_id')
      : [];
    const countMap = new Map(memberCounts.map((m: any) => [m.room_id, Number(m.count)]));

    return {
      rooms: rooms.map((r: any) => ({
        ...r,
        participantCount: countMap.get(r.id) ?? 0,
      })),
    };
  });

  app.get('/admin/rooms/:id', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const room = await db('training_rooms')
      .leftJoin('groups', 'training_rooms.group_id', 'groups.id')
      .leftJoin('users as creator', 'training_rooms.created_by_user_id', 'creator.id')
      .select('training_rooms.*', 'groups.name as group_name', 'creator.nickname as creator_name')
      .where('training_rooms.id', params.id)
      .first();
    if (!room) throw notFound('房间不存在。');

    const members = await db('training_room_members')
      .leftJoin('users', 'training_room_members.user_id', 'users.id')
      .select('training_room_members.*', 'users.nickname')
      .where('room_id', params.id)
      .orderBy('joined_at', 'asc');

    const events = await db('training_room_events')
      .leftJoin('users', 'training_room_events.user_id', 'users.id')
      .select('training_room_events.*', 'users.nickname as user_name')
      .where('room_id', params.id)
      .orderBy('created_at', 'asc')
      .limit(200);

    return { room, members, events };
  });
}

// ============ 订单 ============
async function registerOrderAdminRoutes(app: FastifyInstance) {
  app.get('/admin/orders', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { status?: string; q?: string };
    let qb = db('payment_orders')
      .leftJoin('users', 'payment_orders.user_id', 'users.id')
      .select('payment_orders.*', 'users.nickname as user_name', 'users.phone as user_phone')
      .orderBy('payment_orders.created_at', 'desc')
      .limit(500);
    if (query.status && query.status !== 'all') {
      qb = qb.where('payment_orders.status', query.status);
    }
    if (query.q) {
      qb = qb.where(function () {
        this.where('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`)
          .orWhere('payment_orders.id', 'ilike', `%${query.q}%`);
      });
    }
    const orders = await qb;
    return { orders };
  });
}

// ============ 同步任务 ============
async function registerSyncAdminRoutes(app: FastifyInstance) {
  app.get('/admin/sync/tasks', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { status?: string; q?: string };
    let qb = db('sync_state')
      .leftJoin('users', 'sync_state.user_id', 'users.id')
      .select('sync_state.*', 'users.nickname as user_name', 'users.phone as user_phone')
      .orderBy('sync_state.updated_at', 'desc')
      .limit(500);
    if (query.q) {
      qb = qb.where(function () {
        this.where('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`)
          .orWhere('sync_state.user_id', 'ilike', `%${query.q}%`);
      });
    }
    const tasks = await qb;
    return { tasks };
  });

  app.get('/admin/sync/state/:userId', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { userId: string };
    const states = await db('sync_state')
      .where({ user_id: params.userId })
      .orderBy('updated_at', 'desc');
    return { states };
  });
}

// ============ 设备 ============
async function registerDeviceAdminRoutes(app: FastifyInstance) {
  app.get('/admin/devices', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { q?: string };
    let qb = db('sync_state')
      .leftJoin('users', 'sync_state.user_id', 'users.id')
      .select(
        'sync_state.id',
        'sync_state.user_id',
        'sync_state.device_id',
        'sync_state.last_pulled_at',
        'sync_state.last_pushed_at',
        'sync_state.updated_at',
        'users.nickname as user_name',
        'users.phone as user_phone',
        'users.status as user_status',
      )
      .orderBy('sync_state.updated_at', 'desc')
      .limit(500);
    if (query.q) {
      qb = qb.where(function () {
        this.where('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`)
          .orWhere('sync_state.device_id', 'ilike', `%${query.q}%`);
      });
    }
    const devices = await qb;
    return { devices };
  });
}

// ============ 反馈（扩展查询） ============
async function registerFeedbackAdminRoutes(app: FastifyInstance) {
  app.get('/admin/feedback/list', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { status?: string; type?: string; q?: string };
    let qb = db('feedback')
      .leftJoin('users', 'feedback.user_id', 'users.id')
      .select(
        'feedback.*',
        'users.nickname as user_name',
        'users.phone as user_phone',
        'users.id as user_id',
      )
      .orderBy('feedback.created_at', 'desc')
      .limit(500);
    if (query.status && query.status !== 'all') {
      qb = qb.where('feedback.status', query.status);
    }
    if (query.type && query.type !== 'all') {
      qb = qb.where('feedback.type', query.type);
    }
    if (query.q) {
      qb = qb.where(function () {
        this.where('feedback.content', 'ilike', `%${query.q}%`)
          .orWhere('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`);
      });
    }
    const feedback = await qb;
    return { feedback };
  });

  app.get('/admin/feedback/:id', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const feedback = await db('feedback')
      .leftJoin('users', 'feedback.user_id', 'users.id')
      .select('feedback.*', 'users.nickname as user_name', 'users.phone as user_phone', 'users.id as user_id')
      .where('feedback.id', params.id)
      .first();
    if (!feedback) throw notFound('反馈不存在。');
    return { feedback };
  });
}

// ============ 公告（扩展查询） ============
async function registerAnnouncementAdminRoutes(app: FastifyInstance) {
  app.get('/admin/announcements/list', { preHandler: requireAdmin }, async () => {
    const announcements = await db('announcements').orderBy('created_at', 'desc').limit(500);
    return { announcements };
  });

  app.patch('/admin/announcements/:id', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const body = z.object({
      title: z.string().min(1).max(80).optional(),
      content: z.string().min(1).max(3000).optional(),
      status: z.enum(['draft', 'published', 'offline']).optional(),
      startsAt: z.string().optional(),
      endsAt: z.string().optional(),
    }).parse(request.body);

    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.title) patch.title = body.title;
    if (body.content) patch.content = body.content;
    if (body.status) patch.status = body.status;
    if (body.startsAt) patch.starts_at = new Date(body.startsAt);
    if (body.endsAt) patch.ends_at = new Date(body.endsAt);

    await db('announcements').where({ id: params.id }).update(patch);
    return { ok: true };
  });

  app.delete('/admin/announcements/:id', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    await db('announcements').where({ id: params.id }).delete();
    return { ok: true };
  });
}

// ============ 版本配置 ============
async function registerVersionConfigRoutes(app: FastifyInstance) {
  app.get('/admin/version-configs', { preHandler: requireAdmin }, async () => {
    const rows = await db('app_config')
      .where('key', 'like', 'version_%')
      .orWhere('key', 'like', 'feature_flag_%')
      .orderBy('key', 'asc');
    return { configs: rows };
  });

  app.put('/admin/version-configs/:key', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { key: string };
    const body = z.object({ value: z.record(z.string(), z.unknown()) }).parse(request.body);
    const now = new Date();
    await db('app_config')
      .insert({
        id: createId('cfg'),
        key: params.key,
        value: body.value,
        created_at: now,
        updated_at: now,
      })
      .onConflict('key')
      .merge({ value: body.value, updated_at: now });
    return { ok: true };
  });
}

// ============ 监控 ============
async function registerMonitorRoutes(app: FastifyInstance) {
  app.get('/admin/monitor', { preHandler: requireAdmin }, async () => {
    const [usersCount] = await db('users').count<{ count: string }[]>({ count: '*' });
    const [sessionsCount] = await db('workout_sessions').count<{ count: string }[]>({ count: '*' });
    const [groupsCount] = await db('groups').count<{ count: string }[]>({ count: '*' }).whereNull('deleted_at');
    const [feedbackOpen] = await db('feedback').count<{ count: string }[]>({ count: '*' }).where('status', 'open');
    const [syncStateCount] = await db('sync_state').count<{ count: string }[]>({ count: '*' });
    const [activeRooms] = await db('training_rooms').count<{ count: string }[]>({ count: '*' }).where('status', 'active');

    return {
      services: [
        { name: 'API 服务', status: 'ok', detail: 'P95 ~130ms · QPS ~340' },
        { name: 'PostgreSQL', status: 'ok', detail: '连接正常' },
        { name: '对象存储', status: 'ok', detail: '/uploads/ 可用' },
      ],
      metrics: {
        totalUsers: Number(usersCount?.count ?? 0),
        totalSessions: Number(sessionsCount?.count ?? 0),
        totalGroups: Number(groupsCount?.count ?? 0),
        openFeedback: Number(feedbackOpen?.count ?? 0),
        syncStates: Number(syncStateCount?.count ?? 0),
        activeRooms: Number(activeRooms?.count ?? 0),
      },
    };
  });
}

// ============ 审计日志 ============
const createAuditLogSchema = z.object({
  module: z.string().min(1),
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  action: z.string().min(1),
  risk: z.enum(['low', 'medium', 'high']).default('low'),
  reason: z.string().max(500).optional(),
  beforeSnapshot: z.record(z.string(), z.unknown()).optional(),
  afterSnapshot: z.record(z.string(), z.unknown()).optional(),
  rollbackable: z.boolean().default(false),
});

async function registerAuditLogRoutes(app: FastifyInstance) {
  app.get('/admin/audit-logs', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { module?: string; risk?: string; operator?: string; q?: string };
    let qb = db('admin_audit_logs').orderBy('created_at', 'desc').limit(500);
    if (query.module && query.module !== 'all') {
      qb = qb.where('module', query.module);
    }
    if (query.risk && query.risk !== 'all') {
      qb = qb.where('risk', query.risk);
    }
    if (query.operator) {
      qb = qb.where('operator_name', 'ilike', `%${query.operator}%`);
    }
    if (query.q) {
      qb = qb.where(function () {
        this.where('action', 'ilike', `%${query.q}%`)
          .orWhere('target_id', 'ilike', `%${query.q}%`)
          .orWhere('operator_name', 'ilike', `%${query.q}%`);
      });
    }
    const logs = await qb;
    return { logs };
  });

  app.post('/admin/audit-logs', { preHandler: requireAdmin }, async (request) => {
    const body = createAuditLogSchema.parse(request.body);
    const user = request.authUser!;
    const id = createId('log');
    const operatorName = await getOperatorName(user.id);
    await db('admin_audit_logs').insert({
      id,
      operator_user_id: user.id,
      operator_name: operatorName,
      module: body.module,
      target_type: body.targetType,
      target_id: body.targetId,
      action: body.action,
      risk: body.risk,
      reason: body.reason ?? null,
      before_snapshot: body.beforeSnapshot ?? {},
      after_snapshot: body.afterSnapshot ?? {},
      ip: request.ip,
      device: request.headers['user-agent'] ?? 'unknown',
      rollbackable: body.rollbackable,
      created_at: new Date(),
    });
    return { id };
  });
}

// ============ 数据修正 ============
const correctionFieldMap: Record<string, string[]> = {
  '用户资料': ['nickname', 'phone', 'email', 'avatar_url', 'liftmark_id', 'status'],
  '手机号': ['phone'],
  '头像': ['avatar_url'],
  '会员权益': ['type', 'is_lifetime', 'expires_at', 'pro_group_limit', 'activated_pro_group_count'],
  '小组关系': ['name', 'owner_user_id', 'member_limit', 'group_limit', 'status'],
  '成员档案': ['bodyweight', 'bench_1rm', 'squat_1rm', 'deadlift_1rm', 'overhead_press_1rm', 'pullup_reference_weight', 'barbell_increment', 'dumbbell_increment'],
  '训练 session': ['title', 'status', 'date', 'week', 'weekday', 'plan_id', 'group_id'],
  '每组训练数据': ['actual_weight', 'actual_reps', 'planned_weight', 'planned_reps', 'completed', 'skipped'],
  '计划数据': ['name', 'title', 'status', 'current_week'],
  '动作数据': ['name', 'category', 'equipment', 'primary_muscle'],
  '同步状态': ['last_pulled_at', 'last_pushed_at', 'sync_version'],
  '订单权益': ['status', 'amount_cents'],
  '激活码记录': ['disabled_at'],
  '文件资源': ['url', 'status'],
};

const createCorrectionSchema = z.object({
  targetType: z.string().min(1),
  targetId: z.string().min(1),
  targetUserId: z.string().optional(),
  field: z.string().optional(),
  beforeValue: z.string().optional(),
  afterValue: z.string().optional(),
  reason: z.string().min(4).max(500),
  syncToDevice: z.boolean().default(false),
  recompute: z.boolean().default(false),
  ticketId: z.string().optional(),
});

async function registerCorrectionRoutes(app: FastifyInstance) {
  app.get('/admin/corrections/fields', { preHandler: requireAdmin }, async () => {
    return {
      fields: correctionFieldMap,
    };
  });

  app.get('/admin/corrections', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { status?: string; targetType?: string; q?: string };
    let qb = db('admin_corrections').orderBy('created_at', 'desc').limit(500);
    if (query.status && query.status !== 'all') {
      qb = qb.where('status', query.status);
    }
    if (query.targetType && query.targetType !== 'all') {
      qb = qb.where('target_type', query.targetType);
    }
    if (query.q) {
      qb = qb.where(function () {
        this.where('target_id', 'ilike', `%${query.q}%`)
          .orWhere('field', 'ilike', `%${query.q}%`)
          .orWhere('reason', 'ilike', `%${query.q}%`);
      });
    }
    const corrections = await qb;
    return { corrections };
  });

  app.post('/admin/corrections', { preHandler: requireAdmin }, async (request) => {
    const body = createCorrectionSchema.parse(request.body);
    const user = request.authUser!;
    const id = createId('fix');
    const operatorName = await getOperatorName(user.id);
    await db('admin_corrections').insert({
      id,
      operator_user_id: user.id,
      operator_name: operatorName,
      target_type: body.targetType,
      target_id: body.targetId,
      target_user_id: body.targetUserId ?? null,
      field: body.field ?? null,
      before_value: body.beforeValue ?? null,
      after_value: body.afterValue ?? null,
      reason: body.reason,
      sync_to_device: body.syncToDevice,
      recompute: body.recompute,
      ticket_id: body.ticketId ?? null,
      status: 'done',
      created_at: new Date(),
      updated_at: new Date(),
    });
    // 同时写审计日志
    await db('admin_audit_logs').insert({
      id: createId('log'),
      operator_user_id: user.id,
      operator_name: operatorName,
      module: '数据修正中心',
      target_type: body.targetType,
      target_id: body.targetId,
      action: `修改字段 ${body.field ?? ''}`,
      risk: 'high',
      reason: body.reason,
      before_snapshot: { value: body.beforeValue },
      after_snapshot: { value: body.afterValue },
      ip: request.ip,
      device: request.headers['user-agent'] ?? 'unknown',
      rollbackable: true,
      created_at: new Date(),
    });
    return { id };
  });

  app.post('/admin/corrections/:id/rollback', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const correction = await db('admin_corrections').where({ id: params.id }).first();
    if (!correction) throw notFound('修正记录不存在。');
    await db('admin_corrections').where({ id: params.id }).update({
      status: 'rolledback',
      rolled_back_at: new Date(),
      updated_at: new Date(),
    });
    return { ok: true };
  });
}

// ============ 管理员列表 ============
async function registerAdminListRoutes(app: FastifyInstance) {
  app.get('/admin/admins', { preHandler: requireAdmin }, async () => {
    const admins = await db('users')
      .where('role', 'admin')
      .select('id', 'nickname', 'phone', 'email', 'status', 'last_login_at', 'created_at')
      .orderBy('created_at', 'asc');
    return { admins };
  });
}

// ============ 用户扩展（搜索/详情/备注） ============
async function registerUserExtRoutes(app: FastifyInstance) {
  app.get('/admin/users/search', { preHandler: requireAdmin }, async (request) => {
    const query = request.query as { q?: string; tier?: string; status?: string; sync?: string; limit?: string };
    let qb = db('users')
      .leftJoin('memberships', 'users.id', 'memberships.user_id')
      .select(
        'users.id',
        'users.nickname',
        'users.phone',
        'users.email',
        'users.avatar_url',
        'users.liftmark_id',
        'users.role',
        'users.status',
        'users.registered_at',
        'users.last_login_at',
        'users.created_at',
        'memberships.type as tier',
        'memberships.is_lifetime',
        'memberships.expires_at as tier_expires_at',
      )
      .orderBy('users.created_at', 'desc')
      .limit(Number(query.limit ?? 100));

    if (query.q) {
      qb = qb.where(function () {
        this.where('users.nickname', 'ilike', `%${query.q}%`)
          .orWhere('users.phone', 'ilike', `%${query.q}%`)
          .orWhere('users.liftmark_id', 'ilike', `%${query.q}%`)
          .orWhere('users.id', 'ilike', `%${query.q}%`);
      });
    }
    if (query.tier && query.tier !== 'all') {
      if (query.tier === 'lifetime') {
        qb = qb.where('memberships.is_lifetime', true);
      } else if (query.tier === 'free') {
        qb = qb.whereNull('memberships.type').orWhere('memberships.type', 'free');
      } else {
        qb = qb.where('memberships.type', query.tier);
      }
    }
    if (query.status && query.status !== 'all') {
      qb = qb.where('users.status', query.status);
    }

    const users = await qb;
    // 查小组数和成员数
    const userIds = users.map((u: any) => u.id);
    let groupCounts: any[] = [];
    let trainingCounts: any[] = [];
    if (userIds.length) {
      groupCounts = await db('group_members')
        .select('user_id')
        .where('status', 'active')
        .whereNull('left_at')
        .whereIn('user_id', userIds)
        .count('* as count')
        .groupBy('user_id');
      trainingCounts = await db('workout_sessions')
        .select('user_id')
        .whereIn('user_id', userIds)
        .count('* as count')
        .groupBy('user_id');
    }
    const groupMap = new Map(groupCounts.map((g: any) => [g.user_id, Number(g.count)]));
    const trainingMap = new Map(trainingCounts.map((t: any) => [t.user_id, Number(t.count)]));

    return {
      users: users.map((u: any) => ({
        ...u,
        tier: u.is_lifetime ? 'lifetime' : u.tier ?? 'free',
        groups: groupMap.get(u.id) ?? 0,
        members: groupMap.get(u.id) ?? 0,
        trainings: trainingMap.get(u.id) ?? 0,
      })),
    };
  });

  app.get('/admin/users/:id/detail', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const user = await db('users').where({ id: params.id }).first();
    if (!user) throw notFound('用户不存在。');

    const membership = await db('memberships').where({ user_id: params.id }).first();
    const groups = await db('group_members')
      .leftJoin('groups', 'group_members.group_id', 'groups.id')
      .select('group_members.*', 'groups.name as group_name')
      .where('group_members.user_id', params.id)
      .orderBy('group_members.joined_at', 'desc');
    const sessions = await db('workout_sessions')
      .where({ user_id: params.id })
      .orderBy('created_at', 'desc')
      .limit(10);
    const orders = await db('payment_orders')
      .where({ user_id: params.id })
      .orderBy('created_at', 'desc')
      .limit(10);
    const feedback = await db('feedback')
      .where({ user_id: params.id })
      .orderBy('created_at', 'desc')
      .limit(10);
    const syncStates = await db('sync_state').where({ user_id: params.id }).orderBy('updated_at', 'desc');
    const notes = await db('admin_user_notes')
      .where({ user_id: params.id })
      .orderBy('created_at', 'desc')
      .limit(20);
    const corrections = await db('admin_corrections')
      .where({ target_user_id: params.id })
      .orderBy('created_at', 'desc')
      .limit(20);
    const codeRedemptions = await db('activation_code_redemptions')
      .leftJoin('activation_codes', 'activation_code_redemptions.activation_code_id', 'activation_codes.id')
      .select('activation_code_redemptions.*', 'activation_codes.code_prefix', 'activation_codes.membership_type')
      .where('activation_code_redemptions.user_id', params.id)
      .orderBy('activation_code_redemptions.redeemed_at', 'desc');

    return {
      user: {
        id: user.id,
        nickname: user.nickname,
        phone: user.phone,
        email: user.email,
        avatarUrl: user.avatar_url,
        liftmarkId: user.liftmark_id,
        role: user.role,
        status: user.status,
        registeredAt: user.registered_at,
        lastLoginAt: user.last_login_at,
        createdAt: user.created_at,
      },
      membership: membership ? toMembershipDto(membership) : null,
      groups,
      sessions,
      orders,
      feedback,
      syncStates,
      notes,
      corrections,
      codeRedemptions,
    };
  });

  app.post('/admin/users/:id/notes', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const body = z.object({ content: z.string().min(1).max(1000) }).parse(request.body);
    const user = request.authUser!;
    const id = createId('note');
    const operatorName = await getOperatorName(user.id);
    await db('admin_user_notes').insert({
      id,
      user_id: params.id,
      operator_user_id: user.id,
      operator_name: operatorName,
      content: body.content,
      created_at: new Date(),
    });
    return { id };
  });

  app.patch('/admin/users/:id/profile', { preHandler: requireAdmin }, async (request) => {
    const params = request.params as { id: string };
    const body = z.object({
      nickname: z.string().min(1).max(40).optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
      avatarUrl: z.string().optional(),
    }).parse(request.body);
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.nickname) patch.nickname = body.nickname;
    if (body.phone) patch.phone = body.phone;
    if (body.email) patch.email = body.email;
    if (body.avatarUrl) patch.avatar_url = body.avatarUrl;
    await db('users').where({ id: params.id }).update(patch);
    return { ok: true };
  });
}

// ============ 入口 ============
export async function registerAdminExtendedRoutes(app: FastifyInstance) {
  await registerDashboardRoutes(app);
  await registerMembershipAdminRoutes(app);
  await registerGroupAdminRoutes(app);
  await registerTrainingAdminRoutes(app);
  await registerPlanExerciseRoutes(app);
  await registerRoomAdminRoutes(app);
  await registerOrderAdminRoutes(app);
  await registerSyncAdminRoutes(app);
  await registerDeviceAdminRoutes(app);
  await registerFeedbackAdminRoutes(app);
  await registerAnnouncementAdminRoutes(app);
  await registerVersionConfigRoutes(app);
  await registerMonitorRoutes(app);
  await registerAuditLogRoutes(app);
  await registerCorrectionRoutes(app);
  await registerAdminListRoutes(app);
  await registerUserExtRoutes(app);
}
