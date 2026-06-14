import type { ID } from '../common/ids';

export type RecoveryRecommendation =
  | 'normal'
  | 'remove_c'
  | 'only_a'
  | 'reduce_weight'
  | 'deload'
  | 'rest';

export type RecoveryLog = {
  id: ID;
  memberId: ID;
  date: string;
  sleepScore: number;
  appetiteScore: number;
  motivationScore: number;
  sorenessScore: number;
  jointPainScore: number;
  fatigueScore: number;
  totalScore: number;
  recommendation: RecoveryRecommendation;
  createdAt: string;
};
