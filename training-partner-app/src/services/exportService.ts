import { getDatabase, initializeLocalDatabase } from '@/data/local';
import { seedDefaultData } from '@/data/seed/seedDefaultData';

type ExportTableName =
  | 'groups'
  | 'group_members'
  | 'member_profiles'
  | 'exercises'
  | 'exercise_alternatives'
  | 'plan_templates'
  | 'plan_phases'
  | 'plan_days'
  | 'plan_exercises'
  | 'workout_sessions'
  | 'workout_exercise_records'
  | 'workout_sets'
  | 'progression_suggestions'
  | 'recovery_logs';

const allExportTables: ExportTableName[] = [
  'groups',
  'group_members',
  'member_profiles',
  'exercises',
  'exercise_alternatives',
  'plan_templates',
  'plan_phases',
  'plan_days',
  'plan_exercises',
  'workout_sessions',
  'workout_exercise_records',
  'workout_sets',
  'progression_suggestions',
  'recovery_logs',
];

const workoutExportTables: ExportTableName[] = [
  'workout_sessions',
  'workout_exercise_records',
  'workout_sets',
  'progression_suggestions',
  'recovery_logs',
];

export type ExportPayload = {
  app: 'LiftMark';
  format: 'liftmark-full-data' | 'liftmark-workout-data';
  exportedAt: string;
  schemaVersion: number;
  tables: Partial<Record<ExportTableName, unknown[]>>;
};

async function readTables(tables: ExportTableName[]): Promise<ExportPayload['tables']> {
  await initializeLocalDatabase();
  const db = await getDatabase();
  const entries = await Promise.all(
    tables.map(async (table) => [table, await db.getAllAsync(`SELECT * FROM ${table}`)] as const),
  );

  return Object.fromEntries(entries);
}

export async function createExportPayload(
  format: ExportPayload['format'] = 'liftmark-full-data',
): Promise<ExportPayload> {
  const tables = format === 'liftmark-full-data' ? allExportTables : workoutExportTables;

  return {
    app: 'LiftMark',
    format,
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
    tables: await readTables(tables),
  };
}

export async function exportLocalDataJson(): Promise<string> {
  return JSON.stringify(await createExportPayload('liftmark-full-data'), null, 2);
}

export async function exportWorkoutDataJson(): Promise<string> {
  return JSON.stringify(await createExportPayload('liftmark-workout-data'), null, 2);
}

export async function resetDefaultPlanData(): Promise<void> {
  const db = await initializeLocalDatabase();
  await seedDefaultData(db);
}
