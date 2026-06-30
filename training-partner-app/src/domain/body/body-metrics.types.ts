import type { ID } from '@/domain/common/ids';

export type BodyMetric = {
  id: ID;
  memberId: ID;
  date: string;
  weightKg?: number;
  bodyFatPercent?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  bicepCm?: number;
  thighCm?: number;
  calfCm?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type BodyMetricGoalType = 'bulk' | 'cut' | 'maintain';

export type BodyMetricGoal = {
  id: ID;
  memberId: ID;
  goalType: BodyMetricGoalType;
  targetWeightKg?: number;
  targetDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type UpsertBodyMetricGoalInput = {
  memberId: ID;
  goalType: BodyMetricGoalType;
  targetWeightKg?: number;
  targetDate?: string;
  notes?: string;
};

export type UpsertBodyMetricInput = {
  memberId: ID;
  date: string;
  weightKg?: number;
  bodyFatPercent?: number;
  chestCm?: number;
  waistCm?: number;
  hipCm?: number;
  bicepCm?: number;
  thighCm?: number;
  calfCm?: number;
  notes?: string;
};

export type BodyMetricTrendPoint = {
  label: string;
  value: number;
  rawDate: string;
};
