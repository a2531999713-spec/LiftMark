import type { SQLiteDatabase } from 'expo-sqlite';

import { ensureLocalSchemaCompatibility } from './schemaRepair';
import { initialSchemaSql } from './schema';

type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getAllAsync'>;

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
          'Legacy 四天兼容计划',
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
  {
    version: 6,
    name: 'account_and_member_avatar_cache',
    async up(db) {
      const profileColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(member_profiles)',
      );
      const columnNames = new Set(profileColumns.map((column) => column.name));

      if (!columnNames.has('avatar_url')) {
        await db.execAsync('ALTER TABLE member_profiles ADD COLUMN avatar_url TEXT;');
      }
      if (!columnNames.has('avatar_thumb_url')) {
        await db.execAsync('ALTER TABLE member_profiles ADD COLUMN avatar_thumb_url TEXT;');
      }
      if (!columnNames.has('avatar_local_uri')) {
        await db.execAsync('ALTER TABLE member_profiles ADD COLUMN avatar_local_uri TEXT;');
      }
      if (!columnNames.has('avatar_updated_at')) {
        await db.execAsync('ALTER TABLE member_profiles ADD COLUMN avatar_updated_at TEXT;');
      }

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS account_profile_cache (
          user_id TEXT PRIMARY KEY NOT NULL,
          display_name TEXT,
          phone_masked TEXT,
          liftmark_id TEXT,
          avatar_url TEXT,
          avatar_thumb_url TEXT,
          avatar_local_uri TEXT,
          avatar_updated_at TEXT,
          updated_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 7,
    name: 'workout_session_training_mode',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(workout_sessions)',
      );
      const hasTrainingMode = columns.some((column) => column.name === 'training_mode');

      if (!hasTrainingMode) {
        await db.execAsync("ALTER TABLE workout_sessions ADD COLUMN training_mode TEXT NOT NULL DEFAULT 'group_local';");
      }
    },
  },
  {
    version: 8,
    name: 'workout_set_rest_and_body_metrics',
    async up(db) {
      const setColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(workout_sets)',
      );
      const setColumnNames = new Set(setColumns.map((column) => column.name));

      if (!setColumnNames.has('actual_rest_seconds')) {
        await db.execAsync('ALTER TABLE workout_sets ADD COLUMN actual_rest_seconds INTEGER;');
      }

      await db.execAsync(`
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

        CREATE INDEX IF NOT EXISTS idx_body_metrics_member_date ON body_metrics(member_id, date);
      `);
    },
  },
  {
    version: 9,
    name: 'body_metric_goals',
    async up(db) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS body_metric_goals (
          id TEXT PRIMARY KEY,
          member_id TEXT NOT NULL,
          goal_type TEXT NOT NULL,
          target_weight_kg REAL,
          target_date TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_body_metric_goals_member ON body_metric_goals(member_id);
      `);
    },
  },
  {
    version: 10,
    name: 'cloud_sync_metadata_and_queue',
    async up(db) {
      const columnsByTable: Record<string, string[]> = {
        groups: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
        ],
        group_members: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
        ],
        plan_templates: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'sync_version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
        ],
        workout_sessions: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
        ],
        workout_exercise_records: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
          'updated_at TEXT',
        ],
        workout_sets: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
        ],
        body_metrics: [
          'remote_id TEXT',
          "sync_status TEXT NOT NULL DEFAULT 'local_only'",
          'sync_error TEXT',
          'version INTEGER NOT NULL DEFAULT 0',
          'last_synced_at TEXT',
          'deleted_at TEXT',
        ],
      };

      for (const [tableName, columnDefinitions] of Object.entries(columnsByTable)) {
        const existingColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
          `PRAGMA table_info(${tableName})`,
        );
        const existingColumnNames = new Set(existingColumns.map((column) => column.name));

        for (const definition of columnDefinitions) {
          const columnName = definition.split(' ')[0];
          if (!existingColumnNames.has(columnName)) {
            await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`);
          }
        }
      }

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS local_sync_queue (
          id TEXT PRIMARY KEY,
          entity_type TEXT NOT NULL,
          local_id TEXT NOT NULL,
          remote_id TEXT,
          operation TEXT NOT NULL,
          status TEXT NOT NULL,
          payload TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          sync_error TEXT,
          last_attempted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_local_sync_queue_status ON local_sync_queue(status, updated_at);
        CREATE INDEX IF NOT EXISTS idx_local_sync_queue_entity ON local_sync_queue(entity_type, local_id);
      `);
    },
  },
  {
    version: 11,
    name: 'group_member_avatar_url_compat',
    async up(db) {
      const memberColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(group_members)',
      );
      const columnNames = new Set(memberColumns.map((column) => column.name));

      if (!columnNames.has('avatar_url')) {
        await db.execAsync('ALTER TABLE group_members ADD COLUMN avatar_url TEXT;');
      }
    },
  },
  {
    version: 12,
    name: 'group_member_identity_fields',
    async up(db) {
      const memberColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(group_members)',
      );
      const columnNames = new Set(memberColumns.map((column) => column.name));

      const columnDefinitions = [
        'user_id TEXT',
        "member_type TEXT NOT NULL DEFAULT 'local'",
        'local_member_id TEXT',
        'joined_at TEXT',
      ];

      for (const definition of columnDefinitions) {
        const columnName = definition.split(' ')[0];
        if (!columnNames.has(columnName)) {
          await db.execAsync(`ALTER TABLE group_members ADD COLUMN ${definition};`);
        }
      }

      await db.execAsync(`
        UPDATE group_members
        SET member_type = CASE
              WHEN user_id IS NOT NULL AND user_id != '' THEN 'real'
              ELSE 'local'
            END,
            local_member_id = CASE
              WHEN user_id IS NULL OR user_id = '' THEN COALESCE(local_member_id, id)
              ELSE local_member_id
            END,
            joined_at = COALESCE(joined_at, created_at)
        WHERE member_type IS NULL OR local_member_id IS NULL OR joined_at IS NULL;

        CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(group_id, user_id);
      `);
    },
  },
  {
    version: 13,
    name: 'local_schema_repair',
    async up(db) {
      await ensureLocalSchemaCompatibility(db);
    },
  },
  {
    version: 14,
    name: 'account_profile_demographics',
    async up(db) {
      const profileColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(account_profile_cache)',
      );
      const columnNames = new Set(profileColumns.map((column) => column.name));

      if (!columnNames.has('age')) {
        await db.execAsync('ALTER TABLE account_profile_cache ADD COLUMN age INTEGER;');
      }
      if (!columnNames.has('gender')) {
        await db.execAsync('ALTER TABLE account_profile_cache ADD COLUMN gender TEXT;');
      }
    },
  },
  {
    version: 15,
    name: 'account_data_isolation',
    async up(db) {
      const ownerColumnsByTable: Record<string, string[]> = {
        group_members: ['owner_user_id TEXT'],
        member_profiles: ['owner_user_id TEXT'],
        plan_templates: ['owner_user_id TEXT'],
        plan_phases: ['owner_user_id TEXT'],
        plan_days: ['owner_user_id TEXT'],
        plan_exercises: ['owner_user_id TEXT'],
        workout_sessions: ['owner_user_id TEXT'],
        workout_exercise_records: ['owner_user_id TEXT'],
        workout_sets: ['owner_user_id TEXT'],
        progression_suggestions: ['owner_user_id TEXT'],
        recovery_logs: ['owner_user_id TEXT'],
        body_metrics: ['owner_user_id TEXT'],
        body_metric_goals: ['owner_user_id TEXT'],
        local_sync_queue: ['owner_user_id TEXT'],
      };

      for (const [tableName, columnDefinitions] of Object.entries(ownerColumnsByTable)) {
        const existingColumns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
          `PRAGMA table_info(${tableName})`,
        );
        const existingColumnNames = new Set(existingColumns.map((column) => column.name));

        for (const definition of columnDefinitions) {
          const columnName = definition.split(' ')[0];
          if (!existingColumnNames.has(columnName)) {
            await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`);
          }
        }
      }

      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_user_id, created_at);
        CREATE INDEX IF NOT EXISTS idx_group_members_owner ON group_members(owner_user_id, group_id);
        CREATE INDEX IF NOT EXISTS idx_member_profiles_owner ON member_profiles(owner_user_id, group_id);
        CREATE INDEX IF NOT EXISTS idx_plan_templates_owner ON plan_templates(owner_user_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_owner_date ON workout_sessions(owner_user_id, date);
        CREATE INDEX IF NOT EXISTS idx_workout_sets_owner ON workout_sets(owner_user_id, updated_at);
        CREATE INDEX IF NOT EXISTS idx_body_metrics_owner_date ON body_metrics(owner_user_id, date);
        CREATE INDEX IF NOT EXISTS idx_local_sync_queue_owner_status ON local_sync_queue(owner_user_id, status, updated_at);
      `);
    },
  },
  {
    version: 16,
    name: 'fix_account_ownership',
    async up(db) {
      // 1. group_members: 以 user_id 为准修正归属（回填 NULL + 修正被错误覆盖的）
      await db.execAsync(`
        UPDATE group_members
        SET owner_user_id = user_id
        WHERE user_id IS NOT NULL AND user_id != ''
          AND (owner_user_id IS NULL OR owner_user_id != user_id);
      `);

      // 2. member_profiles: 继承对应 group_members 的 user_id
      await db.execAsync(`
        UPDATE member_profiles
        SET owner_user_id = (
          SELECT gm.user_id FROM group_members gm WHERE gm.id = member_profiles.member_id
        )
        WHERE EXISTS (
          SELECT 1 FROM group_members gm
          WHERE gm.id = member_profiles.member_id
            AND gm.user_id IS NOT NULL AND gm.user_id != ''
            AND (member_profiles.owner_user_id IS NULL OR member_profiles.owner_user_id != gm.user_id)
        );
      `);

      // 3. workout_sessions: NULL 归属回填为小组 owner_user_id
      await db.execAsync(`
        UPDATE workout_sessions
        SET owner_user_id = (
          SELECT g.owner_user_id FROM groups g WHERE g.id = workout_sessions.group_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            WHERE g.id = workout_sessions.group_id AND g.owner_user_id IS NOT NULL
          );
      `);

      // 4. workout_exercise_records: NULL 归属回填为对应 session 的小组 owner_user_id
      await db.execAsync(`
        UPDATE workout_exercise_records
        SET owner_user_id = (
          SELECT g.owner_user_id
          FROM groups g
          INNER JOIN workout_sessions ws ON ws.group_id = g.id
          WHERE ws.id = workout_exercise_records.session_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            INNER JOIN workout_sessions ws ON ws.group_id = g.id
            WHERE ws.id = workout_exercise_records.session_id AND g.owner_user_id IS NOT NULL
          );
      `);

      // 5. workout_sets: NULL 归属回填
      await db.execAsync(`
        UPDATE workout_sets
        SET owner_user_id = (
          SELECT g.owner_user_id
          FROM groups g
          INNER JOIN workout_sessions ws ON ws.group_id = g.id
          WHERE ws.id = workout_sets.session_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM groups g
            INNER JOIN workout_sessions ws ON ws.group_id = g.id
            WHERE ws.id = workout_sets.session_id AND g.owner_user_id IS NOT NULL
          );
      `);

      // 6. plan_templates: NULL 归属回填为 creator_id
      await db.execAsync(`
        UPDATE plan_templates
        SET owner_user_id = creator_id
        WHERE owner_user_id IS NULL AND creator_id IS NOT NULL AND creator_id != '';
      `);

      // 7. plan_days: NULL 归属回填为对应 plan 的归属
      await db.execAsync(`
        UPDATE plan_days
        SET owner_user_id = (
          SELECT COALESCE(pt.owner_user_id, pt.creator_id)
          FROM plan_templates pt WHERE pt.id = plan_days.plan_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM plan_templates pt
            WHERE pt.id = plan_days.plan_id
              AND COALESCE(pt.owner_user_id, pt.creator_id) IS NOT NULL
          );
      `);

      // 8. plan_exercises: NULL 归属回填
      await db.execAsync(`
        UPDATE plan_exercises
        SET owner_user_id = (
          SELECT COALESCE(pt.owner_user_id, pt.creator_id)
          FROM plan_templates pt
          INNER JOIN plan_days pd ON pd.plan_id = pt.id
          WHERE pd.id = plan_exercises.plan_day_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM plan_templates pt
            INNER JOIN plan_days pd ON pd.plan_id = pt.id
            WHERE pd.id = plan_exercises.plan_day_id
              AND COALESCE(pt.owner_user_id, pt.creator_id) IS NOT NULL
          );
      `);

      // 9. body_metrics: NULL 归属回填为对应 member 的 user_id
      await db.execAsync(`
        UPDATE body_metrics
        SET owner_user_id = (
          SELECT gm.user_id FROM group_members gm WHERE gm.id = body_metrics.member_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.id = body_metrics.member_id
              AND gm.user_id IS NOT NULL AND gm.user_id != ''
          );
      `);

      // 10. body_metric_goals: NULL 归属回填
      await db.execAsync(`
        UPDATE body_metric_goals
        SET owner_user_id = (
          SELECT gm.user_id FROM group_members gm WHERE gm.id = body_metric_goals.member_id
        )
        WHERE owner_user_id IS NULL
          AND EXISTS (
            SELECT 1 FROM group_members gm
            WHERE gm.id = body_metric_goals.member_id
              AND gm.user_id IS NOT NULL AND gm.user_id != ''
          );
      `);
    },
  },
  {
    version: 17,
    name: 'sync_state_table',
    async up(db) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sync_state (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL UNIQUE,
          value TEXT,
          updated_at TEXT NOT NULL
        );
      `);
    },
  },
  {
    version: 18,
    name: 'user_preferences_table',
    async up(db) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS user_preferences (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          weight_unit TEXT NOT NULL DEFAULT 'kg',
          default_record_target TEXT NOT NULL DEFAULT 'group_members',
          rest_timer_enabled INTEGER NOT NULL DEFAULT 1,
          default_training_mode TEXT NOT NULL DEFAULT 'full',
          weight_increment TEXT NOT NULL DEFAULT '2.5kg',
          effort_display TEXT NOT NULL DEFAULT 'none',
          remote_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'local_only',
          sync_error TEXT,
          version INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_user_preferences_owner ON user_preferences(owner_user_id, updated_at);
      `);
    },
  },
  {
    version: 19,
    name: 'body_metric_goals_sync_columns',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(body_metric_goals)',
      );
      const columnNames = new Set(columns.map((column) => column.name));

      const columnDefinitions = [
        'remote_id TEXT',
        "sync_status TEXT NOT NULL DEFAULT 'local_only'",
        'sync_error TEXT',
        'version INTEGER NOT NULL DEFAULT 0',
        'last_synced_at TEXT',
        'deleted_at TEXT',
      ];

      for (const definition of columnDefinitions) {
        const columnName = definition.split(' ')[0];
        if (!columnNames.has(columnName)) {
          await db.execAsync(`ALTER TABLE body_metric_goals ADD COLUMN ${definition};`);
        }
      }
    },
  },
  {
    version: 20,
    name: 'plan_phases_sync_columns',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(plan_phases)',
      );
      const columnNames = new Set(columns.map((column) => column.name));

      const columnDefinitions = [
        'remote_id TEXT',
        "sync_status TEXT NOT NULL DEFAULT 'local_only'",
        'sync_error TEXT',
        'version INTEGER NOT NULL DEFAULT 0',
        'last_synced_at TEXT',
        'deleted_at TEXT',
        'created_at TEXT',
        'updated_at TEXT',
      ];

      for (const definition of columnDefinitions) {
        const columnName = definition.split(' ')[0];
        if (!columnNames.has(columnName)) {
          await db.execAsync(`ALTER TABLE plan_phases ADD COLUMN ${definition};`);
        }
      }

      // 回填 created_at/updated_at 默认值
      await db.execAsync(`
        UPDATE plan_phases SET created_at = COALESCE(created_at, datetime('now')) WHERE created_at IS NULL;
        UPDATE plan_phases SET updated_at = COALESCE(updated_at, datetime('now')) WHERE updated_at IS NULL;
      `);
    },
  },
  {
    version: 21,
    name: 'recovery_logs_sync_columns',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(recovery_logs)',
      );
      const columnNames = new Set(columns.map((column) => column.name));

      const columnDefinitions = [
        'remote_id TEXT',
        "sync_status TEXT NOT NULL DEFAULT 'local_only'",
        'sync_error TEXT',
        'version INTEGER NOT NULL DEFAULT 0',
        'last_synced_at TEXT',
        'deleted_at TEXT',
        'updated_at TEXT',
      ];

      for (const definition of columnDefinitions) {
        const columnName = definition.split(' ')[0];
        if (!columnNames.has(columnName)) {
          await db.execAsync(`ALTER TABLE recovery_logs ADD COLUMN ${definition};`);
        }
      }

      await db.execAsync(`
        UPDATE recovery_logs SET updated_at = COALESCE(updated_at, created_at) WHERE updated_at IS NULL;
      `);
    },
  },
  {
    version: 22,
    name: 'progression_suggestions_sync_columns',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(progression_suggestions)',
      );
      const columnNames = new Set(columns.map((column) => column.name));

      const columnDefinitions = [
        'remote_id TEXT',
        "sync_status TEXT NOT NULL DEFAULT 'local_only'",
        'sync_error TEXT',
        'version INTEGER NOT NULL DEFAULT 0',
        'last_synced_at TEXT',
        'deleted_at TEXT',
        'updated_at TEXT',
      ];

      for (const definition of columnDefinitions) {
        const columnName = definition.split(' ')[0];
        if (!columnNames.has(columnName)) {
          await db.execAsync(`ALTER TABLE progression_suggestions ADD COLUMN ${definition};`);
        }
      }

      await db.execAsync(`
        UPDATE progression_suggestions SET updated_at = COALESCE(updated_at, created_at) WHERE updated_at IS NULL;
      `);
    },
  },
  {
    version: 23,
    name: 'core_scope_cycles_reports_reminders',
    async up(db) {
      async function addColumns(tableName: string, definitions: string[]) {
        const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
          `PRAGMA table_info(${tableName})`,
        );
        const columnNames = new Set(columns.map((column) => column.name));
        for (const definition of definitions) {
          const columnName = definition.split(' ')[0];
          if (!columnNames.has(columnName)) {
            await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${definition};`);
          }
        }
      }

      await addColumns('plan_templates', [
        "status TEXT NOT NULL DEFAULT 'active'",
      ]);

      await addColumns('workout_sessions', [
        'plan_cycle_id TEXT',
        'plan_day_id TEXT',
        'recorded_by_user_id TEXT',
        'source_device_id TEXT',
      ]);

      await addColumns('workout_exercise_records', [
        'plan_cycle_id TEXT',
        'plan_day_id TEXT',
      ]);

      await addColumns('workout_sets', [
        'recorded_by_user_id TEXT',
        'source_device_id TEXT',
      ]);

      await addColumns('exercises', [
        'source_id TEXT',
        'name_zh TEXT',
        'name_en TEXT',
        'aliases TEXT',
        'force_type TEXT',
        'primary_muscle TEXT',
        'secondary_muscles TEXT',
        'is_unilateral INTEGER NOT NULL DEFAULT 0',
        'is_bodyweight INTEGER NOT NULL DEFAULT 0',
        'default_unit TEXT',
        'instructions_zh TEXT',
        'instructions_en TEXT',
        'tips TEXT',
        'thumbnail_url TEXT',
        'gif_url TEXT',
        'video_url TEXT',
        'local_asset_path TEXT',
        'media_source TEXT',
        'media_license TEXT',
        'media_attribution TEXT',
        'media_usage_status TEXT',
        'icon_key TEXT',
        'heatmap_key TEXT',
        'muscle_activation_json TEXT',
        'is_system INTEGER NOT NULL DEFAULT 1',
        'is_custom INTEGER NOT NULL DEFAULT 0',
        'created_by_user_id TEXT',
      ]);

      await db.execAsync(`
        UPDATE exercises
        SET primary_muscle = COALESCE(primary_muscle, target_muscle),
            secondary_muscles = COALESCE(secondary_muscles, secondary_muscle),
            icon_key = COALESCE(icon_key, lower(COALESCE(target_muscle, 'other')) || ':' || lower(COALESCE(movement_pattern, 'other'))),
            is_system = CASE WHEN source = 'system' THEN 1 ELSE COALESCE(is_system, 0) END,
            is_custom = CASE WHEN source = 'custom' THEN 1 ELSE COALESCE(is_custom, 0) END
        WHERE primary_muscle IS NULL
           OR secondary_muscles IS NULL
           OR icon_key IS NULL
           OR is_system IS NULL
           OR is_custom IS NULL;
      `);

      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS plan_cycles (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          group_id TEXT NOT NULL,
          plan_id TEXT NOT NULL,
          cycle_index INTEGER NOT NULL DEFAULT 1,
          name TEXT NOT NULL,
          start_date TEXT NOT NULL,
          end_date TEXT,
          planned_weeks INTEGER NOT NULL DEFAULT 1,
          actual_start_date TEXT,
          actual_end_date TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          completed_at TEXT,
          archived_at TEXT,
          remote_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'local_only',
          sync_error TEXT,
          version INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS plan_cycle_summaries (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          group_id TEXT NOT NULL,
          plan_id TEXT NOT NULL,
          plan_cycle_id TEXT NOT NULL,
          planned_workout_count INTEGER NOT NULL DEFAULT 0,
          completed_workout_count INTEGER NOT NULL DEFAULT 0,
          skipped_workout_count INTEGER NOT NULL DEFAULT 0,
          completion_rate REAL NOT NULL DEFAULT 0,
          total_volume REAL NOT NULL DEFAULT 0,
          total_sets INTEGER NOT NULL DEFAULT 0,
          total_reps INTEGER NOT NULL DEFAULT 0,
          total_duration_seconds INTEGER NOT NULL DEFAULT 0,
          estimated_calories REAL NOT NULL DEFAULT 0,
          top_progress_exercises_json TEXT,
          weak_exercises_json TEXT,
          muscle_group_distribution_json TEXT,
          summary_text TEXT,
          remote_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'local_only',
          sync_error TEXT,
          version INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS training_reports (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          group_id TEXT NOT NULL,
          member_id TEXT,
          plan_id TEXT NOT NULL,
          plan_cycle_id TEXT,
          workout_session_id TEXT NOT NULL,
          report_date TEXT NOT NULL,
          duration_seconds INTEGER NOT NULL DEFAULT 0,
          total_volume REAL NOT NULL DEFAULT 0,
          total_sets INTEGER NOT NULL DEFAULT 0,
          total_reps INTEGER NOT NULL DEFAULT 0,
          exercise_count INTEGER NOT NULL DEFAULT 0,
          estimated_calories REAL NOT NULL DEFAULT 0,
          estimated_calories_min REAL NOT NULL DEFAULT 0,
          estimated_calories_max REAL NOT NULL DEFAULT 0,
          intensity_level TEXT NOT NULL DEFAULT 'medium',
          muscle_group_summary_json TEXT,
          exercise_summary_json TEXT,
          personal_records_json TEXT,
          notes TEXT,
          remote_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'local_only',
          sync_error TEXT,
          version INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS training_reminders (
          id TEXT PRIMARY KEY,
          owner_user_id TEXT,
          group_id TEXT,
          plan_id TEXT,
          plan_cycle_id TEXT,
          type TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          weekday INTEGER,
          remind_time TEXT,
          minutes_before INTEGER,
          timezone TEXT NOT NULL DEFAULT 'Asia/Shanghai',
          title_template TEXT NOT NULL,
          body_template TEXT NOT NULL,
          last_scheduled_at TEXT,
          last_fired_at TEXT,
          remote_id TEXT,
          sync_status TEXT NOT NULL DEFAULT 'local_only',
          sync_error TEXT,
          version INTEGER NOT NULL DEFAULT 0,
          last_synced_at TEXT,
          deleted_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_plan_cycles_owner_group ON plan_cycles(owner_user_id, group_id, status);
        CREATE INDEX IF NOT EXISTS idx_plan_cycle_summaries_cycle ON plan_cycle_summaries(plan_cycle_id);
        CREATE INDEX IF NOT EXISTS idx_workout_sessions_cycle ON workout_sessions(plan_cycle_id, date);
        CREATE INDEX IF NOT EXISTS idx_training_reports_session ON training_reports(workout_session_id);
        CREATE INDEX IF NOT EXISTS idx_training_reports_owner_date ON training_reports(owner_user_id, report_date);
        CREATE INDEX IF NOT EXISTS idx_training_reports_cycle ON training_reports(plan_cycle_id, report_date);
        CREATE INDEX IF NOT EXISTS idx_training_reminders_owner_enabled ON training_reminders(owner_user_id, enabled);
      `);
    },
  },
  {
    version: 24,
    name: 'training_reminder_device_schedule_metadata',
    async up(db) {
      const columns = await (db as SQLiteDatabase).getAllAsync<{ name: string }>(
        'PRAGMA table_info(training_reminders)',
      );
      if (!columns.some((column) => column.name === 'notification_ids_json')) {
        // Expo notification identifiers belong to this device only. They are intentionally
        // excluded from the sync registry and only let us cancel schedules we created.
        await db.execAsync('ALTER TABLE training_reminders ADD COLUMN notification_ids_json TEXT;');
      }
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
