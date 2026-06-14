import * as SQLite from 'expo-sqlite';

import { seedDefaultData } from '@/data/seed/seedDefaultData';

import { runMigrations } from './migrations';

export const DATABASE_NAME = 'training_partner.db';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;
let initializationPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync(DATABASE_NAME);
  return databasePromise;
}

export function initializeLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  initializationPromise ??= (async () => {
    const db = await getDatabase();
    await runMigrations(db);
    await seedDefaultData(db);
    return db;
  })().catch((error) => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}
