import assert from 'node:assert/strict';
import test from 'node:test';

import { isCorsOriginAllowed, parseCorsAllowedOrigins, resolveCorsAllowedOrigins } from './cors';

test('parses comma-separated CORS origins without duplicates', () => {
  assert.deepEqual(parseCorsAllowedOrigins(' https://a.example,https://b.example,https://a.example '), [
    'https://a.example',
    'https://b.example',
  ]);
});

test('production requires an explicit CORS allowlist', () => {
  assert.throws(() => resolveCorsAllowedOrigins('production', ''), /CORS_ALLOWED_ORIGINS/);
});

test('allows native requests without Origin and rejects unlisted web origins', () => {
  const allowed = ['https://console.example'];
  assert.equal(isCorsOriginAllowed(undefined, allowed), true);
  assert.equal(isCorsOriginAllowed('https://console.example', allowed), true);
  assert.equal(isCorsOriginAllowed('https://evil.example', allowed), false);
});
