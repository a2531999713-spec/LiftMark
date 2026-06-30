import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanDay, PlanExercise, PlanTemplate } from '@/domain/plan/plan.types';
import { colors, radius, spacing } from '@/theme';

type DayDetail = {
  day: PlanDay;
  exercises: PlanExercise[];
};

type PlanDetailState = {
  days: DayDetail[];
  exerciseMap: Record<string, Exercise>;
  plan: PlanTemplate;
};

function describePlanSource(source: PlanTemplate['source']) {
  const labels: Record<PlanTemplate['source'], string> = {
    system: '系统方案',
    user: '自建计划',
    system_copy: '系统方案副本',
    blank_created: '空白创建',
    imported: '导入计划',
    duplicated: '复制计划',
  };
  return labels[source];
}

function formatPrescription(exercise: PlanExercise): string {
  if (exercise.sets && exercise.reps) {
    return `${exercise.sets} 组 x ${exercise.reps} 次`;
  }

  if (exercise.sets && exercise.repMin && exercise.repMax) {
    return `${exercise.sets} 组 x ${exercise.repMin}-${exercise.repMax} 次`;
  }

  return exercise.sets ? `${exercise.sets} 组` : '按现场状态安排';
}

function formatIntensity(exercise: PlanExercise): string {
  if (exercise.percent1RM) {
    return `${Math.round(exercise.percent1RM * 1000) / 10}% 1RM`;
  }

  return '按状态调整';
}

export default function PlanDetailRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [detail, setDetail] = useState<PlanDetailState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    if (!planId) {
      setError('缺少计划 ID。');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const plan = await repositories.planRepository.getPlanById(planId);
      if (!plan) {
        throw new Error('计划不存在或已被移除。');
      }

      const days = await repositories.planRepository.listPlanDays(plan.id);
      const exerciseLists = await Promise.all(days.map((day) => repositories.planRepository.listPlanExercises(day.id)));
      const exerciseIds = Array.from(new Set(exerciseLists.flatMap((exercises) => exercises.map((exercise) => exercise.exerciseId))));
      const exercises = await repositories.exerciseRepository.listExercisesByIds(exerciseIds);

      setDetail({
        days: days.map((day, index) => ({ day, exercises: exerciseLists[index] ?? [] })),
        exerciseMap: Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
        plan,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划详情加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [planId, repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan]),
  );

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/plan')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="list-outline" size={20} />
        </Pressable>
      }
      subtitle={detail ? `${describePlanSource(detail.plan.source)} · ${detail.plan.durationWeeks} 周 · 每周 ${detail.plan.frequencyPerWeek} 天` : '计划摘要'}
      title={detail?.plan.name ?? '计划详情'}
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="计划详情暂时无法加载" description={error} /> : null}

      {!isLoading && !error && detail ? (
        <>
          <AppCard style={styles.summaryCard} tone="brand">
            <View style={styles.summaryHeader}>
              <View style={styles.summaryIcon}>
                <Ionicons color={colors.primary} name="clipboard-outline" size={22} />
              </View>
              <View style={styles.summaryText}>
                <AppText variant="subtitle">{detail.plan.name}</AppText>
                <AppText tone="muted" variant="bodySmall">
                  {detail.plan.description ?? '本地训练计划'}
                </AppText>
              </View>
              <Tag label="只读详情" tone="neutral" />
            </View>
            <View style={styles.metaRow}>
              <Tag label={describePlanSource(detail.plan.source)} tone="brand" />
              <Tag label={`${detail.plan.durationWeeks} 周`} tone="neutral" />
              <Tag label={`每周 ${detail.plan.frequencyPerWeek} 天`} tone="neutral" />
            </View>
          </AppCard>

          <SectionHeader subtitle="计划详情按数据读取，系统方案副本和导入计划都可查看。" title="训练日结构" />
          <View style={styles.dayList}>
            {detail.days.map(({ day, exercises }) => (
              <AppCard key={day.id} style={styles.dayCard}>
                <View style={styles.dayHeader}>
                  <View>
                    <AppText variant="bodySmall" weight="900">
                      Week {day.week} · Day {day.weekday}
                    </AppText>
                    <AppText variant="subtitle">{day.title}</AppText>
                  </View>
                  <Tag label={`${exercises.length} 个动作`} tone="accent" />
                </View>
                {day.notes ? (
                  <AppText tone="muted" variant="caption">
                    {day.notes}
                  </AppText>
                ) : null}
                <View style={styles.exerciseList}>
                  {exercises.slice(0, 5).map((exercise) => (
                    <View key={exercise.id} style={styles.exerciseRow}>
                      <View style={styles.exerciseOrder}>
                        <AppText tone="inverse" variant="caption">
                          {exercise.orderIndex + 1}
                        </AppText>
                      </View>
                      <View style={styles.exerciseText}>
                        <AppText numberOfLines={1} variant="bodySmall" weight="900">
                          {detail.exerciseMap[exercise.exerciseId]?.name ?? '未知动作'}
                        </AppText>
                        <AppText tone="muted" variant="caption">
                          {formatPrescription(exercise)} · {formatIntensity(exercise)}
                          {exercise.restSeconds ? ` · 休息 ${exercise.restSeconds} 秒` : ''}
                        </AppText>
                      </View>
                    </View>
                  ))}
                  {exercises.length > 5 ? (
                    <AppText tone="muted" variant="caption">
                      另有 {exercises.length - 5} 个动作，训练执行页会按完整计划读取。
                    </AppText>
                  ) : null}
                </View>
              </AppCard>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  summaryCard: {
    gap: spacing.md,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dayList: {
    gap: spacing.sm,
  },
  dayCard: {
    gap: spacing.md,
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exerciseOrder: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
});
