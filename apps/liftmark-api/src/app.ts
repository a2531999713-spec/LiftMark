import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify from 'fastify';
import path from 'path';
import { ZodError } from 'zod';

import { db } from './db/connection';
import { isCorsOriginAllowed } from './config/cors';
import { env } from './config/env';
import { registerActivationCodeRoutes } from './modules/activation-codes/activation-codes.routes';
import { registerAchievementsRoutes } from './modules/achievements/achievements.routes';
import { registerAdminRoutes } from './modules/admin/admin.routes';
import { registerAnnouncementsRoutes } from './modules/announcements/announcements.routes';
import { registerAppConfigRoutes } from './modules/app-config/app-config.routes';
import { registerAuthRoutes } from './modules/auth/auth.routes';
import { registerCatalogRoutes } from './modules/catalog/catalog.routes';
import { registerFeedbackRoutes } from './modules/feedback/feedback.routes';
import { registerGroupRoutes } from './modules/groups/groups.routes';
import { registerMembershipRoutes } from './modules/memberships/memberships.routes';
import { registerSyncRoutes } from './modules/sync/sync.routes';
import { registerProfileSyncRoutes } from './modules/sync/profileSync.routes';
import { registerInvitationRoutes } from './modules/invitations/invitation.routes';
import { registerPendingTrainingRoutes } from './modules/pending-training/pendingTraining.routes';
import { registerTrainingRoomRoutes } from './modules/training-rooms/trainingRooms.routes';
import { registerWorkoutRoutes } from './modules/workouts/workouts.routes';
import { getMissingSyncTables } from './modules/sync/sync.schema-health';
import { ApiError } from './utils/errors';

export async function buildApp() {
  const app = Fastify({
    logger: true,
    trustProxy: true,
  });

  await app.register(cors, {
    origin(origin, callback) {
      callback(null, isCorsOriginAllowed(origin, env.corsAllowedOrigins));
    },
  });

  await app.register(rateLimit, {
    global: false,
    errorResponseBuilder: () => ({
      error: 'RATE_LIMITED',
      message: '请求过于频繁，请稍后再试。',
    }),
  });

  await app.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit for avatar uploads
    },
  });

  // 静态文件服务必须在根作用域注册，不能放在 /api 前缀下
  const uploadRoot = process.env.UPLOAD_ROOT ?? path.resolve('/home/deploy/liftmark/uploads');
  const uploadDirectoryInfo = {
    ok: true,
    directory: 'avatars',
    message: 'Avatar storage is available. Request a concrete file under /uploads/avatars/{filename}.',
    root: uploadRoot,
  };
  app.get('/uploads/avatars', async () => uploadDirectoryInfo);
  app.get('/uploads/avatars/', async () => uploadDirectoryInfo);
  await app.register(fastifyStatic, {
    prefix: '/uploads/',
    root: uploadRoot,
    wildcard: false,
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

    api.get('/migration-health', async (_request, reply) => {
      const missingSyncTables = await getMissingSyncTables();
      const ok = missingSyncTables.length === 0;
      return reply.status(ok ? 200 : 503).send({
        ok,
        schema: ok ? 'ready' : 'outdated',
        missingSyncTables,
      });
    });

    api.get('/db-check', async () => {
      const row = await db.raw('select current_database() as current_database, current_user as current_user');
      return row.rows[0];
    });

    await registerAuthRoutes(api);
    await registerCatalogRoutes(api);
    await registerActivationCodeRoutes(api);
    await registerMembershipRoutes(api);
    await registerGroupRoutes(api);
    await registerSyncRoutes(api);
    await registerProfileSyncRoutes(api);
    await registerInvitationRoutes(api);
    await registerPendingTrainingRoutes(api);
    await registerTrainingRoomRoutes(api);
    await registerWorkoutRoutes(api);
    await registerAchievementsRoutes(api);
    await registerAnnouncementsRoutes(api);
    await registerAppConfigRoutes(api);
    await registerFeedbackRoutes(api);
    await registerAdminRoutes(api);
  }, { prefix: '/api' });

  return app;
}
