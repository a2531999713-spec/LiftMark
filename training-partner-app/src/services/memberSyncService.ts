import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

type ServerMember = {
  id: string;
  group_id?: string;
  groupId?: string;
  user_id?: string;
  userId?: string;
  role: string;
  status: string;
  displayName?: string;
  nickname?: string;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  avatar_thumb_url?: string | null;
  avatarThumbUrl?: string | null;
  joined_at?: string;
  joinedAt?: string;
};

/**
 * 从服务器拉取小组成员信息，更新本地数据库中的头像
 */
export async function syncGroupMembersAvatar(groupId: string): Promise<{ ok: true; updated: number } | { ok: false; message: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { ok: false, message: '请先登录后再同步成员头像。' };

  try {
    const response = await apiRequest<{ members: ServerMember[] }>(
      `/groups/${groupId}/members`,
      { accessToken: session.accessToken }
    );

    if (!response.members) return { ok: true, updated: 0 };

    await initializeLocalDatabase();
    const db = await getDatabase();
    let updated = 0;

    for (const serverMember of response.members) {
      const userId = serverMember.userId ?? serverMember.user_id;
      if (!userId) continue;
      const avatarUrl = resolveAvatarUrl(serverMember.avatarUrl ?? serverMember.avatar_url) ?? null;
      const avatarThumbUrl = resolveAvatarUrl(
        serverMember.avatarThumbUrl ?? serverMember.avatar_thumb_url ?? serverMember.avatarUrl ?? serverMember.avatar_url,
      ) ?? null;
      const displayName = serverMember.displayName ?? serverMember.nickname;

      // 更新 group_members 表中的 avatar_url
      await db.runAsync(
        `UPDATE group_members
         SET display_name = COALESCE(?, display_name),
             user_id = ?,
             member_type = 'real',
             avatar_url = ?,
             updated_at = ?
         WHERE id = ? OR (group_id = ? AND user_id = ?)`,
        displayName ?? null,
        userId,
        avatarUrl,
        new Date().toISOString(),
        serverMember.id,
        groupId,
        userId
      );

      // 更新 member_profiles 表中的头像
      await db.runAsync(
        `UPDATE member_profiles SET avatar_url = ?, avatar_thumb_url = ?, avatar_updated_at = ?, updated_at = ?
         WHERE member_id IN (SELECT id FROM group_members WHERE group_id = ? AND user_id = ?)`,
        avatarUrl,
        avatarThumbUrl,
        new Date().toISOString(),
        new Date().toISOString(),
        groupId,
        userId
      );
      updated += 1;
    }

    return { ok: true, updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : '成员头像同步失败。';
    console.warn('[sync] syncGroupMembersAvatar failed', message);
    return { ok: false, message };
  }
}
