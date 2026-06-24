import { env } from './config/env';
import { closeDb } from './db/connection';
import { buildApp } from './app';

async function main() {
  const app = await buildApp();
  await app.listen({ host: env.host, port: env.port });
}

main().catch(async (error) => {
  console.error(error);
  await closeDb();
  process.exit(1);
});

