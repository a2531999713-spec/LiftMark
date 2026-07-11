import assert from 'node:assert/strict';
import test from 'node:test';

import { isUndefinedTableError } from './sync.schema-errors';

test('recognizes PostgreSQL undefined-table errors only', () => {
  assert.equal(isUndefinedTableError({ code: '42P01' }), true);
  assert.equal(isUndefinedTableError({ code: '23505' }), false);
  assert.equal(isUndefinedTableError(new Error('missing')), false);
});
