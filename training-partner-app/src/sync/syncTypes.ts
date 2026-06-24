export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflicted';

export type SyncEntity = {
  localId: string;
  remoteId?: string;
  status: SyncStatus;
  updatedAt: string;
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
