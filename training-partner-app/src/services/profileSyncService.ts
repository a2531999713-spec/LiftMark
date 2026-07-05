import { createLocalRepositories, getDatabase, initializeLocalDatabase } from '@/data/local';
import { createId } from '@/domain/common/ids';
import type { GroupMember } from '@/domain/member/member.types';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

export type SyncOperationResult = { ok: true; message?: string } | { ok: false; message: string };
type SyncMemberResult = { id: string; reason?: string; skipped?: boolean; synced?: boolean };

export async function updateDisplayNameAcrossLocalProfiles(input: {
  displayName: string;
  fallbackGroupId?: string;
  fallbackMemberId?: string;
  userId?: string;
}): Promise<{ updatedMembers: GroupMember[] }> {
  await initializeLocalDatabase();
  const repositories = createLocalRepositories();
  const groups = await repositories.groupRepository.listGroups();
  const updatedMembers: GroupMember[] = [];

  for (const group of groups) {
    const members = await repositories.memberRepository.listMembers(group.id);
    let targets = input.userId
      ? members.filter((member) => member.userId === input.userId)
      : [];

    if (targets.length === 0 && group.id === input.fallbackGroupId && input.fallbackMemberId) {
      const fallback = members.find((member) => member.id === input.fallbackMemberId);
      if (fallback) {
        targets = [fallback];
      }
    }

    for (const target of targets) {
      const updated = await repositories.memberRepository.updateMember(target.id, {
        displayName: input.displayName,
      });
      updatedMembers.push(updated);

      await enqueueSyncCandidate({
        entityType: 'groupMembers',
        localId: updated.id,
        operation: 'update',
        payload: {
          displayName: updated.displayName,
          groupId: updated.groupId,
          memberType: updated.memberType,
          role: updated.role,
          userId: updated.userId,
        },
        status: 'pending_update',
        updatedAt: updated.updatedAt,
      });
    }
  }

  return { updatedMembers };
}

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
    const currentUserId = session.user.id;

    // 获取所有本地小组
    const localGroups = await db.getAllAsync<{ id: string; name: string; created_at: string }>(
      `SELECT DISTINCT g.id, g.name, g.created_at
       FROM groups g
       LEFT JOIN group_members gm
         ON gm.group_id = g.id
        AND gm.user_id = ?
        AND gm.deleted_at IS NULL
       WHERE g.deleted_at IS NULL
         AND (g.owner_user_id = ? OR gm.id IS NOT NULL)
       ORDER BY g.created_at ASC`,
      currentUserId,
      currentUserId,
    );
    const isolatedGroups = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM groups g
       WHERE g.deleted_at IS NULL
         AND (g.owner_user_id IS NULL OR g.owner_user_id != ?)
         AND NOT EXISTS (
           SELECT 1
           FROM group_members gm
           WHERE gm.group_id = g.id
             AND gm.user_id = ?
             AND gm.deleted_at IS NULL
         )`,
      currentUserId,
      currentUserId,
    );
    const isolatedCount = isolatedGroups?.count ?? 0;

    if (localGroups.length === 0) {
      return {
        ok: true,
        message:
          isolatedCount > 0
            ? `No groups for current account. ${isolatedCount} local groups from other accounts or unbound data were isolated.`
            : 'No local groups to sync for current account.',
      };
    }

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
         WHERE gm.group_id = ?
           AND gm.user_id = ?
           AND gm.deleted_at IS NULL`,
        group.id,
        currentUserId,
      );

      if (localMembers.length > 0) {
        const memberResult = await apiRequest<{ results?: SyncMemberResult[] }>('/sync/members', {
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
    return {
      ok: true,
      message:
        isolatedCount > 0
          ? `Current account groups synced. ${isolatedCount} local groups from other accounts or unbound data were isolated.`
          : 'Current account groups synced.',
    };
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
): Promise<SyncOperationResult & { results?: SyncMemberResult[] }> {
  const session = await readStoredSession();
  if (!session?.accessToken) return { ok: false, message: '请先登录后再同步成员。' };

  try {
    const result = await apiRequest<{ results?: SyncMemberResult[] }>('/sync/members', {
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
    ownerUserId?: string | null;
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
  const session = await readStoredSession();
  if (!session?.user?.id) return;
  const currentUserId = session.user.id;
  const { groups } = await pullGroupsAndMembers();
  if (groups.length === 0) return;

  await initializeLocalDatabase();
  const db = await getDatabase();

  for (const serverGroup of groups) {
    const now = new Date().toISOString();
    const serverHasCurrentUser = serverGroup.members.some((member) => member.userId === currentUserId);
    // 检查本地是否已存在该小组
    const existingGroup = await db.getFirstAsync<{ id: string; owner_user_id: string | null }>(
      'SELECT id, owner_user_id FROM groups WHERE id = ?',
      serverGroup.id
    );
    const currentMembership = existingGroup
      ? await db.getFirstAsync<{ id: string }>(
          `SELECT id
           FROM group_members
           WHERE group_id = ?
             AND user_id = ?
             AND deleted_at IS NULL
           LIMIT 1`,
          serverGroup.id,
          currentUserId,
        )
      : null;

    if (existingGroup?.owner_user_id && existingGroup.owner_user_id !== currentUserId && !currentMembership && !serverHasCurrentUser) {
      console.warn('[sync] skipped server group because local group belongs to another account', {
        groupId: serverGroup.id,
        localOwnerUserId: existingGroup.owner_user_id,
        currentUserId,
      });
      continue;
    }

    if (!existingGroup) {
      // 创建小组（归属以服务端为准，防止跨账号拉取时错填归属）
      const groupOwnerUserId = serverGroup.ownerUserId ?? currentUserId;
      await db.runAsync(
        `INSERT INTO groups (id, name, owner_user_id, active_plan_id, current_phase_type, current_week, friday_enabled, friday_strategy, created_at, updated_at)
         VALUES (?, ?, ?, '', 'strength', 1, 0, 'default_rest', ?, ?)`,
        serverGroup.id,
        serverGroup.name,
        groupOwnerUserId,
        now,
        now
      );
    } else {
      // 更新小组归属以云端为准；只处理当前账号可见的云端小组。
      const groupOwnerUserId = serverGroup.ownerUserId ?? currentUserId;
      await db.runAsync(
        `UPDATE groups
         SET name = ?, owner_user_id = ?, updated_at = ?
         WHERE id = ?`,
        serverGroup.name,
        groupOwnerUserId,
        now,
        serverGroup.id,
      );
    }

    // 同步成员
    for (const serverMember of serverGroup.members) {
      // 检查本地是否已存在该成员
      const existingMember = await db.getFirstAsync<{ id: string }>(
        `SELECT id
         FROM group_members
         WHERE group_id = ?
           AND (id = ? OR user_id = ?)
           AND deleted_at IS NULL
         LIMIT 1`,
        serverGroup.id,
        serverMember.id,
        serverMember.userId
      );

      if (!existingMember) {
        // 创建成员（归属以成员对应的账号为准，防止跨账号拉取时错填归属）
        const memberOwnerUserId = serverMember.userId ?? currentUserId;
        await db.runAsync(
          `INSERT INTO group_members (
            id, owner_user_id, group_id, display_name, user_id, member_type, local_member_id,
            role, avatar_url, joined_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'real', NULL, ?, ?, ?, ?, ?)`,
          serverMember.id,
          memberOwnerUserId,
          serverGroup.id,
          serverMember.displayName ?? serverMember.nickname,
          serverMember.userId,
          serverMember.role,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          now,
          now,
          now
        );
      } else {
        // 更新成员归属以成员 userId 为准，避免按当前登录者抢归属。
        const memberOwnerUserId = serverMember.userId ?? currentUserId;
        await db.runAsync(
          `UPDATE group_members
           SET owner_user_id = ?, display_name = ?, user_id = ?, member_type = 'real', avatar_url = ?, updated_at = ?
           WHERE id = ?`,
          memberOwnerUserId,
          serverMember.displayName ?? serverMember.nickname,
          serverMember.userId,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          now,
          existingMember.id
        );
      }

      // 同步成员资料
      const existingProfile = await db.getFirstAsync<{ id: string }>(
        'SELECT id FROM member_profiles WHERE member_id = ? AND group_id = ?',
        existingMember?.id || serverMember.id,
        serverGroup.id,
      );

      if (existingProfile) {
        // 成员资料归属以对应成员 userId 为准。
        const profileOwnerUserId = serverMember.userId ?? currentUserId;
        await db.runAsync(
          `UPDATE member_profiles SET
            owner_user_id = ?, bodyweight = ?, bench_1rm = ?, squat_1rm = ?, deadlift_1rm = ?,
            overhead_press_1rm = ?, pullup_reference_weight = ?,
            barbell_increment = ?, dumbbell_increment = ?, updated_at = ?,
            avatar_url = ?, avatar_thumb_url = ?, avatar_local_uri = ?, avatar_updated_at = ?
           WHERE id = ?`,
          profileOwnerUserId,
          serverMember.profile.bodyweight ?? null,
          serverMember.profile.bench1RM ?? null,
          serverMember.profile.squat1RM ?? null,
          serverMember.profile.deadlift1RM ?? null,
          serverMember.profile.overheadPress1RM ?? null,
          serverMember.profile.pullupReferenceWeight ?? null,
          serverMember.profile.barbellIncrement ?? 2.5,
          serverMember.profile.dumbbellIncrement ?? 2.5,
          now,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          resolveAvatarUrl(serverMember.avatarThumbUrl ?? serverMember.avatarUrl) ?? null,
          null,
          serverMember.avatarUpdatedAt ?? now,
          existingProfile.id
        );
      } else {
        const memberId = existingMember?.id || serverMember.id;
        const profileOwnerUserId = serverMember.userId ?? currentUserId;
        await db.runAsync(
          `INSERT INTO member_profiles (
            id, owner_user_id, member_id, group_id, bodyweight, bench_1rm, squat_1rm, deadlift_1rm,
            overhead_press_1rm, pullup_reference_weight, barbell_increment, dumbbell_increment,
            avatar_url, avatar_thumb_url, avatar_local_uri, avatar_updated_at,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createId('profile'),
          profileOwnerUserId,
          memberId,
          serverGroup.id,
          serverMember.profile.bodyweight ?? null,
          serverMember.profile.bench1RM ?? null,
          serverMember.profile.squat1RM ?? null,
          serverMember.profile.deadlift1RM ?? null,
          serverMember.profile.overheadPress1RM ?? null,
          serverMember.profile.pullupReferenceWeight ?? null,
          serverMember.profile.barbellIncrement ?? 2.5,
          serverMember.profile.dumbbellIncrement ?? 2.5,
          resolveAvatarUrl(serverMember.avatarUrl) ?? null,
          resolveAvatarUrl(serverMember.avatarThumbUrl ?? serverMember.avatarUrl) ?? null,
          null,
          serverMember.avatarUpdatedAt ?? now,
          now,
          now
        );
      }
    }
  }
}
