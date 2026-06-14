import type { SyncEntity } from './syncTypes';

export function resolveLocalFirstConflict(local: SyncEntity): SyncEntity {
  return local;
}
