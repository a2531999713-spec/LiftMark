import cors from '@fastify/cors';
import Fastify from 'fastify';
import { ZodError } from 'zod';

import { db } from './db/connection';
import { registerAchievementsRoutes } from './modules/achievements/achievements.routes';
import { registerAdminRoutes } from './modules/admin/admin.routes';
import { registerAnnouncementsRoutes } from './modules/announcements/announcements.routes';
import { registerAppConfigRoutes } from './modules/app-config/app-config.routes';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { registerFeedbackRoutes } from './modules/feedback/feedback.routes';
import { registerGroupRoutes } from './modules/groups/groups.routes';
import { registerMembershipRoutes } from './modules/memberships/memberships.routes';
import { registerSyncRoutes } from './modules/sync/sync.routes';
import { registerWorkoutRoutes } from './modules/workouts/workouts.routes';
import { ApiError } from './utils/errors';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: true,
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send({
        error: error.code,
        message: error.message,
      });
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        message: error.issues[0]?.message ?? '请求参数不正确。',
        issues: error.issues,
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误。',
    });
  });

  await app.register(async (api) => {
    api.get('/health', async () => ({
      ok: true,
      service: 'liftmark-api',
      time: new Date().toISOString(),
    }));

    api.get('/db-check', async () => {
      const row = await db.raw('select current_database() as current_database, current_user as current_user');
      return row.rows[0];
    });

    await registerAuthRoutes(api);
    await registerMembershipRoutes(api);
    await registerGroupRoutes(api);
    await registerSyncRoutes(api);
    await registerWorkoutRoutes(api);
    await registerAchievementsRoutes(api);
    await registerAnnouncementsRoutes(api);
    await registerAppConfigRoutes(api);
    await registerFeedbackRoutes(api);
    await registerAdminRoutes(api);
  }, { prefix: '/api' });

  return app;
}
