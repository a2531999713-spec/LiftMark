import type { AchievementMetric, AchievementProgress } from '@liftmark/shared';

export function formatAchievementValue(value: number, metric: AchievementMetric, unit: 'kg' | 'lb' = 'kg'): string {
  if (metric === 'total_volume') {
    const converted = unit === 'lb' ? value * 2.2046226218 : value;
    if (converted >= 1000) return `${(converted / 1000).toFixed(converted >= 10_000 ? 0 : 1)}k ${unit}`;
    return `${Math.round(converted)} ${unit}`;
  }
  if (metric === 'longest_active_week_streak') return `${Math.round(value)} 周`;
  return `${Math.round(value)} 次`;
}

export function formatAchievementDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

export function remainingAchievementText(achievement: AchievementProgress): string {
  const remaining = Math.max(0, achievement.target - achievement.progress);
  if (achievement.metric === 'total_volume') return `还差 ${formatAchievementValue(remaining, achievement.metric)}`;
  if (achievement.metric === 'longest_active_week_streak') return `还差 ${Math.ceil(remaining)} 周`;
  return `还差 ${Math.ceil(remaining)} 次`;
}

