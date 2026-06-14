import { customAlphabet } from 'nanoid/non-secure';

export type ID = string;

const createRawId = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 16);

export function createId(prefix?: string): ID {
  const id = createRawId();
  return prefix ? `${prefix}_${id}` : id;
}
