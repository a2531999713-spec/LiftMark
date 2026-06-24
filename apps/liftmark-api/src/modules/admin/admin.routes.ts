import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { db } from '../../db/connection';
import { requireAdmin } from '../../middlewares/auth';
import { badRequest, notFound, unauthorized } from '../../utils/errors';
import { createActivationCode, createId } from '../../utils/ids';
import { addDays, hashValue, verifyPassword } from '../../utils/security';
import { signAccessToken, signRefreshToken } from '../../utils/tokens';
import { grantMembership, toMembershipDto } from '../memberships/membership.service';

const adminLoginSchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

const userIdParams = z.object({ id: z.string().min(1) });
const statusSchema = z.object({ status: z.enum(['normal', 'disabled']) });
const grantMembershipSchema = z.object({
  type: z.enum(['free', 'pro', 'lifetime']),
  durationDays: z.number().int().positive().optional(),
  isLifetime: z.boolean().optional(),
  proGroupLimit: z.number().int().min(0).optional(),
});

const createActivationCodeSchema = z.object({
  code: z.string().optional(),
  membershipType: z.enum(['pro', 'lifetime']).default('pro'),
  durationDays: z.number().int().positive().optional(),
  isLifetime: z.boolean().optional(),
  proGroupLimit: z.number().int().min(0).default(2),
  maxRedemptions: z.number().int().positive().default(1),
});

const idParams = z.object({ id: z.string().min(1) });
const feedbackPatchSchema = z.object({
  status: z.enum(['open', 'reviewing', 'resolved', 'closed']).optional(),
  adminNote: z.string().max(2000).optional(),
});
const announcementSchema = z.object({
  title: z.string().min(1).max(80),
  content: z.string().min(1).max(3000),
  status: z.enum(['draft', 'published']).default('draft'),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});
const appConfigSchema = z.object({
  key: z.string().min(1).max(80),
  value: z.record(z.string(), z.unknown()),
});

function parseRefreshExpiry() {
  const match = /^(\d+)([dhm])$/.exec(process.env.JWT_REFRESH_EXPIRES_IN ?? '30d');
  if (!match) return addDays(new Date(), 30);
  const value = Number(match[1]);
  if (match[2] === 'd') return addDays(new Date(), value);
  if (match[2] === 'h') return new Date(Date.now() + value * 60 * 60 * 1000);
  return new Date(Date.now() + value * 60 * 1000);
}

function toAdminUserDto(user: any) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    liftmarkId: user.liftmark_id,
    role: user.role,
    status: user.status,
    createdAt: user.created_at,
    lastLoginAt: user.last_login_at,
  };
}

async function createAdminSession(user: any) {
  const accessToken = signAccessToken({ id: user.id, role: user.role, status: user.status });
  const refresh = signRefreshToken(user.id);
  await db('refresh_tokens').insert({
    id: refresh.jti,
    user_id: user.id,
    token_hash: hashValue(refresh.token),
    expires_at: parseRefreshExpiry(),
    created_at: new Date(),
  });
  await db('users').where({ id: user.id }).update({ last_login_at: new Date(), updated_at: new Date() });
  return {
    accessToken,
    refreshToken: refresh.token,
    user: toAdminUserDto(user),
  };
}

