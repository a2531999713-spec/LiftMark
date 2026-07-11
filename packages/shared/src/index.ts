import { z } from 'zod';

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
