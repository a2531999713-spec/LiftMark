import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import Fastify from 'fastify';

describe('achievement route boundary', () => {
  it('rejects unauthenticated requests before reading another account', async () => {
    process.env.DATABASE_URL ??= 'postgres://liftmark:liftmark@127.0.0.1:5432/liftmark_test';
    const { registerAchievementsRoutes } = await import('./achievements.routes');
    const app = Fastify();
    await registerAchievementsRoutes(app);
    const response = await app.inject({ method: 'GET', url: '/achievements/me' });
    assert.equal(response.statusCode, 401);
    await app.close();
  });
});
