import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_CODES } from '@liftmark/shared';
import type { AchievementCode, AchievementMetric, AchievementMetrics, AchievementProgress } from '@liftmark/shared';

import { createId } from '../../utils/ids';

export type DefinitionRow = {
  id: string;
  code: string;
  name: string;
  description: string;
  metric: AchievementMetric;
  target: number | string;
};

export type ExistingRow = {
  id: string;
  achievement_definition_id: string;
  progress: number | string;
  achieved_at: Date | string | null;
  created_at: Date | string;
};

function metricValue(metrics: AchievementMetrics, metric: AchievementMetric): number {
  const values: Record<AchievementMetric, number> = {
    completed_workouts: metrics.completedWorkouts,
    longest_active_week_streak: metrics.longestActiveWeekStreak,
    total_volume: metrics.totalVolume,
    group_workouts: metrics.groupWorkouts,
    completed_cycles: metrics.completedCycles,
    recovery_checkins: metrics.recoveryCheckins,
  };
  const value = Number(values[metric] ?? 0);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function buildAchievementReconciliation(input: {
  definitions: DefinitionRow[];
  existingRows: ExistingRow[];
  metrics: AchievementMetrics;
  now: Date;
}) {
  const supported = new Set<string>(ACHIEVEMENT_CODES);
  const definitions = input.definitions.filter((row) => supported.has(row.code));
  const existingByDefinition = new Map(input.existingRows.map((row) => [row.achievement_definition_id, row]));
  const rows = definitions.map((definition) => {
    const existing = existingByDefinition.get(definition.id);
    const currentProgress = metricValue(input.metrics, definition.metric);
    const progress = Math.max(currentProgress, Number(existing?.progress ?? 0) || 0);
    const target = Math.max(0, Number(definition.target) || 0);
    const achievedAt = existing?.achieved_at ?? (progress >= target ? input.now : null);
    return {
      id: existing?.id ?? createId('uach'),
      achievement_definition_id: definition.id,
      progress,
      achieved_at: achievedAt,
      created_at: existing?.created_at ?? input.now,
      updated_at: input.now,
    };
  });
  return { definitions, rows };
}

export async function reconcileUserAchievements(
  userId: string,
  metrics: AchievementMetrics,
  now = new Date(),
): Promise<AchievementProgress[]> {
  const { db } = await import('../../db/connection');
  const [definitionRows, existingRows] = await Promise.all([
    db<DefinitionRow>('achievement_definitions').where({ enabled: true }).orderBy('created_at', 'asc'),
    db<ExistingRow>('user_achievements').where({ user_id: userId }),
  ]);
  const catalogByCode = new Map(ACHIEVEMENT_CATALOG.map((item) => [item.code, item]));
  const { definitions, rows: plannedRows } = buildAchievementReconciliation({ definitions: definitionRows, existingRows, metrics, now });
  const rows = plannedRows.map((row) => ({
      ...row,
      user_id: userId,
    }));

  if (rows.length > 0) {
    await db.transaction(async (trx) => {
      await trx('user_achievements')
        .insert(rows)
        .onConflict(['user_id', 'achievement_definition_id'])
        .merge(['progress', 'achieved_at', 'updated_at']);
    });
  }

  return definitions.map((definition) => {
    const catalog = catalogByCode.get(definition.code as AchievementCode);
    const saved = rows.find((row) => row.achievement_definition_id === definition.id)!;
    const target = Math.max(0, Number(definition.target) || 0);
    return {
      code: definition.code as AchievementCode,
      name: definition.name,
      description: definition.description,
      metric: definition.metric,
      target,
      sortOrder: catalog?.sortOrder ?? Number.MAX_SAFE_INTEGER,
      progress: Number(saved.progress),
      achieved: Boolean(saved.achieved_at),
      achievedAt: saved.achieved_at ? new Date(saved.achieved_at).toISOString() : null,
    };
  }).sort((left, right) => left.sortOrder - right.sortOrder);
}
