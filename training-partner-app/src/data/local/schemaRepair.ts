import type { SQLiteDatabase } from 'expo-sqlite';

type RepairDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync'>;
type MigrationCompatible = Pick<SQLiteDatabase, 'execAsync' | 'getAllAsync' | 'runAsync'>;

const REQUIRED_COLUMNS: Record<string, string[]> = {
  group_members: [
    'avatar_url',
    'user_id',
    'member_type',
    'local_member_id',
    'joined_at',
    'remote_id',
    'sync_status',
    'sync_error',
    'version',
    'last_synced_at',
    'deleted_at',
  ],
  member_profiles: ['avatar_url', 'avatar_thumb_url', 'avatar_local_uri', 'avatar_updated_at'],
  account_profile_cache: [
    'display_name',
    'phone_masked',
    'liftmark_id',
    'age',
    'gender',
    'avatar_url',
    'avatar_thumb_url',
    'avatar_local_uri',
    'avatar_updated_at',
  ],
  body_metrics: ['remote_id', 'sync_status', 'sync_error', 'version', 'last_synced_at', 'deleted_at'],
  workout_exercise_records: [
    'remote_id',
    'sync_status',
    'sync_error',
    'version',
    'last_synced_at',
    'deleted_at',
    'updated_at',
  ],
  workout_sets: [
    'remote_id',
    'sync_status',
    'sync_error',
    'version',
    'last_synced_at',
    'deleted_at',
    'actual_rest_seconds',
  ],
  groups: ['remote_id', 'sync_status', 'sync_error', 'version', 'last_synced_at', 'deleted_at'],
  workout_sessions: ['remote_id', 'sync_status', 'sync_error', 'version', 'last_synced_at', 'deleted_at'],
};

const COLUMN_DEFINITIONS: Record<string, Record<string, string>> = {
  group_members: {
    avatar_url: 'avatar_url TEXT',
    user_id: 'user_id TEXT',
    member_type: "member_type TEXT NOT NULL DEFAULT 'local'",
    local_member_id: 'local_member_id TEXT',
    joined_at: 'joined_at TEXT',
    remote_id: 'remote_id TEXT',
    sync_status: "sync_status TEXT NOT NULL DEFAULT 'local_only'",
    sync_error: 'sync_error TEXT',
    version: 'version INTEGER NOT NULL DEFAULT 0',
    last_synced_at: 'last_synced_at TEXT',
    deleted_at: 'deleted_at TEXT',
  },
  member_profiles: {
    avatar_url: 'avatar_url TEXT',
    avatar_thumb_url: 'avatar_thumb_url TEXT',
    avatar_local_uri: 'avatar_local_uri TEXT',
    avatar_updated_at: 'avatar_updated_at TEXT',
  },
  account_profile_cache: {
    display_name: 'display_name TEXT',
    phone_masked: 'phone_masked TEXT',
    liftmark_id: 'liftmark_id TEXT',
    age: 'age INTEGER',
    gender: 'gender TEXT',
    avatar_url: 'avatar_url TEXT',
    avatar_thumb_url: 'avatar_thumb_url TEXT',
    avatar_local_uri: 'avatar_local_uri TEXT',
    avatar_updated_at: 'avatar_updated_at TEXT',
  },
  body_metrics: {
    remote_id: 'remote_id TEXT',
    sync_status: "sync_status TEXT NOT NULL DEFAULT 'local_only'",
    sync_error: 'sync_error TEXT',
    version: 'version INTEGER NOT NULL DEFAULT 0',
    last_synced_at: 'last_synced_at TEXT',
    deleted_at: 'deleted_at TEXT',
  },
  workout_exercise_records: {
    remote_id: 'remote_id TEXT',
    sync_status: "sync_status TEXT NOT NULL DEFAULT 'local_only'",
    sync_error: 'sync_error TEXT',
    version: 'version INTEGER NOT NULL DEFAULT 0',
    last_synced_at: 'last_synced_at TEXT',
    deleted_at: 'deleted_at TEXT',
    updated_at: 'updated_at TEXT',
  },
  workout_sets: {
    remote_id: 'remote_id TEXT',
    sync_status: "sync_status TEXT NOT NULL DEFAULT 'local_only'",
    sync_error: 'sync_error TEXT',
    version: 'version INTEGER NOT NULL DEFAULT 0',
    last_synced_at: 'last_synced_at TEXT',
    deleted_at: 'deleted_at TEXT',
    actual_rest_seconds: 'actual_rest_seconds INTEGER',
  },
  groups: {
    remote_id: 'remote_id TEXT',
    sync_status: "sync_status TEXT NOT NULL DEFAULT 'local_only'",
    sync_error: 'sync_error TEXT',
    version: 'version INTEGER NOT NULL DEFAULT 0',
    last_synced_at: 'last_synced_at TEXT',
    deleted_at: 'deleted_at TEXT',
  },
  workout_sessions: {
    remote_id: 'remote_id TEXT',
    sync_status: "sync_status TEXT NOT NULL DEFAULT 'local_only'",
    sync_error: 'sync_error TEXT',
    version: 'version INTEGER NOT NULL DEFAULT 0',
    last_synced_at: 'last_synced_at TEXT',
    deleted_at: 'deleted_at TEXT',
  },
};

