import type { FastifyReply, FastifyRequest } from 'fastify';

import { db } from '../db/connection';
import { forbidden, unauthorized } from '../utils/errors';
import { verifyAccessToken, type TokenUser } from '../utils/tokens';

function readBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw unauthorized();
  }
  return header.slice('Bearer '.length).trim();
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply) {
  const token = readBearerToken(request);
  let payload: ReturnType<typeof verifyAccessToken>;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw unauthorized('登录状态已失效，请重新登录。');
  }

  const user = await db('users')
    .select('id', 'role', 'status')
    .where({ id: payload.sub })
    .first<TokenUser>();

  if (!user || user.status !== 'normal') {
    throw unauthorized('账号不存在或已被禁用。');
  }

  request.authUser = user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (request.authUser?.role !== 'admin') {
    throw forbidden('需要管理员权限。');
  }
}

export function getAuthUser(request: FastifyRequest) {
  if (!request.authUser) {
    throw unauthorized();
  }
  return request.authUser;
}
