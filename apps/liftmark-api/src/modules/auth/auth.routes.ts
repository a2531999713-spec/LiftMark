import type { FastifyInstance } from 'fastify';
import type { Knex } from 'knex';
import { z } from 'zod';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { badRequest, conflict, unauthorized } from '../../utils/errors';
import { createId, createLiftmarkId } from '../../utils/ids';
import { addDays, hashPassword, hashValue, verifyPassword } from '../../utils/security';
import { signAccessToken, signRefreshToken, verifyRefreshToken, type TokenUser } from '../../utils/tokens';
import { sendSmsCode, verifySmsCode } from './sms.service';

type UserRow = {
  avatar_url?: string | null;
  email?: string | null;
  id: string;
  campaign_code?: string | null;
  early_user_tier?: string | null;
  liftmark_id: string;
  nickname: string;
  password_hash?: string | null;
  phone?: string | null;
  registered_at?: Date | string | null;
  registration_seq?: number | null;
  registration_source?: string | null;
  role: 'user' | 'admin';
  status: 'normal' | 'disabled';
};

const sendCodeSchema = z.object({
  phone: z.string(),
  purpose: z.enum(['login', 'register', 'reset_password']),
});

const registerSchema = z.object({
  phone: z.string(),
  password: z.string().min(6).optional(),
  code: z.string().optional(),
  campaignCode: z.string().max(64).optional(),
  nickname: z.string().min(1).max(32).optional(),
  registrationSource: z.string().max(64).optional(),
});

const loginSchema = z.object({
  account: z.string().min(1),
  password: z.string().min(1),
});

