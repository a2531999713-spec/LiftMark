import { db } from '../../db/connection';
import { ApiError } from '../../utils/errors';
import { requiredSyncTables } from './sync.contract';

export async function getMissingSyncTables(): Promise<string[]> {
  const checks = await Promise.all(
    requiredSyncTables.map(async (tableName) => ({ tableName, exists: await db.schema.hasTable(tableName) })),
  );
  return checks.filter((item) => !item.exists).map((item) => item.tableName);
}

export async function assertSyncSchemaReady(): Promise<void> {
  const missingTables = await getMissingSyncTables();
  if (missingTables.length > 0) {
    throw new ApiError(503, '服务端同步结构尚未完成升级，请稍后重试。', 'SERVER_SCHEMA_OUTDATED');
  }
}
