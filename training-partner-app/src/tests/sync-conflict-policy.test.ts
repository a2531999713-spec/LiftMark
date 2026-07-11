import { describe, expect, it } from '@jest/globals';

import { chooseLastWriteWinner } from '@/sync/conflict/conflictPolicy';

describe('sync conflict policy', () => {
  it('does not let an older server row overwrite a pending local edit', () => {
    expect(chooseLastWriteWinner({
      localStatus: 'pending_update',
      localUpdatedAt: '2026-07-11T10:00:00.000Z',
      serverUpdatedAt: '2026-07-11T09:00:00.000Z',
    })).toBe('local');
  });

  it('applies server changes to clean local rows', () => {
    expect(chooseLastWriteWinner({ localStatus: 'synced', serverUpdatedAt: '2026-07-11T09:00:00.000Z' })).toBe('server');
  });
});
