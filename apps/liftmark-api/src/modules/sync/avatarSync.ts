import type { Knex } from 'knex';

import { createId } from '../../utils/ids';

type DbClient = Knex | Knex.Transaction;

export async function syncUserAvatarToMemberProfiles(
  client: DbClient,
  userId: string,
  avatarUrl: string | null,
) {
  const now = new Date();

  const memberships = await client('group_members')
    .where({ user_id: userId, status: 'active' })
    .whereNull('left_at')
    .select('group_id');

  await client('member_profiles')
    .where({ user_id: userId })
    .update({
      avatar_url: avatarUrl,
      avatar_thumb_url: avatarUrl,
      avatar_updated_at: now,
      updated_at: now,
    });

  for (const membership of memberships) {
    const existing = await client('member_profiles')
      .where({ user_id: userId, group_id: membership.group_id })
      .first();
    if (existing) continue;

    await client('member_profiles').insert({
      id: createId('mprof'),
      user_id: userId,
      group_id: membership.group_id,
      avatar_url: avatarUrl,
      avatar_thumb_url: avatarUrl,
      avatar_updated_at: avatarUrl ? now : null,
      barbell_increment: 2.5,
      dumbbell_increment: 2.5,
      created_at: now,
      updated_at: now,
    });
  }
}
