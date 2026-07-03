import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { createId } from '@/domain/common/ids';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

export type SyncOperationResult = { ok: true; message?: string } | { ok: false; message: string };

/**
 * 同步用户头像到服务器
 */
export async function syncAvatarToServer(avatarUrl: string | null): Promise<SyncOperationResult & { avatarUrl?: string | null }> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { ok: false, message: '请先登录后再同步头像。' };

  // 只同步服务器 URL 或 null，不同步本地路径
  if (avatarUrl && (avatarUrl.startsWith('file://') || avatarUrl.startsWith('content://'))) {
    return { ok: false, message: '头像只保存在本机，上传服务器失败。', avatarUrl };
  }

  try {
    const result = await apiRequest<{ avatarUrl?: string | null; avatar_url?: string | null }>('/sync/avatar', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { avatarUrl },
    });
    return { ok: true, avatarUrl: result.avatarUrl ?? result.avatar_url ?? avatarUrl };
  } catch (error) {
    const message = error instanceof Error ? error.message : '头像同步服务器失败。';
    console.warn('[sync] syncAvatarToServer failed', message);
    return { ok: false, message, avatarUrl };
  }
}

/**
 * 同步小组到服务器
 */
export async function syncGroupsToServer(groups: { id: string; name: string; createdAt: string }[]): Promise<SyncOperationResult> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { ok: false, message: '请先登录后再同步小组。' };

  try {
    await apiRequest('/sync/groups', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { groups },
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : '小组同步服务器失败。';
    console.warn('[sync] syncGroupsToServer failed', message);
    return { ok: false, message };
  }
}

/**
 * 同步所有本地小组到服务器
 */
export async function syncAllLocalGroupsToServer(): Promise<SyncOperationResult> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { ok: false, message: '请先登录后再同步本地小组。' };

  try {
    await initializeLocalDatabase();
    const db = await getDatabase();
    const now = new Date().toISOString();
    const currentUserId = session.user.id;

    // 获取所有本地小组
    const localGroups = await db.getAllAsync<{ id: string; name: string; created_at: string }>(
      'SELECT id, name, created_at FROM groups ORDER BY created_at ASC'
    );

    if (localGroups.length === 0) return { ok: true, message: '没有本地小组需要同步。' };

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
      const ownedMember = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM group_members WHERE group_id = ? AND user_id = ? LIMIT 1',
        group.id,
        currentUserId,
      );
      if (!ownedMember) {
        const fallbackMember = await db.getFirstAsync<{ id: string }>(
          `SELECT id FROM group_members
           WHERE group_id = ?
           ORDER BY CASE WHEN display_name = ? THEN 0 ELSE 1 END, created_at ASC
           LIMIT 1`,
          group.id,
          session.user.displayName,
        );
        if (fallbackMember) {
          await db.runAsync(
            `UPDATE group_members
             SET user_id = ?, member_type = 'real', local_member_id = COALESCE(local_member_id, id), updated_at = ?
             WHERE id = ?`,
            currentUserId,
            now,
            fallbackMember.id,
          );
        }
      }

      const localMembers = await db.getAllAsync<{
        id: string;
        display_name: string;
        user_id: string | null;
        member_type: 'local' | 'real' | null;
        role: string;
        avatar_url: string | null;
        bodyweight: number | null;
        bench_1rm: number | null;
        squat_1rm: number | null;
        deadlift_1rm: number | null;
        overhead_press_1rm: number | null;
        pullup_reference_weight: number | null;
        barbell_increment: number | null;
        dumbbell_increment: number | null;
      }>(
        `SELECT gm.id, gm.display_name, gm.user_id, gm.member_type, gm.role, gm.avatar_url,
                mp.bodyweight, mp.bench_1rm, mp.squat_1rm, mp.deadlift_1rm,
                mp.overhead_press_1rm, mp.pullup_reference_weight,
                mp.barbell_increment, mp.dumbbell_increment
         FROM group_members gm
         LEFT JOIN member_profiles mp ON mp.member_id = gm.id
         WHERE gm.group_id = ?`,
        group.id
      );

      if (localMembers.length > 0) {
        const memberResult = await apiRequest<{ results?: Array<{ id: string; reason?: string; skipped?: boolean; synced?: boolean }> }>('/sync/members', {
          method: 'POST',
          accessToken: session.accessToken,
          body: {
            groupId: group.id,
            members: localMembers.map(m => ({
              id: m.id,
              displayName: m.display_name,
              userId: m.user_id ?? undefined,
              memberType: m.member_type ?? (m.user_id ? 'real' : 'local'),
              role: m.role,
              avatarUrl: m.avatar_url ?? undefined,
              profile: {
                bodyweight: m.bodyweight ?? undefined,
                bench1RM: m.bench_1rm ?? undefined,
                squat1RM: m.squat_1rm ?? undefined,
                deadlift1RM: m.deadlift_1rm ?? undefined,
                overheadPress1RM: m.overhead_press_1rm ?? undefined,
                pullupReferenceWeight: m.pullup_reference_weight ?? undefined,
                barbellIncrement: m.barbell_increment ?? 2.5,
                dumbbellIncrement: m.dumbbell_increment ?? 2.5,
              },
            })),
          },
        });
        const skipped = memberResult.results?.filter((item) => item.skipped) ?? [];
        if (skipped.length > 0) {
          console.warn('[sync] local members skipped by server', skipped);
        }
      }
    }
    return { ok: true, message: '本地小组和当前账号成员已同步。' };
  } catch (error) {
    const message = error instanceof Error ? error.message : '本地小组同步服务器失败。';
    console.warn('[sync] syncAllLocalGroupsToServer failed', message);
    return { ok: false, message };
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
): Promise<SyncOperationResult & { results?: Array<{ id: string; reason?: string; skipped?: boolean; synced?: boolean }> }> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { ok: false, message: '请先登录后再同步成员。' };

  try {
    const result = await apiRequest<{ results?: Array<{ id: string; reason?: string; skipped?: boolean; synced?: boolean }> }>('/sync/members', {
      method: 'POST',
      accessToken: session.accessToken,
      body: { groupId, members },
    });
    return { ok: true, results: result.results };
  } catch (error) {
    const message = error instanceof Error ? error.message : '成员同步服务器失败。';
    console.warn('[sync] syncMembersToServer failed', message);
    return { ok: false, message };
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
  } catch (error) {
    console.warn('[sync] pullGroupsAndMembers failed', error instanceof Error ? error.message : error);
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
