import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { readStoredSession } from '@/services/auth/tokenStorage';
import { requestImmediateSync } from '@/sync/syncService';
import {
  listPendingSyncItems,
  reconcileDirtyWorkoutSyncQueue,
} from '@/sync/syncQueue';

jest.mock('@/services/auth/tokenStorage', () => ({ readStoredSession: jest.fn() }));
jest.mock('@/sync/syncQueue', () => ({
  countPendingSyncItems: jest.fn(),
  listPendingSyncItems: jest.fn(),
  markSyncItemFailed: jest.fn(),
  markSyncItemSynced: jest.fn(),
  markSyncItemsSyncing: jest.fn(),
  reconcileDirtyWorkoutSyncQueue: jest.fn(),
}));

const mockReadStoredSession = readStoredSession as jest.MockedFunction<typeof readStoredSession>;
const mockListPendingSyncItems = listPendingSyncItems as jest.MockedFunction<typeof listPendingSyncItems>;
const mockReconcileDirtyWorkoutSyncQueue = reconcileDirtyWorkoutSyncQueue as jest.MockedFunction<typeof reconcileDirtyWorkoutSyncQueue>;

describe('workout sync queue repair', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadStoredSession.mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        displayName: 'Test User',
        id: 'user-a',
        liftmarkId: 'LMTEST01',
      },
    });
    mockReconcileDirtyWorkoutSyncQueue.mockResolvedValue(3);
    mockListPendingSyncItems.mockResolvedValue([]);
  });

  it('reconciles dirty workout rows before reading the push queue', async () => {
    await expect(requestImmediateSync()).resolves.toEqual({
      message: 'No pending sync data.',
      ok: true,
    });

    expect(mockReconcileDirtyWorkoutSyncQueue).toHaveBeenCalledTimes(1);
    expect(mockListPendingSyncItems).toHaveBeenCalledWith({ includeAllAccounts: true });
    expect(mockReconcileDirtyWorkoutSyncQueue.mock.invocationCallOrder[0]).toBeLessThan(
      mockListPendingSyncItems.mock.invocationCallOrder[0],
    );
  });
});
