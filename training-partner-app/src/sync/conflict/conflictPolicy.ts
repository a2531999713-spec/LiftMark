import type { SyncStatus } from '../syncTypes';

export type ConflictWinner = 'local' | 'server';

export function chooseLastWriteWinner(input: {
  localStatus: SyncStatus;
  localUpdatedAt?: string | null;
  serverUpdatedAt?: string | null;
}): ConflictWinner {
  if (!input.localStatus.startsWith('pending_') && input.localStatus !== 'sync_failed') return 'server';
  const localTime = Date.parse(input.localUpdatedAt ?? '');
  const serverTime = Date.parse(input.serverUpdatedAt ?? '');
  if (!Number.isFinite(serverTime)) return 'local';
  if (!Number.isFinite(localTime)) return 'server';
  return localTime >= serverTime ? 'local' : 'server';
}
