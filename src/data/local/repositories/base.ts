import type { SQLiteDatabase } from 'expo-sqlite';

export type DatabaseProvider = () => Promise<SQLiteDatabase>;

export async function requireRow<T>(value: T | null, message: string): Promise<T> {
  if (!value) {
    throw new Error(message);
  }

  return value;
}
