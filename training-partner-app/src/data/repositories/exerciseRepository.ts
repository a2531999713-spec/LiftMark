import type { ID } from '@/domain/common/ids';
import type {
  Equipment,
  Exercise,
  ExerciseAlternative,
  ExerciseCategory,
  ExerciseSource,
  MovementPattern,
} from '@/domain/exercise/exercise.types';

export type ListExercisesFilters = {
  category?: ExerciseCategory;
  equipment?: Equipment;
  movementPattern?: MovementPattern;
  query?: string;
  source?: ExerciseSource;
};

export type CreateCustomExerciseInput = {
  category?: ExerciseCategory;
  difficulty?: Exercise['difficulty'];
  equipment?: Equipment;
  movementPattern?: MovementPattern;
  name: string;
  notes?: string;
  secondaryMuscle?: string;
  targetMuscle: string;
};

export interface ExerciseRepository {
  getExerciseById(id: ID): Promise<Exercise | null>;
  listExercises(filters?: ListExercisesFilters): Promise<Exercise[]>;
  listExercisesByIds(ids: ID[]): Promise<Exercise[]>;
  findExerciseByName(name: string): Promise<Exercise | null>;
  createCustomExercise(input: CreateCustomExerciseInput): Promise<Exercise>;
  listAlternatives(exerciseId: ID): Promise<ExerciseAlternative[]>;
}
