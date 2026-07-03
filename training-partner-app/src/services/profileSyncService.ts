import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { createId } from '@/domain/common/ids';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

/**
 * 同步用户头像到服务器
 */
export async function syncAvatarToServer(avatarUrl: string | null): Promise<string | null> {
  const session = await readStoredSession();
  if (!session?.accessToken) return null;

  // 只同步服务器 URL 或 null，不同步本地路径
  if (avatarUrl && (avatarUrl.startsWith('file://') || avatarUrl.startsWith('content://'))) {
    return null;
  }

  try {
    const result = await apiRequest<{ avatarUrl?: string | null }>('/sync/avatar', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { avatarUrl },
    });
    return result.avatarUrl ?? avatarUrl;
  } catch {
    return null;
  }
}

/**
 * 同步小组到服务器
 */
export async function syncGroupsToServer(groups: { id: string; name: string; createdAt: string }[]): Promise<void> {
  const session = await readStoredSession();
  if (!session?.accessToken) return;

  try {
    await apiRequest('/sync/groups', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { groups },
    });
  } catch {
    // 静默失败
  }
}

/**
 * 同步所有本地小组到服务器
 */
export async function syncAllLocalGroupsToServer(): Promise<void> {
  const session = await readStoredSession();
  if (!session?.accessToken) return;

  try {
    await initializeLocalDatabase();
    const db = await getDatabase();

    // 获取所有本地小组
    const localGroups = await db.getAllAsync<{ id: string; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM groups ORDER BY created_at ASC'
    );

    if (localGroups.length === 0) return;

    // 同步到服务器
    await apiRequest('/sync/groups', {
      method: 'POST',
      accessToken: session.accessToken,
      body: {
        groups: localGroups.map(g => ({
          id: g.id,
          name: g.name,
          createdAt: g.created_at,
        })),
      },
    });

    // 同步每个小组的成员
    for (const group of localGroups) {
      const localMembers = await db.getAllAsync<{
        id: string;
        display_name: string;
        role: string;
        avatar_url: string | null;
      }>(
        'SELECT id, display_name, role, avatar_url FROM group_members WHERE group_id = ?',
        group.id
      );

      if (localMembers.length > 0) {
        await apiRequest('/sync/members', {
          method: 'POST',
          accessToken: session.accessToken,
          body: {
            groupId: group.id,
            members: localMembers.map(m => ({
              id: m.id,
              displayName: m.display_name,
              role: m.role,
              avatarUrl: m.avatar_url ?? undefined,
            })),
          },
        });
      }
    }
  } catch {
    // 静默失败
  }
}

/**
 * 同步成员到服务器
 */
export async function syncMembersToServer(
  groupId: string,
  members: {
    id: string;
    displayName: string;
    userId?: string;
    memberType?: 'local' | 'real';
    avatarUrl?: string;
    role?: string;
    profile?: {
      bodyweight?: number;
      bench1RM?: number;
      squat1RM?: number;
      deadlift1RM?: number;
      overheadPress1RM?: number;
      pullupReferenceWeight?: number;
      barbellIncrement?: number;
      dumbbellIncrement?: number;
    };
  }[]
): Promise<void> {
  const session = await readStoredSession();
  if (!session?.accessToken) return;

  try {
    await apiRequest('/sync/members', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { groupId, members },
    });
  } catch {
    // 静默失败
  }
}

/**
 * 从服务器拉取小组和成员数据
 */
export async function pullGroupsAndMembers(): Promise<{
  groups: {
    id: string;
    name: string;
    role: string;
    members: {
      id: string;
      userId: string;
      nickname: string;
      displayName?: string;
      avatarUrl: string | null;
      avatarThumbUrl?: string | null;
      avatarUpdatedAt?: string | null;
      memberType?: 'real';
      role: string;
      profile: {
        bodyweight?: number;
        bench1RM?: number;
        squat1RM?: number;
        deadlift1RM?: number;
        overheadPress1RM?: number;
        pullupReferenceWeight?: number;
        barbellIncrement?: number;
        dumbbellIncrement?: number;
      };
    }[];
  }[];
}> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { groups: [] };

  try {
    const result = await apiRequest<{ groups: any[] }>('/sync/groups-pull', {
      accessToken: session.accessToken,
    });
    return result;
  } catch {
    return { groups: [] };
  }
}

/**
 * 将服务器数据同步到本地数据库
 */
