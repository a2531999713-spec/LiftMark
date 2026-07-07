export type SyncStatus =
  | 'local_only'
  | 'pending_create'
  | 'pending_update'
  | 'pending_delete'
  | 'syncing'
  | 'synced'
  | 'sync_failed'
  | 'conflict';

export type SyncEntityType =
  | 'exercises'
  | 'workoutSessions'
  | 'workoutExerciseRecords'
  | 'workoutSets'
  | 'trainingPlans'
  | 'planPhases'
  | 'planDays'
  | 'planExercises'
  | 'groups'
  | 'groupMembers'
  | 'memberProfiles'
  | 'bodyMetrics'
  | 'bodyMetricGoals'
  | 'recoveryLogs'
  | 'progressionSuggestions'
  | 'settings';

export type SyncOperation = 'create' | 'update' | 'delete';

export type SyncEntity = {
  entityType: SyncEntityType;
  localId: string;
  operation: SyncOperation;
  ownerUserId?: string | null;
  payload?: Record<string, unknown>;
  remoteId?: string;
  status: SyncStatus;
  updatedAt: string;
};

export type SyncQueueItem = SyncEntity & {
  attempts: number;
  id: string;
  lastAttemptedAt?: string;
  syncError?: string;
};

export type SyncRuntimeStatus = 'disabled' | 'idle' | 'syncing' | 'paused' | 'failed';

export type SyncPreferences = {
  enabled: boolean;
  wifiOnly: boolean;
};

export type SyncSnapshot = {
  lastSyncedAt?: string;
  pendingCount: number;
  preferences: SyncPreferences;
  status: SyncRuntimeStatus;
};
