import type { SyncEntityType } from '../syncTypes';

export type SyncDeletionStrategy = 'tombstone' | 'overwrite' | 'dedicated-endpoint';

export type SyncEntityDefinition = {
  entityType: SyncEntityType;
  localTable: string | null;
  fields: readonly string[];
  deletionStrategy: SyncDeletionStrategy;
};
