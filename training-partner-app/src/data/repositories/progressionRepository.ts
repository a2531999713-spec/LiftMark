import type { ID } from '@/domain/common/ids';
import type { ProgressionSuggestion } from '@/domain/progression/progression.types';

export interface ProgressionRepository {
  createSuggestionsForSession(sessionId: ID): Promise<ProgressionSuggestion[]>;
  listSuggestionsForSession(sessionId: ID): Promise<ProgressionSuggestion[]>;
  listSuggestionsForMember(memberId: ID): Promise<ProgressionSuggestion[]>;
  listSuggestionsForMemberExercise(input: { exerciseId: ID; groupId: ID; limit?: number; memberId: ID }): Promise<ProgressionSuggestion[]>;
  getLatestSuggestion(memberId: ID, exerciseId: ID): Promise<ProgressionSuggestion | null>;
}
