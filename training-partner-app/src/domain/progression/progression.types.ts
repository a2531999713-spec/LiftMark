import type { ID } from '../common/ids';

export type ProgressionSuggestionType =
  | 'increase'
  | 'maintain'
  | 'decrease'
  | 'deload'
  | 'add_reps'
  | 'maintain_or_decrease';

export type ProgressionSuggestion = {
  id: ID;
  memberId: ID;
  exerciseId: ID;
  sessionId: ID;
  suggestion: ProgressionSuggestionType;
  suggestedWeight?: number;
  reason: string;
  createdAt: string;
};
