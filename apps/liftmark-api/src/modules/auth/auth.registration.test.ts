import assert from 'node:assert/strict';
import test from 'node:test';

import { registerVerifiedPhone } from './auth.registration';

function createDependencies(options?: { codeValid?: boolean; duplicate?: boolean }) {
  return {
    async verifyCode(input: { code: string }) {
      if (options?.codeValid === false || input.code !== '123456') throw new Error('INVALID_CODE');
    },
    async createUser(input: { phone: string; password?: string }) {
      if (options?.duplicate) throw new Error('PHONE_ALREADY_REGISTERED');
      return { id: 'account-a', phone: input.phone, passwordSet: Boolean(input.password) };
    },
    async createSession(user: { id: string; phone: string; passwordSet: boolean }) {
      return { accessToken: 'fixture-token', user };
    },
  };
}

test('wrong registration code is rejected before user creation', async () => {
  await assert.rejects(
    registerVerifiedPhone({ phone: 'fixture-phone', code: '000000' }, createDependencies()),
    /INVALID_CODE/,
  );
});

test('verified registration succeeds without a password', async () => {
  const result = await registerVerifiedPhone(
    { phone: 'fixture-phone', code: '123456' },
    createDependencies(),
  );
  assert.equal(result.user.passwordSet, false);
});

test('verified registration succeeds with an optional password', async () => {
  const result = await registerVerifiedPhone(
    { phone: 'fixture-phone', code: '123456', password: 'secret1' },
    createDependencies(),
  );
  assert.equal(result.user.passwordSet, true);
});

test('an existing phone cannot be registered twice', async () => {
  await assert.rejects(
    registerVerifiedPhone({ phone: 'fixture-phone', code: '123456' }, createDependencies({ duplicate: true })),
    /PHONE_ALREADY_REGISTERED/,
  );
});
