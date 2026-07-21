import { Ionicons } from '@expo/vector-icons';
import { ACHIEVEMENT_CATALOG } from '@liftmark/shared';
import type { AchievementCode, AchievementMetric } from '@liftmark/shared';
import type { ComponentProps } from 'react';

export { ACHIEVEMENT_CATALOG };

export const ACHIEVEMENT_CODE_SET = new Set<AchievementCode>(
  ACHIEVEMENT_CATALOG.map((item) => item.code),
);

export const ACHIEVEMENT_ICON_BY_METRIC: Record<
  AchievementMetric,
  ComponentProps<typeof Ionicons>['name']
> = {
  completed_workouts: 'checkmark-circle-outline',
  longest_active_week_streak: 'calendar-outline',
  total_volume: 'barbell-outline',
  group_workouts: 'people-outline',
  completed_cycles: 'repeat-outline',
  recovery_checkins: 'pulse-outline',
};
