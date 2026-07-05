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
 * 本服务在用户登录后执行，通过云端 API 反查每个小组和成员的真实归属，
 * 然后批量修正本地所有表的 owner_user_id。云端归属是权威来源。
 */
export async function repairLocalDataOwnership(): Promise<{ ok: boolean; stats: RepairStats; message: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken || !session?.user?.id) {
    return { ok: false, stats: EMPTY_STATS, message: '未登录，跳过归属修复。' };
  }

  const currentUserId = session.user.id;
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

  // 5. 修正 workout_sessions 表：归属为小组的 owner_user_id
  const sessionResult = await db.runAsync(
    `UPDATE workout_sessions
     SET owner_user_id = (
       SELECT g.owner_user_id FROM groups g WHERE g.id = workout_sessions.group_id
     )
     WHERE EXISTS (
       SELECT 1 FROM groups g
       WHERE g.id = workout_sessions.group_id
         AND g.owner_user_id IS NOT NULL
         AND (workout_sessions.owner_user_id IS NULL OR workout_sessions.owner_user_id != g.owner_user_id)
     )`,
  );
  stats.workoutSessions += sessionResult.changes ?? 0;

  // 6. 修正 workout_exercise_records 表
  const recordResult = await db.runAsync(
    `UPDATE workout_exercise_records
     SET owner_user_id = (
       SELECT g.owner_user_id
       FROM groups g
       INNER JOIN workout_sessions ws ON ws.group_id = g.id
       WHERE ws.id = workout_exercise_records.session_id
     )
     WHERE EXISTS (
       SELECT 1 FROM groups g
       INNER JOIN workout_sessions ws ON ws.group_id = g.id
       WHERE ws.id = workout_exercise_records.session_id
         AND g.owner_user_id IS NOT NULL
         AND (workout_exercise_records.owner_user_id IS NULL OR workout_exercise_records.owner_user_id != g.owner_user_id)
     )`,
  );
  stats.workoutExerciseRecords += recordResult.changes ?? 0;

  // 7. 修正 workout_sets 表
  const setResult = await db.runAsync(
    `UPDATE workout_sets
     SET owner_user_id = (
       SELECT g.owner_user_id
       FROM groups g
       INNER JOIN workout_sessions ws ON ws.group_id = g.id
       WHERE ws.id = workout_sets.session_id
     )
     WHERE EXISTS (
       SELECT 1 FROM groups g
       INNER JOIN workout_sessions ws ON ws.group_id = g.id
       WHERE ws.id = workout_sets.session_id
         AND g.owner_user_id IS NOT NULL
         AND (workout_sets.owner_user_id IS NULL OR workout_sets.owner_user_id != g.owner_user_id)
     )`,
  );
  stats.workoutSets += setResult.changes ?? 0;

  // 8. 修正 plan_templates 表
  const planResult = await db.runAsync(
    `UPDATE plan_templates
     SET owner_user_id = creator_id
     WHERE creator_id IS NOT NULL AND creator_id != ''
       AND (owner_user_id IS NULL OR owner_user_id != creator_id)`,
  );
  stats.planTemplates += planResult.changes ?? 0;

  // 9. 修正 plan_days 表
  const planDayResult = await db.runAsync(
    `UPDATE plan_days
     SET owner_user_id = (
       SELECT COALESCE(pt.owner_user_id, pt.creator_id)
       FROM plan_templates pt WHERE pt.id = plan_days.plan_id
     )
     WHERE EXISTS (
       SELECT 1 FROM plan_templates pt
       WHERE pt.id = plan_days.plan_id
         AND COALESCE(pt.owner_user_id, pt.creator_id) IS NOT NULL
         AND (plan_days.owner_user_id IS NULL OR plan_days.owner_user_id != COALESCE(pt.owner_user_id, pt.creator_id))
     )`,
  );
  stats.planDays += planDayResult.changes ?? 0;

  // 10. 修正 plan_exercises 表
  const planExerciseResult = await db.runAsync(
    `UPDATE plan_exercises
     SET owner_user_id = (
       SELECT COALESCE(pt.owner_user_id, pt.creator_id)
       FROM plan_templates pt
       INNER JOIN plan_days pd ON pd.plan_id = pt.id
       WHERE pd.id = plan_exercises.plan_day_id
     )
     WHERE EXISTS (
       SELECT 1 FROM plan_templates pt
       INNER JOIN plan_days pd ON pd.plan_id = pt.id
       WHERE pd.id = plan_exercises.plan_day_id
         AND COALESCE(pt.owner_user_id, pt.creator_id) IS NOT NULL
         AND (plan_exercises.owner_user_id IS NULL OR plan_exercises.owner_user_id != COALESCE(pt.owner_user_id, pt.creator_id))
     )`,
  );
  stats.planExercises += planExerciseResult.changes ?? 0;

  // 11. 修正 body_metrics 表
  const bodyMetricsResult = await db.runAsync(
    `UPDATE body_metrics
     SET owner_user_id = (
       SELECT gm.user_id FROM group_members gm WHERE gm.id = body_metrics.member_id
     )
     WHERE EXISTS (
       SELECT 1 FROM group_members gm
       WHERE gm.id = body_metrics.member_id
         AND gm.user_id IS NOT NULL AND gm.user_id != ''
         AND (body_metrics.owner_user_id IS NULL OR body_metrics.owner_user_id != gm.user_id)
     )`,
  );
  stats.bodyMetrics += bodyMetricsResult.changes ?? 0;

  // 12. 修正 body_metric_goals 表
  const bodyGoalResult = await db.runAsync(
    `UPDATE body_metric_goals
     SET owner_user_id = (
       SELECT gm.user_id FROM group_members gm WHERE gm.id = body_metric_goals.member_id
     )
     WHERE EXISTS (
       SELECT 1 FROM group_members gm
       WHERE gm.id = body_metric_goals.member_id
         AND gm.user_id IS NOT NULL AND gm.user_id != ''
         AND (body_metric_goals.owner_user_id IS NULL OR body_metric_goals.owner_user_id != gm.user_id)
     )`,
  );
  stats.bodyMetricGoals += bodyGoalResult.changes ?? 0;

  const totalFixed = Object.values(stats).reduce((sum, n) => sum + n, 0);
  const message =
    totalFixed === 0
      ? '数据归属已正确，无需修复。'
      : `已修复 ${totalFixed} 条数据的归属：小组 ${stats.groups}、成员 ${stats.groupMembers}、资料 ${stats.memberProfiles}、训练 ${stats.workoutSessions}、动作记录 ${stats.workoutExerciseRecords}、训练组 ${stats.workoutSets}、计划 ${stats.planTemplates}、计划日 ${stats.planDays}、计划动作 ${stats.planExercises}、体测 ${stats.bodyMetrics}、体测目标 ${stats.bodyMetricGoals}。`;

  return { ok: true, stats, message };
}
