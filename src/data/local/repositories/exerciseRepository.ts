import type { ExerciseRepository } from '@/data/repositories/exerciseRepository';
import type { Exercise, ExerciseAlternative } from '@/domain/exercise/exercise.types';

import type { DatabaseProvider } from './base';
import {
  type ExerciseAlternativeRow,
  type ExerciseRow,
  mapExercise,
  mapExerciseAlternative,
} from './mappers';

export class SQLiteExerciseRepository implements ExerciseRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getExerciseById(id: string): Promise<Exercise | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ExerciseRow>('SELECT * FROM exercises WHERE id = ?', id);
    return row ? mapExercise(row) : null;
  }

  async listExercises(): Promise<Exercise[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<ExerciseRow>('SELECT * FROM exercises ORDER BY name ASC');
    return rows.map(mapExercise);
  }

  async listExercisesByIds(ids: string[]): Promise<Exercise[]> {
    if (ids.length === 0) {
      return [];
    }

    const db = await this.getDb();
    const placeholders = ids.map(() => '?').join(', ');
    const rows = await db.getAllAsync<ExerciseRow>(
      `SELECT * FROM exercises WHERE id IN (${placeholders})`,
      ...ids,
    );
    const byId = new Map(rows.map((row) => [row.id, mapExercise(row)]));
    return ids.map((id) => byId.get(id)).filter((exercise): exercise is Exercise => Boolean(exercise));
  }

  async listAlternatives(exerciseId: string): Promise<ExerciseAlternative[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<ExerciseAlternativeRow>(
      'SELECT * FROM exercise_alternatives WHERE exercise_id = ? ORDER BY id ASC',
      exerciseId,
    );
    return rows.map(mapExerciseAlternative);
  }
}
