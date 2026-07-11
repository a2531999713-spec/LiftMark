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

export type TrainingReportSessionType = 'planned' | 'free' | 'manual';

export type TrainingReportSetSource = {
  completed: boolean;
  memberId: ID;
  memberName: string;
  reps: number;
  setNumber: number;
  skipped: boolean;
  weight: number;
};

export type TrainingReportExerciseSource = {
  exerciseId: ID;
  exerciseName: string;
  isTemporary: boolean;
  recordId: ID;
  replacedFromExerciseName?: string;
  sets: TrainingReportSetSource[];
};

export type TrainingReportSource = {
  cycleName?: string;
  finishedAt?: string;
  groupId: ID;
  hasReport: boolean;
  notes?: string;
  ownerUserId: ID;
  planCycleId?: ID;
  planDayId?: ID;
  planId: ID;
  planName?: string;
  report?: TrainingReport;
  sessionDate: string;
  sessionId: ID;
  sessionTitle: string;
  sessionType: TrainingReportSessionType;
  startedAt?: string;
  week: number;
  weekday: number;
  exercises: TrainingReportExerciseSource[];
  participantBodyweights: { memberId: ID; memberName: string; weightKg?: number }[];
};

export type TrainingReportExerciseView = {
  completedSets: number;
  exerciseId: ID;
  exerciseName: string;
  isTemporary: boolean;
  memberNames: string[];
  recordId: ID;
  replacedFromExerciseName?: string;
  sets: TrainingReportSetSource[];
  totalReps: number;
  totalVolume: number;
};

export type TrainingReportMemberView = {
  completedSets: number;
  memberId: ID;
  memberName: string;
  totalReps: number;
  totalVolume: number;
};

export type TrainingReportDetail = {
  calorieEstimateUsedDefaultBodyweight: boolean;
  cycleName?: string;
  durationSeconds: number;
  estimatedCalories: number;
  estimatedCaloriesMax: number;
  estimatedCaloriesMin: number;
  exerciseCount: number;
  exercises: TrainingReportExerciseView[];
  finishedAt?: string;
  groupId: ID;
  intensityLevel: TrainingIntensityLevel;
  isHistoricalFallback: boolean;
  members: TrainingReportMemberView[];
  notes?: string;
  planCycleId?: ID;
  planId: ID;
  planName?: string;
  reportId?: ID;
  sessionDate: string;
  sessionId: ID;
  sessionTitle: string;
  sessionType: TrainingReportSessionType;
  startedAt?: string;
  totalReps: number;
  totalSets: number;
  totalVolume: number;
  week: number;
  weekday: number;
};

