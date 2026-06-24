import { closeDb, db } from './connection';
import { env } from '../config/env';
import { createId, createLiftmarkId } from '../utils/ids';
import { hashPassword } from '../utils/security';

const achievementDefinitions = [
  {
    code: 'first_workout',
    name: '首次完成训练',
    description: '完成并同步第一条训练记录。',
    metric: 'completed_workouts',
    target: 1,
  },
  {
    code: 'streak_3_days',
    name: '连续训练 3 天',
    description: '连续 3 天都有完成训练。',
    metric: 'training_streak_days',
    target: 3,
  },
  {
    code: 'ten_workouts',
    name: '累计完成 10 次训练',
    description: '累计完成 10 次训练。',
    metric: 'completed_workouts',
    target: 10,
  },
  {
    code: 'volume_10000',
    name: '累计训练容量达标',
    description: '累计训练容量达到 10000 kg。',
    metric: 'total_volume',
    target: 10000,
  },
];

async function seedAdmin() {
  if (!env.adminInitialPassword || (!env.adminPhone && !env.adminEmail)) {
    console.log('ADMIN_PHONE/ADMIN_EMAIL/ADMIN_INITIAL_PASSWORD 未完整配置，跳过初始管理员创建。');
    return;
  }

  const existing = await db('users')
    .where((builder) => {
      if (env.adminPhone) builder.orWhere({ phone: env.adminPhone });
      if (env.adminEmail) builder.orWhere({ email: env.adminEmail });
    })
    .first();

  const passwordHash = await hashPassword(env.adminInitialPassword);
  const now = new Date();

  if (existing) {
    await db('users').where({ id: existing.id }).update({
      password_hash: passwordHash,
      role: 'admin',
      status: 'normal',
      updated_at: now,
    });
    console.log('初始管理员已存在，已刷新管理员角色和密码哈希。');
    return;
  }

  await db('users').insert({
    id: createId('usr'),
    phone: env.adminPhone ?? null,
    email: env.adminEmail ?? null,
    password_hash: passwordHash,
    nickname: '练刻管理员',
    liftmark_id: createLiftmarkId(),
    role: 'admin',
    status: 'normal',
    created_at: now,
    updated_at: now,
  });
  console.log('初始管理员已创建。');
}

async function seedAchievements() {
  for (const definition of achievementDefinitions) {
    const existing = await db('achievement_definitions').where({ code: definition.code }).first();
    if (existing) {
      await db('achievement_definitions').where({ id: existing.id }).update({
        ...definition,
        enabled: true,
        updated_at: new Date(),
      });
    } else {
      await db('achievement_definitions').insert({
        id: createId('achdef'),
        ...definition,
        enabled: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }
  console.log('成就定义已同步。');
}

export async function seed() {
  await seedAdmin();
  await seedAchievements();
}

if (require.main === module) {
  seed()
    .then(async () => {
      await closeDb();
      console.log('Database seed complete.');
    })
    .catch(async (error) => {
      console.error(error);
      await closeDb();
      process.exit(1);
    });
}

