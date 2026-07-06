import type { FastifyInstance } from 'fastify';

import { systemExerciseCatalog, systemPlanCatalog } from '../../db/systemCatalog';

export async function registerCatalogRoutes(app: FastifyInstance) {
  app.get('/catalog/system-plans', async () => ({
    plans: systemPlanCatalog,
  }));

  app.get('/catalog/system-exercises', async () => ({
    exercises: systemExerciseCatalog,
  }));
}
