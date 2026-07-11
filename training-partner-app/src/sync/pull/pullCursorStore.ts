import type { SQLiteDatabase } from 'expo-sqlite';

const LAST_PULL_AT_KEY_PREFIX = 'last_pull_at';
const EPOCH = new Date(0).toISOString();

export function getPullCursorKey(userId: string): string {
  return `${LAST_PULL_AT_KEY_PREFIX}:${userId}`;
}

export async function getPullCursor(db: SQLiteDatabase, userId: string): Promise<string> {
  try {
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_state WHERE key = ? LIMIT 1',
      getPullCursorKey(userId),
    );
    return row?.value ?? EPOCH;
  } catch {
    return EPOCH;
  }
}

export async function advancePullCursor(db: SQLiteDatabase, userId: string, value: string): Promise<void> {
  const key = getPullCursorKey(userId);
  await db.runAsync(
    `INSERT INTO sync_state (id, key, value, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    `sync_state_${key}`,
    key,
    value,
    new Date().toISOString(),
  );
}
