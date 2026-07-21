import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getCurrentAccountUserId } from '@/data/local/accountScope';
import { initializeLocalDatabase } from '@/data/local/db';
import { enqueueSyncCandidatesBatch } from '@/sync/syncQueue';

jest.mock('@/data/local/db', () => ({ initializeLocalDatabase: jest.fn() }));
jest.mock('@/data/local/accountScope', () => ({ getCurrentAccountUserId: jest.fn() }));
jest.mock('@/domain/common/ids', () => ({ createId: () => 'sync_queue_test' }));

const mockAccount = getCurrentAccountUserId as jest.MockedFunction<typeof getCurrentAccountUserId>;
const mockInitialize = initializeLocalDatabase as jest.MockedFunction<typeof initializeLocalDatabase>;

function createDb(existingRows: unknown[] = []) {
  const runAsync = jest.fn(async () => ({ changes: 1, lastInsertRowId: 1 }));
  return {
    getAllAsync: jest.fn(async () => existingRows),
    runAsync,
    withExclusiveTransactionAsync: jest.fn(async (task: (txn: { runAsync: typeof runAsync }) => Promise<void>) => {
      await task({ runAsync });
    }),
  };
}

describe('workout sync queue batching', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccount.mockResolvedValue('user-a');
  });

  it('deduplicates 100 edits by owner, type and local id with one queue transaction', async () => {
    const db = createDb();
    mockInitialize.mockResolvedValue(db as never);
    const count = await enqueueSyncCandidatesBatch(Array.from({ length: 100 }, (_, index) => ({
      entityType: 'workoutSets' as const,
      localId: 'set-a',
      operation: 'update' as const,
      ownerUserId: 'user-a',
      payload: { revision: index },
      status: 'pending_update' as const,
      updatedAt: `2026-07-21T00:00:${String(index % 60).padStart(2, '0')}.000Z`,
    })));

    expect(count).toBe(1);
    expect(db.getAllAsync).toHaveBeenCalledTimes(1);
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledTimes(1);
    expect(mockAccount).toHaveBeenCalledTimes(1);
  });

  it('never downgrades a delete candidate to update', async () => {
    const db = createDb();
    mockInitialize.mockResolvedValue(db as never);
    await enqueueSyncCandidatesBatch([
      {
        entityType: 'workoutSets', localId: 'set-a', operation: 'delete', ownerUserId: 'user-a',
        status: 'pending_delete', updatedAt: '2026-07-21T00:00:00.000Z',
      },
      {
        entityType: 'workoutSets', localId: 'set-a', operation: 'update', ownerUserId: 'user-a',
        status: 'pending_update', updatedAt: '2026-07-21T00:00:01.000Z',
      },
    ]);
    const sqlArgs = db.runAsync.mock.calls[0];
    expect(sqlArgs).toContain('delete');
    expect(sqlArgs).toContain('pending_delete');
  });

  it('retires older duplicate active rows and updates only the newest row', async () => {
    const db = createDb([
      {
        id: 'queue-new', owner_user_id: 'user-a', entity_type: 'workoutSets', local_id: 'set-a',
        remote_id: null, operation: 'update', status: 'pending_update', payload: '{}',
      },
      {
        id: 'queue-old', owner_user_id: 'user-a', entity_type: 'workoutSets', local_id: 'set-a',
        remote_id: null, operation: 'update', status: 'sync_failed', payload: '{}',
      },
    ]);
    mockInitialize.mockResolvedValue(db as never);

    const count = await enqueueSyncCandidatesBatch([{
      entityType: 'workoutSets', localId: 'set-a', operation: 'update', ownerUserId: 'user-a',
      status: 'pending_update', updatedAt: '2026-07-21T00:00:00.000Z',
    }]);

    expect(count).toBe(1);
    expect(db.withExclusiveTransactionAsync).toHaveBeenCalledTimes(1);
    expect(db.runAsync).toHaveBeenCalledTimes(2);
    expect(db.runAsync.mock.calls[0]).toContain('queue-old');
    expect(db.runAsync.mock.calls[1]).toContain('queue-new');
  });

  it('skips candidates owned by another account', async () => {
    const db = createDb();
    mockInitialize.mockResolvedValue(db as never);
    const count = await enqueueSyncCandidatesBatch([{
      entityType: 'workoutSets', localId: 'set-b', operation: 'update', ownerUserId: 'user-b',
      status: 'pending_update', updatedAt: '2026-07-21T00:00:00.000Z',
    }]);
    expect(count).toBe(0);
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});