export type SchemaCheckResult = {
  tableName: string;
  exists: boolean;
  missingColumns: string[];
  allColumns: string[];
};

export async function getSchemaCheckResults(db: RepairDatabase): Promise<SchemaCheckResult[]> {
  const results: SchemaCheckResult[] = [];

  for (const [table, requiredCols] of Object.entries(REQUIRED_COLUMNS)) {
    try {
      const columns = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${table})`,
      );
      const columnNames = columns.map((c) => c.name);
      const missing = requiredCols.filter((col) => !columnNames.includes(col));

      results.push({
        tableName: table,
        exists: columns.length > 0,
        missingColumns: missing,
        allColumns: columnNames,
      });
    } catch {
      results.push({
        tableName: table,
        exists: false,
        missingColumns: requiredCols,
        allColumns: [],
      });
    }
  }

  return results;
}

export async function getMigrationVersions(db: RepairDatabase): Promise<number[]> {
  try {
    const rows = await db.getAllAsync<{ version: number }>(
      'SELECT version FROM schema_migrations ORDER BY version ASC',
    );
    return rows.map((r) => r.version);
  } catch {
    return [];
  }
}

async function ensureTableExists(db: RepairDatabase, tableName: string): Promise<void> {
  const createStatements: Record<string, string> = {
    account_profile_cache: `
      CREATE TABLE IF NOT EXISTS account_profile_cache (
        user_id TEXT PRIMARY KEY NOT NULL,
        display_name TEXT,
        phone_masked TEXT,
        liftmark_id TEXT,
        age INTEGER,
        gender TEXT,
        avatar_url TEXT,
        avatar_thumb_url TEXT,
        avatar_local_uri TEXT,
        avatar_updated_at TEXT,
        updated_at TEXT NOT NULL
      );
    `,
    body_metrics: `
      CREATE TABLE IF NOT EXISTS body_metrics (
        id TEXT PRIMARY KEY,
        member_id TEXT NOT NULL,
        date TEXT NOT NULL,
        weight_kg REAL,
        body_fat_percent REAL,
        chest_cm REAL,
        waist_cm REAL,
        hip_cm REAL,
        bicep_cm REAL,
        thigh_cm REAL,
        calf_cm REAL,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
  };

  if (createStatements[tableName]) {
    await db.execAsync(createStatements[tableName]);
  }
}

export async function ensureLocalSchemaCompatibility(db: RepairDatabase | MigrationCompatible): Promise<void> {
  for (const [tableName, columnDefs] of Object.entries(COLUMN_DEFINITIONS)) {
    await ensureTableExists(db, tableName);

    try {
      const existingColumns = await db.getAllAsync<{ name: string }>(
        `PRAGMA table_info(${tableName})`,
      );
      const existingColumnNames = new Set(existingColumns.map((c) => c.name));

      for (const definition of Object.values(columnDefs)) {
        const colName = definition.split(' ')[0];
        if (!existingColumnNames.has(colName)) {
          await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`);
        }
      }
    } catch (error) {
      console.warn(`[schemaRepair] Failed to repair table ${tableName}:`, error);
    }
  }
}
