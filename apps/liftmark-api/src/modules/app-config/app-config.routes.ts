import type { FastifyInstance } from 'fastify';

import { db } from '../../db/connection';

export async function registerAppConfigRoutes(app: FastifyInstance) {
  app.get('/app-config', async () => {
    const rows = await db('app_config').orderBy('key', 'asc');
    const config = Object.fromEntries(rows.map((row) => [row.key, row.value]));
    return { config };
  });
}