export async function registerAdminRoutes(app: FastifyInstance) {
  app.post('/admin/auth/login', async (request) => {
    const body = adminLoginSchema.parse(request.body);
    const user = await db('users').where({ phone: body.account }).orWhere({ email: body.account }).first();
    if (!user || user.role !== 'admin' || user.status !== 'normal' || !(await verifyPassword(body.password, user.password_hash))) {
      throw unauthorized('管理员账号或密码不正确。');
    }
    return createAdminSession(user);
  });

  app.get('/admin/users', { preHandler: requireAdmin }, async () => {
    const users = await db('users').orderBy('created_at', 'desc').limit(500);
    return { users: users.map(toAdminUserDto) };
  });

  app.get('/admin/users/:id', { preHandler: requireAdmin }, async (request) => {
    const params = userIdParams.parse(request.params);
    const user = await db('users').where({ id: params.id }).first();
    if (!user) throw notFound('用户不存在。');
    const membership = await db('memberships').where({ user_id: params.id }).first();
    return { user: toAdminUserDto(user), membership: membership ? toMembershipDto(membership) : null };
  });

  app.patch('/admin/users/:id/status', { preHandler: requireAdmin }, async (request) => {
    const params = userIdParams.parse(request.params);
    const body = statusSchema.parse(request.body);
    const updated = await db('users').where({ id: params.id }).update({ status: body.status, updated_at: new Date() });
    if (!updated) throw notFound('用户不存在。');
    return { ok: true };
  });

  app.post('/admin/users/:id/grant-membership', { preHandler: requireAdmin }, async (request) => {
    const params = userIdParams.parse(request.params);
    const body = grantMembershipSchema.parse(request.body);
    const user = await db('users').where({ id: params.id }).first();
    if (!user) throw notFound('用户不存在。');
    const membership = await grantMembership(params.id, {
      type: body.type,
      source: 'admin_grant',
      durationDays: body.durationDays,
      isLifetime: body.isLifetime,
      proGroupLimit: body.proGroupLimit,
    });
    return { membership: toMembershipDto(membership) };
  });

  app.get('/admin/groups', { preHandler: requireAdmin }, async () => {
    const groups = await db('groups').orderBy('created_at', 'desc').limit(500);
    return { groups };
  });

  app.get('/admin/activation-codes', { preHandler: requireAdmin }, async () => {
    const codes = await db('activation_codes').orderBy('created_at', 'desc').limit(500);
    return {
      activationCodes: codes.map((code) => ({
        id: code.id,
        codePrefix: code.code_prefix,
        membershipType: code.membership_type,
        durationDays: code.duration_days,
        isLifetime: code.is_lifetime,
        proGroupLimit: code.pro_group_limit,
        maxRedemptions: code.max_redemptions,
        redeemedCount: code.redeemed_count,
        disabledAt: code.disabled_at,
        createdAt: code.created_at,
      })),
    };
  });

  app.post('/admin/activation-codes', { preHandler: requireAdmin }, async (request) => {
    const body = createActivationCodeSchema.parse(request.body);
    const code = (body.code ?? createActivationCode()).trim().toUpperCase();
    const now = new Date();
    const id = createId('ac');
    await db('activation_codes').insert({
      id,
      code_hash: hashValue(code),
      code_prefix: code.slice(0, 8),
      membership_type: body.isLifetime ? 'lifetime' : body.membershipType,
      duration_days: body.isLifetime ? null : (body.durationDays ?? 365),
      is_lifetime: body.isLifetime ?? body.membershipType === 'lifetime',
      pro_group_limit: body.proGroupLimit,
      max_redemptions: body.maxRedemptions,
      redeemed_count: 0,
      created_by_user_id: request.authUser?.id ?? null,
      created_at: now,
      updated_at: now,
    });
    return {
      id,
      code,
      warning: '激活码明文只在本次响应返回，请妥善保存。',
    };
  });

  app.patch('/admin/activation-codes/:id/disable', { preHandler: requireAdmin }, async (request) => {
    const params = idParams.parse(request.params);
    const updated = await db('activation_codes').where({ id: params.id }).update({ disabled_at: new Date(), updated_at: new Date() });
    if (!updated) throw notFound('激活码不存在。');
    return { ok: true };
  });

  app.get('/admin/feedback', { preHandler: requireAdmin }, async () => {
    const feedback = await db('feedback').orderBy('created_at', 'desc').limit(500);
    return { feedback };
  });

  app.patch('/admin/feedback/:id', { preHandler: requireAdmin }, async (request) => {
    const params = idParams.parse(request.params);
    const body = feedbackPatchSchema.parse(request.body);
    const patch: Record<string, unknown> = { updated_at: new Date() };
    if (body.status) patch.status = body.status;
    if (body.adminNote !== undefined) patch.admin_note = body.adminNote;
    const updated = await db('feedback').where({ id: params.id }).update(patch);
    if (!updated) throw notFound('反馈不存在。');
    return { ok: true };
  });

  app.get('/admin/announcements', { preHandler: requireAdmin }, async () => {
    const announcements = await db('announcements').orderBy('created_at', 'desc').limit(500);
    return { announcements };
  });

  app.post('/admin/announcements', { preHandler: requireAdmin }, async (request) => {
    const body = announcementSchema.parse(request.body);
    if (body.startsAt && Number.isNaN(new Date(body.startsAt).getTime())) throw badRequest('startsAt 时间格式不正确。');
    if (body.endsAt && Number.isNaN(new Date(body.endsAt).getTime())) throw badRequest('endsAt 时间格式不正确。');
    const id = createId('ann');
    await db('announcements').insert({
      id,
      title: body.title,
      content: body.content,
      status: body.status,
      starts_at: body.startsAt ? new Date(body.startsAt) : null,
      ends_at: body.endsAt ? new Date(body.endsAt) : null,
      created_at: new Date(),
      updated_at: new Date(),
    });
    return { id };
  });

  app.get('/admin/app-config', { preHandler: requireAdmin }, async () => {
    const rows = await db('app_config').orderBy('key', 'asc');
    return { appConfig: rows };
  });

  app.post('/admin/app-config', { preHandler: requireAdmin }, async (request) => {
    const body = appConfigSchema.parse(request.body);
    const now = new Date();
    await db('app_config')
      .insert({
        id: createId('cfg'),
        key: body.key,
        value: body.value,
        created_at: now,
        updated_at: now,
      })
      .onConflict('key')
      .merge({ value: body.value, updated_at: now });
    return { ok: true };
  });

  app.get('/admin/sync/status', { preHandler: requireAdmin }, async () => {
    const users = await db('users').count<{ count: string }[]>({ count: '*' });
    const sessions = await db('workout_sessions').count<{ count: string }[]>({ count: '*' });
    const sets = await db('workout_sets').count<{ count: string }[]>({ count: '*' });
    const syncStates = await db('sync_state').orderBy('updated_at', 'desc').limit(100);
    return {
      users: Number(users[0]?.count ?? 0),
      workoutSessions: Number(sessions[0]?.count ?? 0),
      workoutSets: Number(sets[0]?.count ?? 0),
      syncStates,
    };
  });
}

