import type { ID } from '../common/ids';
import type { Equipment } from '../exercise/exercise.types';
import type { IntensityType, PlanTemplate } from '../plan/plan.types';

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

export type ProgressionStrategy = 'strength' | 'hypertrophy' | 'general';

/** A UI-independent summary of one member's completed work for one exercise. */
export type ExercisePerformanceSnapshot = {
  completedReps: number[];
  completedSets: number;
  completedWeights: number[];
  equipment?: Equipment;
  exerciseId: ID;
  failedSetCount: number;
  intensityType?: IntensityType;
  latestWorkingWeight?: number;
  memberId: ID;
  planGoal?: PlanTemplate['goal'];
  plannedRepMax?: number;
  plannedRepMin?: number;
  plannedReps?: number;
  plannedSets: number;
  progressionRuleId?: ID;
  sessionId: ID;
  skippedSets: number;
  weightIncrement: number;
};

export type ExercisePerformanceSummary = {
  allSetsReachedRepMax: boolean;
  allSetsReachedRepMin: boolean;
  allSetsReachedTarget: boolean;
  averageReps: number;
  hasValidWorkingSets: boolean;
  repCompletionRate: number;
  setCompletionRate: number;
  workingWeightConsistency: boolean;
};

export type HistoricalExercisePerformance = Pick<
  ExercisePerformanceSummary,
  'allSetsReachedTarget' | 'hasValidWorkingSets' | 'repCompletionRate'
>;

export type ProgressionDecision = Pick<ProgressionSuggestion, 'reason' | 'suggestedWeight' | 'suggestion'> & {
  performance: ExercisePerformanceSummary;
  strategy: ProgressionStrategy;
};
