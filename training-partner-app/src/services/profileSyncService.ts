import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

/**
 * 同步用户头像到服务器
 */
export async function syncAvatarToServer(avatarUrl: string | null): Promise<void> {
  const session = await readStoredSession();
  if (!session?.accessToken) return;

  try {
    await apiRequest('/sync/avatar', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { avatarUrl },
    });
  } catch {
    // 静默失败
  }
}

/**
 * 同步小组到服务器
 */
export async function syncGroupsToServer(groups: Array<{ id: string; name: string; createdAt: string }>): Promise<void> {
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
 * 同步成员到服务器
 */
export async function syncMembersToServer(
  groupId: string,
  members: Array<{
    id: string;
    displayName: string;
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
  }>
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
  groups: Array<{
    id: string;
    name: string;
    role: string;
    members: Array<{
      id: string;
      userId: string;
      nickname: string;
      avatarUrl: string | null;
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
    }>;
  }>;
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
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ?',
        serverGroup.id,
        serverMember.userId
      );

      if (!existingMember) {
        // 创建成员
        await db.runAsync(
          `INSERT INTO group_members (id, group_id, display_name, role, avatar_url, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          serverMember.id,
          serverGroup.id,
          serverMember.nickname,
          serverMember.role,
          serverMember.avatarUrl,
          new Date().toISOString(),
          new Date().toISOString()
        );
      } else {
        // 更新成员头像
        await db.runAsync(
          'UPDATE group_members SET avatar_url = ?, updated_at = ? WHERE id = ?',
          serverMember.avatarUrl,
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
          serverMember.avatarUrl,
          serverMember.avatarUrl,
          null,
          new Date().toISOString(),
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
          `mprof_${Date.now()}`,
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
          serverMember.avatarUrl,
          serverMember.avatarUrl,
          null,
          new Date().toISOString(),
          new Date().toISOString(),
          new Date().toISOString()
        );
      }
    }
  }
}
