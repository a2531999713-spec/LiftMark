import type { Knex } from 'knex';

type DbClient = Knex | Knex.Transaction;

export async function syncUserAvatarToMemberProfiles(
  client: DbClient,
  userId: string,
  avatarUrl: string | null,
) {
  const now = new Date();
  await client('member_profiles')
    .where({ user_id: userId })
    .update({
      avatar_url: avatarUrl,
      avatar_thumb_url: avatarUrl,
      avatar_updated_at: now,
      updated_at: now,
    });
}
