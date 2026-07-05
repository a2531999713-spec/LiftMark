import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { apiRequest } from '@/services/httpClient';

type ServerGroup = {
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
    profile: Record<string, unknown>;
  }[];
};

type RepairStats = {
  groups: number;
  groupMembers: number;
  memberProfiles: number;
  workoutSessions: number;
  workoutExerciseRecords: number;
  workoutSets: number;
  planTemplates: number;
  planDays: number;
  planExercises: number;
  bodyMetrics: number;
  bodyMetricGoals: number;
};

const EMPTY_STATS: RepairStats = {
  groups: 0,
  groupMembers: 0,
  memberProfiles: 0,
  workoutSessions: 0,
  workoutExerciseRecords: 0,
  workoutSets: 0,
  planTemplates: 0,
  planDays: 0,
  planExercises: 0,
  bodyMetrics: 0,
  bodyMetricGoals: 0,
};

/**
 * 数据归属修复服务
 *
 * 背景：早期版本 syncServerDataToLocal 会无条件把 owner_user_id 改写为当前登录用户，
 * 导致 A 账号的数据被 B 账号"偷走"。migration 16 只能处理 user_id 已知的数据，
 * 对 local 类型成员（user_id = NULL）和历史被错误覆盖的数据无法恢复归属。
 *
 * 本服务在用户登录后执行，通过云端 API 反查当前账号可见的小组和成员身份。
 * 只修复 groups / group_members / member_profiles 这类身份结构表。
 * 训练、计划、体测等业务实体只能由 /sync/pull 的当前账号云端记录认领，不能再按小组 owner 批量改归属。
 */
export async function repairLocalDataOwnership(): Promise<{ ok: boolean; stats: RepairStats; message: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken || !session?.user?.id) {
    return { ok: false, stats: EMPTY_STATS, message: '未登录，跳过归属修复。' };
  }

  await initializeLocalDatabase();
  const db = await getDatabase();
  const stats: RepairStats = { ...EMPTY_STATS };

  // 1. 从云端拉取当前账号可见的所有小组和成员
  let serverGroups: ServerGroup[];
  try {
    const result = await apiRequest<{ groups: ServerGroup[] }>('/sync/groups-pull', {
      accessToken: session.accessToken,
    });
    serverGroups = result.groups ?? [];
  } catch (error) {
    return {
      ok: false,
      stats: EMPTY_STATS,
      message: `拉取云端数据失败：${error instanceof Error ? error.message : '未知错误'}`,
    };
  }

  if (serverGroups.length === 0) {
    return { ok: true, stats: EMPTY_STATS, message: '云端无小组数据，跳过归属修复。' };
  }

  // 构建归属映射表：groupId -> ownerUserId, memberId -> userId
  const groupOwnerMap = new Map<string, string>();
  const memberUserMap = new Map<string, string>();

  for (const group of serverGroups) {
    if (group.ownerUserId) {
      groupOwnerMap.set(group.id, group.ownerUserId);
    }
    for (const member of group.members) {
      if (member.userId) {
        memberUserMap.set(member.id, member.userId);
      }
    }
  }

  // 2. 修正 groups 表：用云端 ownerUserId 覆盖（云端是权威来源）
  for (const [groupId, ownerUserId] of groupOwnerMap) {
    const result = await db.runAsync(
      `UPDATE groups SET owner_user_id = ? WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id != ?)`,
      ownerUserId,
      groupId,
      ownerUserId,
    );
    stats.groups += result.changes ?? 0;
  }

  // 3. 修正 group_members 表：用云端 member userId 覆盖 owner_user_id
  for (const [memberId, userId] of memberUserMap) {
    const result = await db.runAsync(
      `UPDATE group_members SET owner_user_id = ?, user_id = ? WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id != ? OR user_id IS NULL OR user_id != ?)`,
      userId,
      userId,
      memberId,
      userId,
      userId,
    );
    stats.groupMembers += result.changes ?? 0;
  }

  // 4. 修正 member_profiles 表：继承对应 group_members 的归属
  const profileResult = await db.runAsync(
    `UPDATE member_profiles
     SET owner_user_id = (
       SELECT gm.user_id FROM group_members gm WHERE gm.id = member_profiles.member_id
     )
     WHERE EXISTS (
       SELECT 1 FROM group_members gm
       WHERE gm.id = member_profiles.member_id
         AND gm.user_id IS NOT NULL AND gm.user_id != ''
         AND (member_profiles.owner_user_id IS NULL OR member_profiles.owner_user_id != gm.user_id)
     )`,
  );
  stats.memberProfiles += profileResult.changes ?? 0;

  const totalFixed = Object.values(stats).reduce((sum, n) => sum + n, 0);
  const message =
    totalFixed === 0
      ? '数据归属已正确，无需修复。'
      : `已修复 ${totalFixed} 条身份结构数据的归属：小组 ${stats.groups}、成员 ${stats.groupMembers}、资料 ${stats.memberProfiles}。`;

  return { ok: true, stats, message };
}
