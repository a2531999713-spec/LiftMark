import { pullFromServer } from './pullService';
import { requestImmediateSync } from './syncService';

let isSyncing = false;
let lastSyncAt = 0;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export async function sync(
  options?: { fullPull?: boolean; pushOnly?: boolean },
): Promise<{ ok: boolean; message?: string }> {
  if (isSyncing) return { ok: true, message: 'sync in progress' };
  isSyncing = true;
  try {
    if (!options?.pushOnly) {
      await pullFromServer({ fullPull: options?.fullPull });
    }
    const pushResult = await requestImmediateSync();
    lastSyncAt = Date.now();
    return pushResult;
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'sync failed' };
  } finally {
    isSyncing = false;
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
