export type {
  AchievementActivityWeek,
  AchievementCode,
  AchievementDefinition,
  AchievementMetric,
  AchievementMetrics,
  AchievementProgress,
  AchievementSnapshot,
} from '@liftmark/shared';

export type AchievementSnapshotSource = 'local' | 'merged' | 'remote';

export type DisplayAchievementSnapshot = import('@liftmark/shared').AchievementSnapshot & {
  source: AchievementSnapshotSource;
};

