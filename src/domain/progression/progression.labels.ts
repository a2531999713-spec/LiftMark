import type { ProgressionSuggestionType } from './progression.types';

export const progressionSuggestionLabels: Record<ProgressionSuggestionType, string> = {
  increase: '下次加重',
  maintain: '下次维持',
  decrease: '建议降重',
  deload: '建议减量',
  add_reps: '继续加次数',
  maintain_or_decrease: '维持或降重',
};

export function formatProgressionSuggestionLabel(suggestion: ProgressionSuggestionType): string {
  return progressionSuggestionLabels[suggestion];
}
