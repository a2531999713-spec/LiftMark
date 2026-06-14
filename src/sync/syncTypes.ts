export type SyncStatus = 'local' | 'pending' | 'synced' | 'conflicted';

export type SyncEntity = {
  localId: string;
  remoteId?: string;
  status: SyncStatus;
  updatedAt: string;
};
