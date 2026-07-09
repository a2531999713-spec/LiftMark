import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { getCurrentAccountUserId } from '@/data/local/accountScope';

type CountRow = {
  count: number;
};

export type LocalTrainingDataStatus = {
  hasLocalData: boolean;
  memberCount: number;
  userPlanCount: number;
  workoutSessionCount: number;
};

async function countForUser(sql: string, ...params: string[]) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CountRow>(sql, ...params);
  return row?.count ?? 0;
}

export async function getLocalTrainingDataStatus(): Promise<LocalTrainingDataStatus> {
  await initializeLocalDatabase();
  const userId = await getCurrentAccountUserId();

  if (!userId) {
    return {
      hasLocalData: false,
      memberCount: 0,
      userPlanCount: 0,
      workoutSessionCount: 0,
    };
  }

  const [memberCount, userPlanCount, workoutSessionCount] = await Promise.all([
    countForUser(
      `SELECT COUNT(*) AS count
       FROM group_members gm
       INNER JOIN groups g ON g.id = gm.group_id
       WHERE gm.deleted_at IS NULL
         AND g.deleted_at IS NULL
         AND (g.owner_user_id = ? OR gm.user_id = ?)`,
      userId,
      userId,
    ),
    countForUser(
      "SELECT COUNT(*) AS count FROM plan_templates WHERE source <> 'system' AND (owner_user_id = ? OR creator_id = ?)",
      userId,
      userId,
    ),
    countForUser(
      `SELECT COUNT(*) AS count
       FROM workout_sessions ws
       INNER JOIN groups g ON g.id = ws.group_id
       WHERE ws.deleted_at IS NULL
         AND g.deleted_at IS NULL
         AND (ws.owner_user_id = ? OR g.owner_user_id = ?)`,
      userId,
      userId,
    ),
  ]);

  return {
    hasLocalData: memberCount > 0 || userPlanCount > 0 || workoutSessionCount > 0,
    memberCount,
    userPlanCount,
    workoutSessionCount,
  };
}
