import type { RecoveryMode } from '../plan/plan.service';
import type { RecoveryRecommendation } from './recovery.types';

export type RecoveryScoreInput = {
  sleepScore: number;
  appetiteScore: number;
  motivationScore: number;
  sorenessScore: number;
  jointPainScore: number;
};

export type RecoveryScoreResult = {
  totalScore: number;
  recommendation: RecoveryRecommendation;
  recoveryMode: RecoveryMode;
};

export function calculateRecoveryScore(input: RecoveryScoreInput): RecoveryScoreResult {
  const totalScore =
    input.sleepScore +
    input.appetiteScore +
    input.motivationScore +
    (6 - input.sorenessScore) +
    (6 - input.jointPainScore);

  if (input.jointPainScore >= 4 || totalScore < 16) {
    return {
      totalScore,
      recommendation: 'only_a',
      recoveryMode: 'bad',
    };
  }

  if (totalScore <= 19) {
    return {
      totalScore,
      recommendation: 'remove_c',
      recoveryMode: 'normal',
    };
  }

  return {
    totalScore,
    recommendation: 'normal',
    recoveryMode: 'good',
  };
}
