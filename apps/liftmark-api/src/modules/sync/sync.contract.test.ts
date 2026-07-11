import assert from 'node:assert/strict';
import test from 'node:test';

import { syncPushSchema } from '@liftmark/shared';

test('accepts an incremental push containing only changed entity groups', () => {
  const result = syncPushSchema.parse({
    deviceId: 'installation-device-1',
    changes: {
      workoutSets: [{ clientId: 'set-1', payload: { actual_weight: 80 } }],
    },
  });

  assert.equal(result.changes.workoutSets?.length, 1);
});

test('keeps deviceId optional for already-released clients', () => {
  assert.doesNotThrow(() => syncPushSchema.parse({ changes: {} }));
});

test('rejects dedicated-endpoint entities from generic push', () => {
  assert.throws(() => syncPushSchema.parse({
    changes: { groups: [{ clientId: 'group-1' }] },
  }));
});
