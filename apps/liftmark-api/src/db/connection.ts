import knex, { type Knex } from 'knex';

import { env } from '../config/env';

export const db: Knex = knex({
  client: 'pg',
  connection: env.databaseUrl,
  pool: {
    min: 0,
    max: 10,
  },
});

export async function closeDb() {
  await db.destroy();
}

