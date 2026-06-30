import type { Knex } from 'knex';

import { closeDb, db } from './connection';

type Table = Knex.CreateTableBuilder;

function timestamps(table: Table, knex: Knex | Knex.Transaction) {
  table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
  table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
}

async function ensureMigrationsTable() {
  const exists = await db.schema.hasTable('schema_migrations');
  if (!exists) {
    await db.schema.createTable('schema_migrations', (table) => {
      table.string('name').primary();
      table.timestamp('applied_at', { useTz: true }).notNullable().defaultTo(db.fn.now());
    });
  }
}

async function runMigration(name: string, migration: (trx: Knex.Transaction) => Promise<void>) {
  const alreadyApplied = await db('schema_migrations').where({ name }).first();
  if (alreadyApplied) return;

  await db.transaction(async (trx) => {
    await migration(trx);
    await trx('schema_migrations').insert({ name });
  });
  console.log(`Applied migration: ${name}`);
}

async function createInitialSchema(trx: Knex.Transaction) {
  if (!(await trx.schema.hasTable('users'))) {
    await trx.schema.createTable('users', (table) => {
      table.string('id').primary();
      table.string('phone').unique();
      table.string('email').unique();
      table.string('password_hash');
      table.string('nickname').notNullable();
      table.string('avatar_url');
      table.string('liftmark_id').notNullable().unique();
      table.integer('registration_seq').unique();
      table.timestamp('registered_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.string('registration_source').notNullable().defaultTo('app');
      table.string('campaign_code');
      table.string('early_user_tier').notNullable().defaultTo('standard');
      table.string('role').notNullable().defaultTo('user');
      table.string('status').notNullable().defaultTo('normal');
      table.timestamp('last_login_at', { useTz: true });
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('refresh_tokens'))) {
    await trx.schema.createTable('refresh_tokens', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('token_hash').notNullable().unique();
      table.timestamp('expires_at', { useTz: true }).notNullable();
      table.timestamp('revoked_at', { useTz: true });
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
    });
  }

  if (!(await trx.schema.hasTable('sms_verification_logs'))) {
    await trx.schema.createTable('sms_verification_logs', (table) => {
      table.string('id').primary();
      table.string('phone').notNullable();
      table.string('purpose').notNullable();
      table.string('provider').notNullable();
      table.string('out_id');
      table.string('biz_id');
      table.timestamp('sent_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.timestamp('verified_at', { useTz: true });
      table.string('status').notNullable().defaultTo('sent');
      table.string('ip_address');
      table.string('debug_code_hash');
      table.timestamp('expires_at', { useTz: true });
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
    });
  }

  if (!(await trx.schema.hasTable('memberships'))) {
    await trx.schema.createTable('memberships', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable().unique().references('id').inTable('users').onDelete('CASCADE');
      table.string('type').notNullable().defaultTo('free');
      table.string('source').notNullable().defaultTo('admin_grant');
      table.timestamp('starts_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.timestamp('expires_at', { useTz: true });
      table.boolean('is_lifetime').notNullable().defaultTo(false);
      table.integer('pro_group_limit').notNullable().defaultTo(0);
      table.integer('activated_pro_group_count').notNullable().defaultTo(0);
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('activation_codes'))) {
    await trx.schema.createTable('activation_codes', (table) => {
      table.string('id').primary();
      table.string('code_hash').notNullable().unique();
      table.string('code_prefix').notNullable();
      table.string('membership_type').notNullable().defaultTo('pro');
      table.integer('duration_days');
      table.boolean('is_lifetime').notNullable().defaultTo(false);
      table.integer('pro_group_limit').notNullable().defaultTo(2);
      table.integer('max_redemptions').notNullable().defaultTo(1);
      table.integer('redeemed_count').notNullable().defaultTo(0);
      table.string('created_by_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.timestamp('disabled_at', { useTz: true });
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('activation_code_redemptions'))) {
    await trx.schema.createTable('activation_code_redemptions', (table) => {
      table.string('id').primary();
      table.string('activation_code_id').notNullable().references('id').inTable('activation_codes').onDelete('CASCADE');
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('redeemed_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.unique(['activation_code_id', 'user_id']);
    });
  }

  if (!(await trx.schema.hasTable('payment_orders'))) {
    await trx.schema.createTable('payment_orders', (table) => {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('provider').notNullable().defaultTo('payment_reserved');
      table.string('status').notNullable().defaultTo('reserved');
      table.integer('amount_cents').notNullable().defaultTo(0);
      table.string('currency').notNullable().defaultTo('CNY');
      table.specificType('payload', 'jsonb').notNullable().defaultTo('{}');
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('groups'))) {
    await trx.schema.createTable('groups', (table) => {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('owner_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('activated_by_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.boolean('membership_enabled').notNullable().defaultTo(false);
      table.integer('member_limit').notNullable().defaultTo(2);
      table.integer('group_limit').notNullable().defaultTo(1);
      table.string('invite_code').unique();
      table.timestamp('deleted_at', { useTz: true });
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('group_members'))) {
    await trx.schema.createTable('group_members', (table) => {
      table.string('id').primary();
      table.string('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE');
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('role').notNullable().defaultTo('member');
      table.string('status').notNullable().defaultTo('active');
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.timestamp('left_at', { useTz: true });
      timestamps(table, trx);
      table.unique(['group_id', 'user_id']);
    });
  }

  await createSyncTables(trx);
  await createContentTables(trx);
  await createIndexes(trx);
}

async function addRegistrationMetadata(trx: Knex.Transaction) {
  await trx.raw('CREATE SEQUENCE IF NOT EXISTS users_registration_seq START WITH 1');

  const columnDefinitions: Array<[string, (table: Knex.AlterTableBuilder) => void]> = [
    ['registration_seq', (table) => table.integer('registration_seq')],
    ['registered_at', (table) => table.timestamp('registered_at', { useTz: true })],
    ['registration_source', (table) => table.string('registration_source')],
    ['campaign_code', (table) => table.string('campaign_code')],
    ['early_user_tier', (table) => table.string('early_user_tier')],
  ];

  for (const [columnName, addColumn] of columnDefinitions) {
    if (!(await trx.schema.hasColumn('users', columnName))) {
      await trx.schema.alterTable('users', addColumn);
    }
  }

  await trx.raw(`
    WITH numbered AS (
      SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS seq
      FROM users
      WHERE registration_seq IS NULL
    )
    UPDATE users
    SET registration_seq = numbered.seq,
        registered_at = COALESCE(users.registered_at, users.created_at, now()),
        registration_source = COALESCE(users.registration_source, 'legacy'),
        early_user_tier = CASE
          WHEN numbered.seq <= 100 THEN 'founding_100'
          ELSE COALESCE(users.early_user_tier, 'standard')
        END
    FROM numbered
    WHERE users.id = numbered.id
  `);

  await trx.raw(`
    UPDATE users
    SET registered_at = COALESCE(registered_at, created_at, now()),
        registration_source = COALESCE(registration_source, 'legacy'),
        early_user_tier = COALESCE(early_user_tier, 'standard')
  `);
  await trx.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_registration_seq ON users(registration_seq) WHERE registration_seq IS NOT NULL');
  await trx.raw(`
    SELECT setval(
      'users_registration_seq',
      GREATEST(COALESCE((SELECT MAX(registration_seq) FROM users), 0), 1),
      COALESCE((SELECT MAX(registration_seq) FROM users), 0) > 0
    )
  `);
}

async function createSyncTables(trx: Knex.Transaction) {
  const entityTables = ['exercises', 'workout_sessions', 'workout_sets', 'training_plans', 'plan_days', 'plan_exercises'];

  for (const tableName of entityTables) {
    if (await trx.schema.hasTable(tableName)) continue;
    await trx.schema.createTable(tableName, (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('group_id').references('id').inTable('groups').onDelete('SET NULL');
      table.string('client_id').notNullable();
      table.string('parent_server_id');
      table.string('name');
      table.string('title');
      table.string('status');
      table.string('member_client_id');
      table.string('exercise_client_id');
      table.decimal('actual_weight', 10, 2);
      table.integer('actual_reps');
      table.integer('sync_version').notNullable().defaultTo(1);
      table.timestamp('client_updated_at', { useTz: true });
      table.timestamp('deleted_at', { useTz: true });
      table.specificType('payload', 'jsonb').notNullable().defaultTo('{}');
      timestamps(table, trx);
      table.unique(['user_id', 'client_id']);
    });
  }

  if (!(await trx.schema.hasTable('sync_mappings'))) {
    await trx.schema.createTable('sync_mappings', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('entity_type').notNullable();
      table.string('client_id').notNullable();
      table.string('server_id').notNullable();
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.unique(['user_id', 'entity_type', 'client_id']);
    });
  }

  if (!(await trx.schema.hasTable('sync_state'))) {
    await trx.schema.createTable('sync_state', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('device_id').notNullable();
      table.timestamp('last_pulled_at', { useTz: true });
      table.timestamp('last_pushed_at', { useTz: true });
      table.integer('sync_version').notNullable().defaultTo(1);
      timestamps(table, trx);
      table.unique(['user_id', 'device_id']);
    });
  }

  if (!(await trx.schema.hasTable('training_rooms'))) {
    await trx.schema.createTable('training_rooms', (table) => {
      table.string('id').primary();
      table.string('group_id').references('id').inTable('groups').onDelete('CASCADE');
      table.string('created_by_user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('status').notNullable().defaultTo('reserved');
      table.timestamp('started_at', { useTz: true });
      table.timestamp('ended_at', { useTz: true });
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('training_room_members'))) {
    await trx.schema.createTable('training_room_members', (table) => {
      table.string('id').primary();
      table.string('room_id').notNullable().references('id').inTable('training_rooms').onDelete('CASCADE');
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.timestamp('joined_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
      table.timestamp('left_at', { useTz: true });
    });
  }

  if (!(await trx.schema.hasTable('training_room_events'))) {
    await trx.schema.createTable('training_room_events', (table) => {
      table.string('id').primary();
      table.string('room_id').notNullable().references('id').inTable('training_rooms').onDelete('CASCADE');
      table.string('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('event_type').notNullable();
      table.specificType('payload', 'jsonb').notNullable().defaultTo('{}');
      table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(trx.fn.now());
    });
  }
}

async function createContentTables(trx: Knex.Transaction) {
  if (!(await trx.schema.hasTable('achievement_definitions'))) {
    await trx.schema.createTable('achievement_definitions', (table) => {
      table.string('id').primary();
      table.string('code').notNullable().unique();
      table.string('name').notNullable();
      table.text('description').notNullable();
      table.string('metric').notNullable();
      table.integer('target').notNullable();
      table.boolean('enabled').notNullable().defaultTo(true);
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('user_achievements'))) {
    await trx.schema.createTable('user_achievements', (table) => {
      table.string('id').primary();
      table.string('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE');
      table.string('achievement_definition_id').notNullable().references('id').inTable('achievement_definitions').onDelete('CASCADE');
      table.integer('progress').notNullable().defaultTo(0);
      table.timestamp('achieved_at', { useTz: true });
      timestamps(table, trx);
      table.unique(['user_id', 'achievement_definition_id']);
    });
  }

  if (!(await trx.schema.hasTable('announcements'))) {
    await trx.schema.createTable('announcements', (table) => {
      table.string('id').primary();
      table.string('title').notNullable();
      table.text('content').notNullable();
      table.string('status').notNullable().defaultTo('draft');
      table.timestamp('starts_at', { useTz: true });
      table.timestamp('ends_at', { useTz: true });
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('app_config'))) {
    await trx.schema.createTable('app_config', (table) => {
      table.string('id').primary();
      table.string('key').notNullable().unique();
      table.specificType('value', 'jsonb').notNullable().defaultTo('{}');
      timestamps(table, trx);
    });
  }

  if (!(await trx.schema.hasTable('feedback'))) {
    await trx.schema.createTable('feedback', (table) => {
      table.string('id').primary();
      table.string('user_id').references('id').inTable('users').onDelete('SET NULL');
      table.string('contact');
      table.string('type').notNullable().defaultTo('feedback');
      table.text('content').notNullable();
      table.string('status').notNullable().defaultTo('open');
      table.text('admin_note');
      timestamps(table, trx);
    });
  }
}

async function createIndexes(trx: Knex.Transaction) {
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_sms_phone_sent_at ON sms_verification_logs(phone, sent_at DESC)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_sms_ip_created_at ON sms_verification_logs(ip_address, created_at DESC)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_updated ON workout_sessions(user_id, updated_at DESC)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_workout_sets_user_updated ON workout_sets(user_id, updated_at DESC)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_workout_sets_stats ON workout_sets(group_id, member_client_id, exercise_client_id)');
  await trx.raw('CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(status)');
}

export async function migrate() {
  await ensureMigrationsTable();
  await runMigration('001_initial_cloud_schema', createInitialSchema);
  await runMigration('002_user_registration_metadata', addRegistrationMetadata);
}

if (require.main === module) {
  migrate()
    .then(async () => {
      await closeDb();
      console.log('Database migrations complete.');
    })
    .catch(async (error) => {
      console.error(error);
      await closeDb();
      process.exit(1);
    });
}
