import type { SyncEntity } from './syncTypes';

export function enqueueSyncCandidate(_entity: SyncEntity): void {
  // Cloud sync is intentionally deferred until the local MVP is stable.
}
