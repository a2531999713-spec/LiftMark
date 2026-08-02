import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { syncServerDataToLocal } from '@/services/profileSyncService';
import { pullFromServer } from '@/sync/pullService';
import { sync } from '@/sync/syncOrchestrator';
import { requestImmediateSync } from '@/sync/syncService';

jest.mock('@/services/profileSyncService', () => ({ syncServerDataToLocal: jest.fn() }));
jest.mock('@/sync/pullService', () => ({ pullFromServer: jest.fn() }));
jest.mock('@/sync/syncService', () => ({ requestImmediateSync: jest.fn() }));

const mockPullFromServer = pullFromServer as jest.MockedFunction<typeof pullFromServer>;
const mockRequestImmediateSync = requestImmediateSync as jest.MockedFunction<typeof requestImmediateSync>;
const mockSyncServerDataToLocal = syncServerDataToLocal as jest.MockedFunction<typeof syncServerDataToLocal>;

async function waitForCallCount(mock: { mock: { calls: unknown[][] } }, expected: number): Promise<void> {
  for (let attempt = 0; attempt < 20 && mock.mock.calls.length < expected; attempt += 1) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

describe('sync orchestration priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSyncServerDataToLocal.mockResolvedValue(undefined);
    mockRequestImmediateSync.mockResolvedValue({ ok: true });
  });

  it('queues a required full pull instead of dropping it behind an incremental sync', async () => {
    let releaseIncremental: ((value: { ok: boolean; pulled: number }) => void) | undefined;
    mockPullFromServer
      .mockImplementationOnce(() => new Promise((resolve) => { releaseIncremental = resolve; }))
      .mockResolvedValue({ ok: true, pulled: 0 });

    const incremental = sync();
    await waitForCallCount(mockPullFromServer, 1);

    await expect(sync({ fullPull: true })).resolves.toEqual({
      message: 'full pull queued',
      ok: true,
    });
    releaseIncremental?.({ ok: true, pulled: 0 });
    await incremental;
    await waitForCallCount(mockPullFromServer, 2);
    await waitForCallCount(mockRequestImmediateSync, 2);

    expect(mockSyncServerDataToLocal).toHaveBeenCalledTimes(1);
    expect(mockPullFromServer).toHaveBeenNthCalledWith(2, { fullPull: true });
    expect(mockRequestImmediateSync).toHaveBeenCalledTimes(2);
  });
});
