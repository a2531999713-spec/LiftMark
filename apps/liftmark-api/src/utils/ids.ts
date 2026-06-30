import crypto from 'node:crypto';

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

export function createLiftmarkId() {
  const digits = String(Math.floor(10000000 + Math.random() * 90000000));
  return `LM${digits}`;
}

export function createActivationCode() {
  const raw = crypto.randomBytes(12).toString('base64url').toUpperCase();
  return `LM-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

export function createMockCode() {
  return String(Math.floor(1000000 + Math.random() * 9000000));
}

