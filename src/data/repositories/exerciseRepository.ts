import type { ID } from '@/domain/common/ids';
import type { Exercise, ExerciseAlternative } from '@/domain/exercise/exercise.types';

export interface ExerciseRepository {
  getExerciseById(id: ID): Promise<Exercise | null>;
  listExercises(): Promise<Exercise[]>;
  listExercisesByIds(ids: ID[]): Promise<Exercise[]>;
  listAlternatives(exerciseId: ID): Promise<ExerciseAlternative[]>;
}
