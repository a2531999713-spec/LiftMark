require('dotenv').config();
const knex = require('knex');
const db = knex({ client: 'pg', connection: process.env.DATABASE_URL });
(async () => {
  const tables = await db.raw(`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
  `);
  console.log('Tables in public schema:');
  tables.rows.forEach(r => console.log('  ' + r.tablename));
  await db.destroy();
})().catch(e => { console.error(e.message); process.exit(1); });
