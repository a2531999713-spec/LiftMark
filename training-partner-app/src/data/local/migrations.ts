import type { SQLiteDatabase } from 'expo-sqlite';

import { initialSchemaSql } from './schema';

type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync' | 'runAsync'>;

export type Migration = {
  version: number;
  name: string;
  up(db: MigrationDatabase): Promise<void>;
};

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    async up(db) {
      await db.execAsync(initialSchemaSql);
    },
  },
  {
    version: 2,
    name: 'plan_system_scheme_origin',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(plan_templates)',
      );
      const hasOriginSchemeId = columns.some((column) => column.name === 'origin_scheme_id');

      if (!hasOriginSchemeId) {
        await db.execAsync('ALTER TABLE plan_templates ADD COLUMN origin_scheme_id TEXT;');
      }

      await db.execAsync(`
        INSERT OR IGNORE INTO plan_templates (
          id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        )
        SELECT
          'plan_user_four_day_strength_hypertrophy_default',
          '四练增力增肌计划',
          creator_id,
          'private',
          goal,
          duration_weeks,
          frequency_per_week,
          description,
          'system_copy',
          'scheme_four_day_strength_hypertrophy',
          version,
          created_at,
          datetime('now')
        FROM plan_templates
        WHERE id = 'plan_four_day_strength_hypertrophy';

        INSERT OR IGNORE INTO plan_phases (
          id, plan_id, name, type, start_week, end_week, order_index
        )
        SELECT
          'user_' || id,
          'plan_user_four_day_strength_hypertrophy_default',
          name,
          type,
          start_week,
          end_week,
          order_index
        FROM plan_phases
        WHERE plan_id = 'plan_four_day_strength_hypertrophy';

        INSERT OR IGNORE INTO plan_days (
          id, plan_id, phase_id, week, weekday, title, focus, notes
        )
        SELECT
          'user_' || id,
          'plan_user_four_day_strength_hypertrophy_default',
          'user_' || phase_id,
          week,
          weekday,
          title,
          focus,
          notes
        FROM plan_days
        WHERE plan_id = 'plan_four_day_strength_hypertrophy';

        INSERT OR IGNORE INTO plan_exercises (
          id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
          intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
          rest_seconds, progression_rule_id, notes
        )
        SELECT
          'user_' || plan_exercises.id,
          'user_' || plan_day_id,
          exercise_id,
          priority,
          order_index,
          sets,
          reps,
          rep_min,
          rep_max,
          intensity_type,
          percent_1rm,
          rpe_target,
          rir_target,
          fixed_weight,
          reference_lift,
          rest_seconds,
          progression_rule_id,
          plan_exercises.notes
        FROM plan_exercises
        INNER JOIN plan_days ON plan_days.id = plan_exercises.plan_day_id
        WHERE plan_days.plan_id = 'plan_four_day_strength_hypertrophy';

        UPDATE groups
        SET active_plan_id = 'plan_user_four_day_strength_hypertrophy_default',
            updated_at = datetime('now')
        WHERE active_plan_id = 'plan_four_day_strength_hypertrophy';
      `);
    },
  },
  {
    version: 3,
    name: 'friday_strategy_and_activation_state',
    async up(db) {
      const groupColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(groups)',
      );
      const hasFridayStrategy = groupColumns.some((column) => column.name === 'friday_strategy');

      if (!hasFridayStrategy) {
        await db.execAsync("ALTER TABLE groups ADD COLUMN friday_strategy TEXT NOT NULL DEFAULT 'default_rest';");
        await db.execAsync(`
          UPDATE groups
          SET friday_strategy = CASE
            WHEN friday_enabled = 1 THEN 'allow_weak'
            ELSE 'default_rest'
          END
        `);
      }

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS activation_state (
          id TEXT PRIMARY KEY,
          is_activated INTEGER NOT NULL DEFAULT 0,
          activation_code TEXT,
          activated_at TEXT,
          trial_started_at TEXT NOT NULL,
          trial_expires_at TEXT NOT NULL,
          device_id TEXT NOT NULL,
          app_version TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 4,
    name: 'workout_record_rest_time_snapshot',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(workout_exercise_records)',
      );
      const hasPlannedRestSeconds = columns.some((column) => column.name === 'planned_rest_seconds');

      if (!hasPlannedRestSeconds) {
        await db.execAsync('ALTER TABLE workout_exercise_records ADD COLUMN planned_rest_seconds INTEGER;');
      }
    },
  },
  {
    version: 5,
    name: 'exercise_source_for_custom_library',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(exercises)',
      );
      const hasSource = columns.some((column) => column.name === 'source');

      if (!hasSource) {
        await db.execAsync("ALTER TABLE exercises ADD COLUMN source TEXT NOT NULL DEFAULT 'system';");
      }

      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_exercises_source_name ON exercises(source, name);',
      );
    },
  },
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);

  const appliedRows = await db.getAllAsync<{ version: number }>(
    'SELECT version FROM schema_migrations ORDER BY version ASC',
  );
  const appliedVersions = new Set(appliedRows.map((row) => row.version));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      await migration.up(txn);
      await txn.runAsync(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)',
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    });
  }
}
