import type { FastifyInstance } from 'fastify';

import { db } from '../../db/connection';

export async function registerAnnouncementsRoutes(app: FastifyInstance) {
  app.get('/announcements/current', async () => {
    const now = new Date();
    const announcement = await db('announcements')
      .where({ status: 'published' })
      .where((builder) => builder.whereNull('starts_at').orWhere('starts_at', '<=', now))
      .where((builder) => builder.whereNull('ends_at').orWhere('ends_at', '>=', now))
      .orderBy('created_at', 'desc')
      .first();

    return {
      announcement: announcement
        ? {
            id: announcement.id,
            title: announcement.title,
            content: announcement.content,
            startsAt: announcement.starts_at,
            endsAt: announcement.ends_at,
          }
        : null,
    };
  });
}

