import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

type ServerMember = {
  id: string;
  group_id: string;
  user_id: string;
  role: string;
  status: string;
  nickname: string;
  avatar_url: string | null;
  joined_at: string;
};

/**
 * 从服务器拉取小组成员信息，更新本地数据库中的头像
 */
export async function syncGroupMembersAvatar(groupId: string): Promise<void> {
  const session = await readStoredSession();
  if (!session?.accessToken) return;

  try {
    const response = await apiRequest<{ members: ServerMember[] }>(
      `/groups/${groupId}/members`,
      { accessToken: session.accessToken }
    );

    if (!response.members) return;

    await initializeLocalDatabase();
    const db = await getDatabase();

    for (const serverMember of response.members) {
      // 更新 group_members 表中的 avatar_url
      await db.runAsync(
        `UPDATE group_members SET avatar_url = ?, updated_at = ? WHERE id = ? OR (group_id = ? AND user_id = ?)`,
        serverMember.avatar_url,
        new Date().toISOString(),
        serverMember.id,
        groupId,
        serverMember.user_id
      );

      // 更新 member_profiles 表中的头像
      await db.runAsync(
        `UPDATE member_profiles SET avatar_url = ?, avatar_updated_at = ?, updated_at = ?
         WHERE member_id IN (SELECT id FROM group_members WHERE group_id = ? AND user_id = ?)`,
        serverMember.avatar_url,
        new Date().toISOString(),
        new Date().toISOString(),
        groupId,
        serverMember.user_id
      );
    }
  } catch {
    // 静默失败，不影响用户体验
  }
}
