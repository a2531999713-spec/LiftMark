import { z } from 'zod';

export const ACHIEVEMENT_CODES = [
  'first_workout',
  'workouts_10',
  'workouts_25',
  'workouts_50',
  'active_week_streak_3',
  'active_week_streak_8',
  'volume_10000',
  'volume_50000',
  'first_group_workout',
  'cycle_complete_1',
  'recovery_checkins_7',
] as const;

export type AchievementCode = (typeof ACHIEVEMENT_CODES)[number];

export const ACHIEVEMENT_METRICS = [
  'completed_workouts',
  'longest_active_week_streak',
  'total_volume',
  'group_workouts',
  'completed_cycles',
  'recovery_checkins',
] as const;

export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export type AchievementDefinition = {
  code: AchievementCode;
  name: string;
  description: string;
  metric: AchievementMetric;
  target: number;
  sortOrder: number;
};

export const ACHIEVEMENT_CATALOG: readonly AchievementDefinition[] = [
  { code: 'first_workout', name: '首次完成训练', description: '完成第一场有效训练。', metric: 'completed_workouts', target: 1, sortOrder: 10 },
  { code: 'workouts_10', name: '稳定起步', description: '累计完成 10 次训练。', metric: 'completed_workouts', target: 10, sortOrder: 20 },
  { code: 'workouts_25', name: '形成节奏', description: '累计完成 25 次训练。', metric: 'completed_workouts', target: 25, sortOrder: 30 },
  { code: 'workouts_50', name: '坚持训练', description: '累计完成 50 次训练。', metric: 'completed_workouts', target: 50, sortOrder: 40 },
  { code: 'active_week_streak_3', name: '连续训练 3 周', description: '连续 3 个自然周至少完成一次训练。', metric: 'longest_active_week_streak', target: 3, sortOrder: 50 },
  { code: 'active_week_streak_8', name: '训练成为习惯', description: '连续 8 个自然周至少完成一次训练。', metric: 'longest_active_week_streak', target: 8, sortOrder: 60 },
  { code: 'volume_10000', name: '累计训练量 1 万公斤', description: '有效完成组的累计训练量达到 10000 kg。', metric: 'total_volume', target: 10_000, sortOrder: 70 },
  { code: 'volume_50000', name: '累计训练量 5 万公斤', description: '有效完成组的累计训练量达到 50000 kg。', metric: 'total_volume', target: 50_000, sortOrder: 80 },
  { code: 'first_group_workout', name: '第一次一起练', description: '完成第一场小组训练。', metric: 'group_workouts', target: 1, sortOrder: 90 },
  { code: 'cycle_complete_1', name: '完成一个计划周期', description: '完成或归档第一个训练计划周期。', metric: 'completed_cycles', target: 1, sortOrder: 100 },
  { code: 'recovery_checkins_7', name: '关注训练状态', description: '累计完成 7 次恢复状态评估。', metric: 'recovery_checkins', target: 7, sortOrder: 110 },
] as const;

export type AchievementProgress = AchievementDefinition & {
  progress: number;
  achieved: boolean;
  achievedAt?: string | null;
};

export type AchievementMetrics = {
  completedWorkouts: number;
  totalVolume: number;
  groupWorkouts: number;
  completedCycles: number;
  recoveryCheckins: number;
  currentActiveWeekStreak: number;
  longestActiveWeekStreak: number;
  thisWeekWorkoutCount: number;
  lastWorkoutDate?: string | null;
};

export type AchievementActivityWeek = {
  weekKey: string;
  workoutCount: number;
  active: boolean;
  current: boolean;
};

export type AchievementSnapshot = {
  metrics: AchievementMetrics;
  achievements: AchievementProgress[];
  activityWeeks: AchievementActivityWeek[];
  generatedAt: string;
};

export const SYNC_ENTITY_TYPES = [
  'exercises',
  'workoutSessions',
  'workoutExerciseRecords',
  'workoutSets',
  'trainingPlans',
  'planCycles',
  'planCycleSummaries',
  'planPhases',
  'planDays',
  'planExercises',
  'trainingReports',
  'trainingReminders',
  'groups',
  'groupMembers',
  'memberProfiles',
  'bodyMetrics',
  'bodyMetricGoals',
  'recoveryLogs',
  'progressionSuggestions',
  'settings',
] as const;

export type SharedSyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];

export const GENERIC_SYNC_ENTITY_TYPES = SYNC_ENTITY_TYPES.filter(
  (entityType) => !['groups', 'groupMembers', 'memberProfiles'].includes(entityType),
) as Exclude<SharedSyncEntityType, 'groups' | 'groupMembers' | 'memberProfiles'>[];
export type GenericSyncEntityType = (typeof GENERIC_SYNC_ENTITY_TYPES)[number];

export const SYNC_ERROR_CODES = [
  'SERVER_SCHEMA_OUTDATED',
  'SYNC_ACCOUNT_MISMATCH',
  'SYNC_CONFLICT',
  'SYNC_VALIDATION_FAILED',
] as const;
export type SyncErrorCode = (typeof SYNC_ERROR_CODES)[number];

export const ACCOUNT_ROLES = ['user', 'admin', 'super_admin'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export const PLAN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived', 'abandoned'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

export const PLAN_CYCLE_STATUSES = ['draft', 'active', 'completed', 'archived', 'abandoned'] as const;
export type PlanCycleStatus = (typeof PLAN_CYCLE_STATUSES)[number];

export const WORKOUT_SESSION_STATUSES = ['draft', 'in_progress', 'completed', 'cancelled'] as const;
export type WorkoutSessionStatus = (typeof WORKOUT_SESSION_STATUSES)[number];

export const syncEntitySchema = z.object({
  clientId: z.string().min(1),
  serverId: z.string().optional(),
  groupId: z.string().optional().nullable(),
  parentServerId: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  title: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  updatedAt: z.string().optional(),
  deletedAt: z.string().optional().nullable(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

export const syncPushSchema = z.object({
  // Optional for compatibility with already-released clients. Current clients
  // always send the SecureStore-backed installation identifier.
  deviceId: z.string().min(1).optional(),
  changes: z.partialRecord(z.enum(GENERIC_SYNC_ENTITY_TYPES), z.array(syncEntitySchema)),
});

export type SyncPushDto = z.infer<typeof syncPushSchema>;
