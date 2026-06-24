import { create } from 'zustand';

import {
  getSyncSnapshot,
  requestImmediateSync,
  updateSyncPreferences,
} from '@/sync/syncService';
import type { SyncPreferences, SyncSnapshot } from '@/sync/syncTypes';

type SyncStore = SyncSnapshot & {
  error: string | null;
  isLoading: boolean;
  loadSyncState: () => Promise<void>;
  requestSync: () => Promise<string | null>;
  setPreferences: (preferences: SyncPreferences) => Promise<void>;
};

export const useSyncStore = create<SyncStore>((set) => ({
  error: null,
  isLoading: false,
  lastSyncedAt: undefined,
  pendingCount: 0,
  preferences: {
    enabled: false,
    wifiOnly: true,
  },
  status: 'disabled',

  async loadSyncState() {
    set({ error: null, isLoading: true });
    try {
      set(await getSyncSnapshot());
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '同步状态加载失败。' });
    } finally {
      set({ isLoading: false });
    }
  },

  async requestSync() {
    const result = await requestImmediateSync();
    if (!result.ok) {
      set({ error: result.message });
      return result.message;
    }
    return null;
  },

  async setPreferences(preferences) {
    set({ error: null, isLoading: true });
    try {
      set(await updateSyncPreferences(preferences));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : '同步设置保存失败。' });
    } finally {
      set({ isLoading: false });
    }
  },
}));
