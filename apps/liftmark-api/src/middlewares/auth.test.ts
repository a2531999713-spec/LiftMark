import assert from 'node:assert/strict';
import test from 'node:test';

import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

process.env.DATABASE_URL ??= 'postgres://liftmark:liftmark@127.0.0.1:5432/liftmark_test';

test('expired access tokens are reported as unauthorized instead of internal errors', async () => {
  const { env } = await import('../config/env');
  const { requireAuth } = await import('./auth');
  const expiredToken = jwt.sign(
    {
      role: 'admin',
      status: 'normal',
      sub: 'admin-test',
      typ: 'access',
    },
    env.jwtSecret,
    { expiresIn: -1 },
  );
  const request = {
    headers: { authorization: `Bearer ${expiredToken}` },
  } as FastifyRequest;

  await assert.rejects(
    requireAuth(request, {} as FastifyReply),
    (error: unknown) => {
      assert.equal((error as { statusCode?: number }).statusCode, 401);
      assert.equal((error as { code?: string }).code, 'UNAUTHORIZED');
      assert.equal((error as Error).message, '登录状态已失效，请重新登录。');
      return true;
    },
  );
});
