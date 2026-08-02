import { syncServerDataToLocal } from '@/services/profileSyncService';

import { pullFromServer } from './pullService';
import { requestImmediateSync } from './syncService';

let isSyncing = false;
let activeSyncIsFullPull = false;
let pendingFullPull = false;
let lastSyncAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function sync(
  options?: { fullPull?: boolean; pushOnly?: boolean },
): Promise<{ ok: boolean; message?: string }> {
  if (isSyncing) {
    if (options?.fullPull && !activeSyncIsFullPull) {
      pendingFullPull = true;
      console.log('[sync] full pull queued behind active sync');
      return { ok: true, message: 'full pull queued' };
    }
    console.log('[sync] skipped: already syncing');
    return { ok: true, message: 'sync in progress' };
  }
  isSyncing = true;
  activeSyncIsFullPull = Boolean(options?.fullPull);
  console.log('[sync] starting, options:', JSON.stringify(options ?? {}));
  try {
    let pullResultMessage: string | undefined;
    if (!options?.pushOnly) {
      if (options?.fullPull) {
        console.log('[sync] starting group/member pull...');
        await syncServerDataToLocal();
        console.log('[sync] group/member pull done');
      }
      console.log('[sync] starting pull...');
      const pullResult = await pullFromServer({ fullPull: options?.fullPull });
      if (!pullResult.ok) {
        console.warn('[sync] pull failed:', pullResult.message);
        return { ok: false, message: pullResult.message ?? 'pull failed' };
      }
      console.log('[sync] pull done');
      pullResultMessage = pullResult.message;
      if (options?.fullPull && pullResult.message) {
        console.log('[sync] full pull result:', pullResult.message);
      }
    } else {
      console.log('[sync] pushOnly mode, skipping pull');
    }
    console.log('[sync] starting push...');
    let pushResult: { ok: boolean; message?: string };
    try {
      pushResult = await requestImmediateSync();
      console.log('[sync] push done:', JSON.stringify(pushResult));
    } catch (pushError) {
      console.error('[sync] push failed (pull may have succeeded):', pushError instanceof Error ? pushError.message : pushError);
      pushResult = { ok: true, message: 'Pull completed but push failed. Data has been downloaded from cloud.' };
    }
    lastSyncAt = Date.now();
    if (options?.fullPull && !pushResult.ok) {
      return pushResult;
    }
    if (options?.fullPull) {
      return {
        ok: true,
        message: pushResult.message
          ? `${pullResultMessage ?? '云端恢复完成。'}；${pushResult.message}`
          : pullResultMessage ?? '云端恢复完成。',
      };
    }
    return pushResult;
  } catch (error) {
    console.error('[sync] FAILED:', error instanceof Error ? error.message : error);
    if (error instanceof Error && error.stack) {
      console.error('[sync] stack:', error.stack);
    }
    return { ok: false, message: error instanceof Error ? error.message : 'sync failed' };
  } finally {
    isSyncing = false;
    activeSyncIsFullPull = false;
    if (pendingFullPull) {
      pendingFullPull = false;
      void sync({ fullPull: true });
    }
  }
}

// 防抖同步：数据修改后 3 秒触发，避免频繁同步
export function scheduleSyncDebounced(delayMs = 3000): void {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void sync().catch(() => undefined);
    debounceTimer = null;
  }, delayMs);
}

// 训练完成立即同步（push 优先）
export async function syncAfterWorkout(): Promise<void> {
  await sync({ pushOnly: true });
}

export function isCurrentlySyncing(): boolean {
  return isSyncing;
}

export function getLastSyncAt(): number {
  return lastSyncAt;
}