const codeLoginSchema = z.object({
  phone: z.string(),
  code: z.string().min(1),
  campaignCode: z.string().max(64).optional(),
  registrationSource: z.string().max(64).optional(),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function toPublicUser(user: UserRow) {
  return {
    id: user.id,
    phone: user.phone,
    email: user.email,
    nickname: user.nickname,
    avatar_url: user.avatar_url,
    campaignCode: user.campaign_code,
    earlyUserTier: user.early_user_tier,
    liftmarkId: user.liftmark_id,
    registeredAt: user.registered_at,
    registrationSeq: user.registration_seq,
    registrationSource: user.registration_source,
    role: user.role,
    status: user.status,
  };
}

function parseRefreshExpiry() {
  const match = /^(\d+)([dhm])$/.exec(process.env.JWT_REFRESH_EXPIRES_IN ?? '30d');
  if (!match) return addDays(new Date(), 30);
  const value = Number(match[1]);
  const unit = match[2];
  const now = new Date();
  if (unit === 'd') return addDays(now, value);
  if (unit === 'h') return new Date(now.getTime() + value * 60 * 60 * 1000);
  return new Date(now.getTime() + value * 60 * 1000);
}

type DbClient = Knex | Knex.Transaction;

async function ensureFreeMembership(userId: string, client: DbClient = db) {
  const existing = await client('memberships').where({ user_id: userId }).first();
  if (existing) return;
  await client('memberships').insert({
    id: createId('mem'),
    user_id: userId,
    type: 'free',
    source: 'admin_grant',
    starts_at: new Date(),
    expires_at: null,
    is_lifetime: false,
    pro_group_limit: 0,
    activated_pro_group_count: 0,
    created_at: new Date(),
    updated_at: new Date(),
  });
}

function normalizeOptionalCode(value?: string) {
  const normalized = value?.trim();
  return normalized ? normalized.toUpperCase() : null;
}

function normalizeRegistrationSource(value?: string) {
  const normalized = value?.trim();
  return normalized || 'app';
}

function getEarlyUserTier(registrationSeq: number, campaignCode: string | null) {
  if (registrationSeq > 0 && registrationSeq <= 100) {
    return 'founding_100';
  }
  if (campaignCode === 'FOUNDING100') {
    return 'founding_campaign';
  }
  return 'standard';
}

async function nextRegistrationSeq(trx: Knex.Transaction) {
  const result = await trx.raw<{ rows?: Array<{ seq?: number | string }> }>(
    "SELECT nextval('users_registration_seq') AS seq",
  );
  return Number(result.rows?.[0]?.seq ?? 0);
}

async function createSession(user: UserRow) {
  const accessToken = signAccessToken({
    id: user.id,
    role: user.role,
    status: user.status,
  } satisfies TokenUser);
  const refresh = signRefreshToken(user.id);

  await db('refresh_tokens').insert({
    id: refresh.jti,
    user_id: user.id,
    token_hash: hashValue(refresh.token),
    expires_at: parseRefreshExpiry(),
    created_at: new Date(),
  });

  await db('users').where({ id: user.id }).update({
    last_login_at: new Date(),
    updated_at: new Date(),
  });

  await ensureFreeMembership(user.id);

  return {
    accessToken,
    refreshToken: refresh.token,
    user: toPublicUser(user),
  };
}

async function findUserByAccount(account: string) {
  return db('users')
    .where({ phone: account })
    .orWhere({ email: account })
    .orWhere({ liftmark_id: account })
    .first<UserRow>();
}

async function createUser(input: {
  campaignCode?: string;
  nickname?: string;
  password?: string;
  phone: string;
  registrationSource?: string;
}) {
  let user: UserRow | null = null;

  await db.transaction(async (trx) => {
    const existing = await trx('users').where({ phone: input.phone }).first();
    if (existing) {
      throw conflict('该手机号已注册。');
    }

    const now = new Date();
    const registrationSeq = await nextRegistrationSeq(trx);
    const campaignCode = normalizeOptionalCode(input.campaignCode);
    const registrationSource = normalizeRegistrationSource(input.registrationSource);
    user = {
      id: createId('usr'),
      phone: input.phone,
      email: null,
      password_hash: input.password ? await hashPassword(input.password) : null,
      nickname: input.nickname?.trim() || `练刻用户${input.phone.slice(-4)}`,
      avatar_url: null,
      liftmark_id: createLiftmarkId(),
      registration_seq: registrationSeq,
      registered_at: now,
      registration_source: registrationSource,
      campaign_code: campaignCode,
      early_user_tier: getEarlyUserTier(registrationSeq, campaignCode),
      role: 'user',
      status: 'normal',
    };

    await trx('users').insert({
      id: user.id,
      phone: user.phone,
      email: user.email,
      password_hash: user.password_hash,
      nickname: user.nickname,
      avatar_url: user.avatar_url,
      liftmark_id: user.liftmark_id,
      registration_seq: user.registration_seq,
      registered_at: user.registered_at,
      registration_source: user.registration_source,
      campaign_code: user.campaign_code,
      early_user_tier: user.early_user_tier,
      role: user.role,
      status: user.status,
      created_at: now,
      updated_at: now,
    });
    await ensureFreeMembership(user.id, trx);
  });

  if (!user) {
    throw badRequest('账号创建失败。');
  }

  return user;
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post('/auth/send-code', async (request) => {
    const body = sendCodeSchema.parse(request.body);
    return sendSmsCode({
      ...body,
      ipAddress: request.ip,
    });
  });

  app.post('/auth/register', async (request) => {
    const body = registerSchema.parse(request.body);
    if (!body.password && !body.code) {
      throw badRequest('请提供密码或验证码。');
    }
    if (body.code) {
      await verifySmsCode({ phone: body.phone, purpose: 'register', code: body.code });
    }
    const user = await createUser(body);
    return createSession(user);
  });

  app.post('/auth/login', async (request) => {
    const body = loginSchema.parse(request.body);
    const user = await findUserByAccount(body.account);
    if (!user || user.status !== 'normal' || !(await verifyPassword(body.password, user.password_hash))) {
      throw unauthorized('账号或密码不正确。');
    }
    return createSession(user);
  });

  app.post('/auth/login-with-code', async (request) => {
    const body = codeLoginSchema.parse(request.body);
    await verifySmsCode({ phone: body.phone, purpose: 'login', code: body.code });
    const user =
      (await db('users').where({ phone: body.phone }).first<UserRow>()) ??
      (await createUser({
        campaignCode: body.campaignCode,
        phone: body.phone,
        registrationSource: body.registrationSource ?? 'sms_login',
      }));
    if (user.status !== 'normal') {
      throw unauthorized('账号已被禁用。');
    }
    return createSession(user);
  });

  app.post('/auth/refresh', async (request) => {
    const body = refreshSchema.parse(request.body);
    const payload = verifyRefreshToken(body.refreshToken);
    const tokenHash = hashValue(body.refreshToken);
    const stored = await db('refresh_tokens')
      .where({ id: payload.jti, user_id: payload.sub, token_hash: tokenHash })
      .whereNull('revoked_at')
      .where('expires_at', '>', new Date())
      .first();
    if (!stored) {
      throw unauthorized('登录状态已过期，请重新登录。');
    }

    const user = await db('users').where({ id: payload.sub }).first<UserRow>();
    if (!user || user.status !== 'normal') {
      throw unauthorized('账号不存在或已被禁用。');
    }

    await db('refresh_tokens').where({ id: payload.jti }).update({ revoked_at: new Date() });
    return createSession(user);
  });

  app.get('/auth/me', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const user = await db('users').where({ id: authUser.id }).first<UserRow>();
    if (!user) throw unauthorized();
    return { user: toPublicUser(user) };
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const parsed = refreshSchema.partial().safeParse(request.body ?? {});
    if (parsed.success && parsed.data.refreshToken) {
      await db('refresh_tokens')
        .where({ user_id: authUser.id, token_hash: hashValue(parsed.data.refreshToken) })
        .update({ revoked_at: new Date() });
    } else {
      await db('refresh_tokens').where({ user_id: authUser.id }).whereNull('revoked_at').update({ revoked_at: new Date() });
    }
    return { ok: true };
  });

  app.patch('/auth/avatar', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const body = z.object({ avatar_url: z.string().max(2048).nullable() }).parse(request.body);
    await db('users').where({ id: authUser.id }).update({ avatar_url: body.avatar_url, updated_at: new Date() });
    return { ok: true, avatar_url: body.avatar_url };
  });
}
