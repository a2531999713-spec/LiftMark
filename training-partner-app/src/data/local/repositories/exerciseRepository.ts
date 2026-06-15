import type {
  CreateCustomExerciseInput,
  ExerciseRepository,
  ListExercisesFilters,
} from '@/data/repositories/exerciseRepository';
import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
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

  async listExercises(filters: ListExercisesFilters = {}): Promise<Exercise[]> {
    const db = await this.getDb();
    const clauses: string[] = [];
    const params: string[] = [];

    if (filters.source) {
      clauses.push('source = ?');
      params.push(filters.source);
    }

    if (filters.category) {
      clauses.push('category = ?');
      params.push(filters.category);
    }

    if (filters.equipment) {
      clauses.push('equipment = ?');
      params.push(filters.equipment);
    }

    if (filters.movementPattern) {
      clauses.push('movement_pattern = ?');
      params.push(filters.movementPattern);
    }

    if (filters.query?.trim()) {
      clauses.push('(name LIKE ? OR target_muscle LIKE ? OR equipment LIKE ?)');
      const query = `%${filters.query.trim()}%`;
      params.push(query, query, query);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<ExerciseRow>(
      `SELECT * FROM exercises ${where} ORDER BY source DESC, name ASC`,
      ...params,
    );
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

  async findExerciseByName(name: string): Promise<Exercise | null> {
    const normalizedName = name.trim();
    if (!normalizedName) {
      return null;
    }

    const db = await this.getDb();
    const row = await db.getFirstAsync<ExerciseRow>(
      'SELECT * FROM exercises WHERE lower(name) = lower(?) ORDER BY source ASC LIMIT 1',
      normalizedName,
    );
    return row ? mapExercise(row) : null;
  }

  async createCustomExercise(input: CreateCustomExerciseInput): Promise<Exercise> {
    const name = input.name.trim();
    const targetMuscle = input.targetMuscle.trim();

    if (!name) {
      throw new Error('请输入动作名称。');
    }

    if (!targetMuscle) {
      throw new Error('请选择或填写主要肌群。');
    }

    const duplicate = await this.findExerciseByName(name);
    if (duplicate) {
      throw new Error('动作库里已经有同名动作。');
    }

    const db = await this.getDb();
    const now = nowIso();
    const exercise: Exercise = {
      id: createId('exercise_custom'),
      name,
      source: 'custom',
      category: input.category ?? 'other',
      movementPattern: input.movementPattern ?? 'other',
      targetMuscle,
      secondaryMuscle: input.secondaryMuscle?.trim() || undefined,
      equipment: input.equipment ?? 'other',
      difficulty: input.difficulty ?? 'intermediate',
      notes: input.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO exercises (
        id, name, source, category, movement_pattern, target_muscle, secondary_muscle,
        equipment, difficulty, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      exercise.id,
      exercise.name,
      exercise.source,
      exercise.category,
      exercise.movementPattern,
      exercise.targetMuscle,
      exercise.secondaryMuscle ?? null,
      exercise.equipment,
      exercise.difficulty ?? null,
      exercise.notes ?? null,
      exercise.createdAt,
      exercise.updatedAt,
    );

    return exercise;
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
