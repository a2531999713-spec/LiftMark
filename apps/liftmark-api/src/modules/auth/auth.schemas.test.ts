import assert from 'node:assert/strict';
import test from 'node:test';

import { registerSchema } from './auth.schemas';

test('registration rejects password-only and empty requests', () => {
  assert.equal(registerSchema.safeParse({ phone: 'fixture-phone', password: 'secret1' }).success, false);
  assert.equal(registerSchema.safeParse({ phone: 'fixture-phone' }).success, false);
});

test('registration accepts verified-code requests with optional password', () => {
  assert.equal(registerSchema.safeParse({ phone: 'fixture-phone', code: '123456' }).success, true);
  assert.equal(
    registerSchema.safeParse({ phone: 'fixture-phone', code: '123456', password: 'secret1' }).success,
    true,
  );
});
