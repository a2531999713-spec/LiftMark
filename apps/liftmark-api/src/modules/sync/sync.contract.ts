import type { GenericSyncEntityType } from '@liftmark/shared';

export const syncEntityTableByType = {
  exercises: 'exercises',
  workoutSessions: 'workout_sessions',
  workoutExerciseRecords: 'workout_exercise_records',
  workoutSets: 'workout_sets',
  trainingPlans: 'training_plans',
  planCycles: 'plan_cycles',
  planCycleSummaries: 'plan_cycle_summaries',
  planPhases: 'plan_phases',
  planDays: 'plan_days',
  planExercises: 'plan_exercises',
  trainingReports: 'training_reports',
  trainingReminders: 'training_reminders',
  bodyMetrics: 'body_metrics',
  bodyMetricGoals: 'body_metric_goals',
  recoveryLogs: 'recovery_logs',
  progressionSuggestions: 'progression_suggestions',
  settings: 'settings',
} as const satisfies Record<GenericSyncEntityType, string>;

export type SyncEntityType = GenericSyncEntityType;

export const requiredSyncTables = [...new Set(Object.values(syncEntityTableByType))];
