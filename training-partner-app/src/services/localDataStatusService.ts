import { getDatabase, initializeLocalDatabase } from '@/data/local';

type CountRow = {
  count: number;
};

export type LocalTrainingDataStatus = {
  hasLocalData: boolean;
  memberCount: number;
  userPlanCount: number;
  workoutSessionCount: number;
};

async function count(sql: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<CountRow>(sql);
  return row?.count ?? 0;
}

export async function getLocalTrainingDataStatus(): Promise<LocalTrainingDataStatus> {
  await initializeLocalDatabase();

  const [memberCount, userPlanCount, workoutSessionCount] = await Promise.all([
    count('SELECT COUNT(*) AS count FROM group_members'),
    count("SELECT COUNT(*) AS count FROM plan_templates WHERE source <> 'system'"),
    count('SELECT COUNT(*) AS count FROM workout_sessions'),
  ]);

  return {
    hasLocalData: memberCount > 0 || userPlanCount > 0 || workoutSessionCount > 0,
    memberCount,
    userPlanCount,
    workoutSessionCount,
  };
}