export async function syncServerDataToLocal(): Promise<void> {
  const { groups } = await pullGroupsAndMembers();
  if (groups.length === 0) return;

  await initializeLocalDatabase();
  const db = await getDatabase();

  for (const serverGroup of groups) {
    // 检查本地是否已存在该小组
    const existingGroup = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM groups WHERE id = ?',
      serverGroup.id
    );

    if (!existingGroup) {
      // 创建小组
      await db.runAsync(
        `INSERT INTO groups (id, name, owner_user_id, active_plan_id, current_phase_type, current_week, friday_enabled, friday_strategy, created_at, updated_at)
         VALUES (?, ?, ?, '', 'strength', 1, 0, 'default_rest', ?, ?)`,
        serverGroup.id,
        serverGroup.name,
        serverGroup.members[0]?.userId || '',
        new Date().toISOString(),
        new Date().toISOString()
      );
    }

    // 同步成员
    for (const serverMember of serverGroup.members) {
      // 检查本地是否已存在该成员
      const existingMember = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM group_members WHERE id = ? OR (group_id = ? AND user_id = ?)',
        serverMember.id,
        serverGroup.id,
        serverMember.userId
      );

      if (!existingMember) {
        // 创建成员
        await db.runAsync(
          `INSERT INTO group_members (
            id, group_id, display_name, user_id, member_type, local_member_id,
            role, avatar_url, joined_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'real', NULL, ?, ?, ?, ?, ?)`,
          serverMember.id,
          serverGroup.id,
          serverMember.displayName ?? serverMember.nickname,
          serverMember.userId,
          serverMember.role,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString()
        );
      } else {
        // 更新成员头像
        await db.runAsync(
          `UPDATE group_members
           SET display_name = ?, user_id = ?, member_type = 'real', avatar_url = ?, updated_at = ?
           WHERE id = ?`,
          serverMember.displayName ?? serverMember.nickname,
          serverMember.userId,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          new Date().toISOString(),
          existingMember.id
        );
      }

      // 同步成员资料
      const existingProfile = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM member_profiles WHERE member_id = ?',
        existingMember?.id || serverMember.id
      );

      if (existingProfile) {
        await db.runAsync(
          `UPDATE member_profiles SET
            bodyweight = ?, bench_1rm = ?, squat_1rm = ?, deadlift_1rm = ?,
            overhead_press_1rm = ?, pullup_reference_weight = ?,
            barbell_increment = ?, dumbbell_increment = ?, updated_at = ?,
            avatar_url = ?, avatar_thumb_url = ?, avatar_local_uri = ?, avatar_updated_at = ?
           WHERE id = ?`,
          serverMember.profile.bodyweight ?? null,
          serverMember.profile.bench1RM ?? null,
          serverMember.profile.squat1RM ?? null,
          serverMember.profile.deadlift1RM ?? null,
          serverMember.profile.overheadPress1RM ?? null,
          serverMember.profile.pullupReferenceWeight ?? null,
          serverMember.profile.barbellIncrement ?? 2.5,
          serverMember.profile.dumbbellIncrement ?? 2,
          new Date().toISOString(),
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          resolveAvatarUrl(serverMember.avatarThumbUrl ?? serverMember.avatarUrl) ?? null,
          null,
          serverMember.avatarUpdatedAt ?? new Date().toISOString(),
          existingProfile.id
        );
      } else {
        const memberId = existingMember?.id || serverMember.id;
        await db.runAsync(
          `INSERT INTO member_profiles (
            id, member_id, group_id, bodyweight, bench_1rm, squat_1rm, deadlift_1rm,
            overhead_press_1rm, pullup_reference_weight, barbell_increment, dumbbell_increment,
            avatar_url, avatar_thumb_url, avatar_local_uri, avatar_updated_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createId('profile'),
          memberId,
          serverGroup.id,
          serverMember.profile.bodyweight ?? null,
          serverMember.profile.bench1RM ?? null,
          serverMember.profile.squat1RM ?? null,
          serverMember.profile.deadlift1RM ?? null,
          serverMember.profile.overheadPress1RM ?? null,
          serverMember.profile.pullupReferenceWeight ?? null,
          serverMember.profile.barbellIncrement ?? 2.5,
          serverMember.profile.dumbbellIncrement ?? 2,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          resolveAvatarUrl(serverMember.avatarThumbUrl ?? serverMember.avatarUrl) ?? null,
          null,
          serverMember.avatarUpdatedAt ?? new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    }
  }
}
