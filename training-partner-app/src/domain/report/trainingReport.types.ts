import type { ID } from '../common/ids';

export type TrainingIntensityLevel = 'low' | 'medium' | 'high';

export type TrainingReport = {
  id: ID;
  ownerUserId?: ID;
  groupId: ID;
  memberId?: ID;
  planId: ID;
  planCycleId?: ID;
  workoutSessionId: ID;
  reportDate: string;
  durationSeconds: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  exerciseCount: number;
  estimatedCalories: number;
  estimatedCaloriesMin: number;
  estimatedCaloriesMax: number;
  intensityLevel: TrainingIntensityLevel;
  muscleGroupSummaryJson?: string;
  exerciseSummaryJson?: string;
  personalRecordsJson?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

