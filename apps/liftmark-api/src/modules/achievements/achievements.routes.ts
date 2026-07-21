import type { FastifyInstance } from 'fastify';

import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { calculateAchievementMetrics } from './achievements.metrics';
import { reconcileUserAchievements } from './achievements.service';

export async function registerAchievementsRoutes(app: FastifyInstance) {
  app.get('/achievements/me', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const metrics = await calculateAchievementMetrics(authUser.id);
    const achievements = await reconcileUserAchievements(authUser.id, metrics);
    return {
      metrics,
      achievements,
      generatedAt: new Date().toISOString(),
    };
  });
}
