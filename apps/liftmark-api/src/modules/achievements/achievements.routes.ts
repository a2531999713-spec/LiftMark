import type { FastifyInstance } from 'fastify';

import { db } from '../../db/connection';
import { getAuthUser, requireAuth } from '../../middlewares/auth';
import { createId } from '../../utils/ids';

function toDateKey(value: unknown) {
  const date = value ? new Date(String(value)) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function longestStreak(dateKeys: string[]) {
  const sorted = Array.from(new Set(dateKeys)).sort();
  let best = 0;
  let current = 0;
  let previous: Date | null = null;

  for (const key of sorted) {
    const date = new Date(`${key}T00:00:00.000Z`);
    if (!previous) {
      current = 1;
    } else {
      const diffDays = Math.round((date.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
      current = diffDays === 1 ? current + 1 : 1;
    }
    best = Math.max(best, current);
    previous = date;
  }

  return best;
}

async function calculateMetrics(userId: string) {
  const sessions = await db('workout_sessions').where({ user_id: userId }).whereNull('deleted_at');
  const setRows = await db('workout_sets')
    .where({ user_id: userId })
    .sum<{ total_volume: string }[]>({ total_volume: db.raw('COALESCE(actual_weight, 0) * COALESCE(actual_reps, 0)') });
  const dateKeys = sessions
    .map((session) => toDateKey(session.payload?.date ?? session.client_updated_at ?? session.created_at))
    .filter(Boolean) as string[];

  return {
    completed_workouts: sessions.length,
    training_streak_days: longestStreak(dateKeys),
    total_volume: Number(setRows[0]?.total_volume ?? 0),
  };
}

export async function registerAchievementsRoutes(app: FastifyInstance) {
  app.get('/achievements/me', { preHandler: requireAuth }, async (request) => {
    const authUser = getAuthUser(request);
    const metrics = await calculateMetrics(authUser.id);
    const definitions = await db('achievement_definitions').where({ enabled: true }).orderBy('created_at', 'asc');
    const achievements = [];

    for (const definition of definitions) {
      const progress = Math.min(Number(metrics[definition.metric as keyof typeof metrics] ?? 0), definition.target);
      const achieved = progress >= definition.target;
      const existing = await db('user_achievements')
        .where({ user_id: authUser.id, achievement_definition_id: definition.id })
        .first();

      const row = {
        progress,
        achieved_at: achieved ? (existing?.achieved_at ?? new Date()) : null,
        updated_at: new Date(),
      };

      if (existing) {
        await db('user_achievements').where({ id: existing.id }).update(row);
      } else {
        await db('user_achievements').insert({
          id: createId('uach'),
          user_id: authUser.id,
          achievement_definition_id: definition.id,
          ...row,
          created_at: new Date(),
        });
      }

      achievements.push({
        code: definition.code,
        name: definition.name,
        description: definition.description,
        metric: definition.metric,
        target: definition.target,
        progress,
        achievedAt: row.achieved_at,
      });
    }

    return { metrics, achievements };
  });
}

