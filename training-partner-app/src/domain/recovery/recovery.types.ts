import type { ID } from '../common/ids';

export type RecoveryRecommendation =
  | 'normal'
  | 'remove_c'
  | 'only_a'
  | 'reduce_weight'
  | 'deload'
  | 'rest';

export type RecoveryStatus = 'good' | 'normal' | 'low' | 'bad' | 'rest';

export type RecoveryLog = {
  id: ID;
  ownerUserId?: ID;
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
  updatedAt: string;
};

export type RecoveryAssessmentResult = {
  totalScore: number;
  status: RecoveryStatus;
  recommendation: RecoveryRecommendation;
  recoveryMode: 'good' | 'normal' | 'bad' | 'very_bad';
  title: string;
  summary: string;
  reasons: string[];
  suggestedWeightReductionPercent?: number;
};

export type RecoveryScoreValues = Pick<
  RecoveryLog,
  | 'sleepScore'
  | 'appetiteScore'
  | 'motivationScore'
  | 'sorenessScore'
  | 'jointPainScore'
  | 'fatigueScore'
>;

export type UpsertRecoveryLogInput = RecoveryScoreValues & {
  ownerUserId: ID;
  memberId: ID;
  date: string;
  totalScore: number;
  recommendation: RecoveryRecommendation;
};

export type RecoveryTrendSummary = {
  logs: RecoveryLog[];
  averageScore: number | null;
  goodCount: number;
  lowCount: number;
  hasConsecutiveLowStatus: boolean;
};
