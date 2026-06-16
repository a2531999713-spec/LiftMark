import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppModalSheet,
  AppText,
  EmptyState,
  Screen,
  SectionHeader,
  Tag,
  VisualHeroCard,
} from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import type { PhaseType, PlanTemplate, TodayPlanResult, Weekday } from '@/domain/plan/plan.types';
import { colors, radius, spacing } from '@/theme';

type PlanSwitchNotice = {
  message: string;
  title: string;
};

function getTodayWeekday(): Weekday {
  const day = new Date().getDay();
  return (day === 0 ? 7 : day) as Weekday;
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatWeekday(day: Weekday): string {
  const labels: Record<Weekday, string> = { 1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日' };
  return labels[day];
}

function formatPlanSource(source: PlanTemplate['source']): string {
  const labels: Record<PlanTemplate['source'], string> = {
    system: '系统方案', user: '自建计划', system_copy: '系统方案副本',
    blank_created: '空白创建', imported: '导入计划', duplicated: '复制计划',
  };
  return labels[source];
}

export default function HomeRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [todayPlan, setTodayPlan] = useState<TodayPlanResult | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPlanSwitcherVisible, setIsPlanSwitcherVisible] = useState(false);
  const [pendingSwitchPlan, setPendingSwitchPlan] = useState<PlanTemplate | null>(null);
  const [planSwitchNotice, setPlanSwitchNotice] = useState<PlanSwitchNotice | null>(null);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});

  const loadHomeState = useCallback(async () => {
    try {
      await initializeLocalDatabase();
      const [nextGroup, nextUserPlans] = await Promise.all([
        repositories.groupRepository.getDefaultGroup(),
        repositories.planRepository.listUserPlans(),
      ]);
      setGroup(nextGroup);
      setUserPlans(nextUserPlans);

      if (nextGroup?.activePlanId) {
        const plan = await repositories.planRepository.getPlanById(nextGroup.activePlanId);
        setActivePlan(plan);

        if (plan) {
          try {
            const phases = await repositories.planRepository.listPlanPhases(plan.id);
            const phaseType: PhaseType = phases[0]?.type ?? 'custom';
            const today = await repositories.planRepository.getTodayPlan({
              groupId: nextGroup.id,
              planId: plan.id,
              phaseType,
              currentWeek: nextGroup.currentWeek ?? 1,
              weekday: getTodayWeekday(),
              fridayEnabled: nextGroup.fridayEnabled ?? false,
            });
            setTodayPlan(today);

            if (today?.exercises) {
              const exerciseIds = today.exercises.map((e) => e.exerciseId);
              const exercises = await repositories.exerciseRepository.listExercisesByIds(exerciseIds);
              const map: Record<string, Exercise> = {};
              exercises.forEach((e) => { map[e.id] = e; });
              setExerciseMap(map);
            }
          } catch {
            // today plan not available
          }
        }
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(useCallback(() => { void loadHomeState(); }, [loadHomeState]));

  const switchPlan = useCallback(async (plan: PlanTemplate) => {
    if (!group) return;
    try {
      const phases = await repositories.planRepository.listPlanPhases(plan.id);
      const phaseType: PhaseType = phases[0]?.type ?? 'custom';
      await repositories.groupRepository.updateGroup(group.id, {
        activePlanId: plan.id,
        currentPhaseType: phaseType,
        currentWeek: 1,
      });
      setIsPlanSwitcherVisible(false);
      setPendingSwitchPlan(null);
      setPlanSwitchNotice({ title: '已切换计划', message: `"${plan.name}"已设为当前训练计划。` });
      await loadHomeState();
    } catch {
      // silent
    }
  }, [group, loadHomeState, repositories]);

  const todayWeekday = getTodayWeekday();
  const todayLabel = formatWeekday(todayWeekday);
  const activePlanWeeks = activePlan?.durationWeeks ?? 16;
  const planProgress = Math.min(100, Math.round(((group?.currentWeek ?? 1) / activePlanWeeks) * 100));
  const hasPlan = Boolean(group?.activePlanId && activePlan);
  const hasExercises = Boolean(todayPlan && !todayPlan.isRestDay && todayPlan.exercises.length > 0);
  const canStart = hasPlan && hasExercises;

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/settings')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="person-outline" size={20} />
        </Pressable>
      }
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {!isLoading && hasPlan ? (
        <>
          <VisualHeroCard
            eyebrow={todayLabel}
            icon="barbell-outline"
            imageSource={liftmarkImages.trainingHero}
            subtitle={`第 ${group?.currentWeek ?? 1} / ${activePlanWeeks} 周 · ${activePlan?.name ?? ''}`}
            title={todayPlan?.day?.title ?? (todayPlan?.isRestDay ? '休息日' : '今日训练')}
          >
            <View style={styles.heroStats}>
              <View>
                <AppText tone="inverse" variant="caption">计划进度</AppText>
                <AppText tone="inverse" variant="subtitle">{planProgress}%</AppText>
              </View>
              <View style={styles.heroDivider} />
              <View>
                <AppText tone="inverse" variant="caption">今日动作</AppText>
                <AppText tone="inverse" variant="subtitle">{todayPlan?.exercises.length ?? 0} 个</AppText>
              </View>
            </View>
          </VisualHeroCard>

          {canStart ? (
            <AppButton
              icon="play-outline"
              onPress={() => {
                if (!group || !todayPlan) return;
                void (async () => {
                  try {
                    const session = await repositories.workoutRepository.createSessionFromTodayPlan({
                      date: getLocalDateString(),
                      groupId: group.id,
                      phaseId: todayPlan.phase.id,
                      planExerciseIds: todayPlan.exercises.map((e) => e.id),
                      planId: todayPlan.plan.id,
                      title: todayPlan.day?.title ?? '今日训练',
                      week: todayPlan.day?.week ?? 1,
                      weekday: todayPlan.day?.weekday ?? getTodayWeekday(),
                    });
                    router.push({ pathname: '/workout/[sessionId]', params: { sessionId: session.id } });
                  } catch {
                    // silent
                  }
                })();
              }}
              size="lg"
            >
              开始训练
            </AppButton>
          ) : todayPlan?.isRestDay ? (
            <AppCard style={styles.restCard} tone="brand">
              <AppText variant="subtitle">今日休息</AppText>
              <AppText tone="muted" variant="body">恢复也是训练的一部分，好好休息。</AppText>
            </AppCard>
          ) : null}

          <SectionHeader title="快捷操作" />
          <View style={styles.quickGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/plan')}
              style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <Ionicons color={colors.primary} name="clipboard-outline" size={20} />
              </View>
              <View style={styles.quickText}>
                <AppText variant="bodySmall" weight="600">我的计划</AppText>
                <AppText tone="muted" variant="caption">{userPlans.length} 个计划</AppText>
              </View>
              <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/history')}
              style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <Ionicons color={colors.primary} name="bar-chart-outline" size={20} />
              </View>
              <View style={styles.quickText}>
                <AppText variant="bodySmall" weight="600">训练记录</AppText>
                <AppText tone="muted" variant="caption">查看历史数据</AppText>
              </View>
              <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history/manual' as never)}
              style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <Ionicons color={colors.primary} name="add-circle-outline" size={20} />
              </View>
              <View style={styles.quickText}>
                <AppText variant="bodySmall" weight="600">补录训练</AppText>
                <AppText tone="muted" variant="caption">记录过去的训练</AppText>
              </View>
              <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history/analytics' as never)}
              style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}
            >
              <View style={styles.quickIcon}>
                <Ionicons color={colors.primary} name="trending-up-outline" size={20} />
              </View>
              <View style={styles.quickText}>
                <AppText variant="bodySmall" weight="600">训练分析</AppText>
                <AppText tone="muted" variant="caption">查看进步趋势</AppText>
              </View>
              <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
            </Pressable>
          </View>

          {todayPlan && todayPlan.exercises.length > 0 ? (
            <>
              <SectionHeader title={`今日动作 · ${todayPlan.day?.title ?? '今日训练'}`} />
              <View style={styles.exerciseList}>
                {todayPlan.exercises.slice(0, 5).map((planExercise, index) => {
                  const exercise = exerciseMap[planExercise.exerciseId];
                  return (
                    <AppCard key={planExercise.id} style={styles.exerciseCard}>
                      <View style={styles.exerciseRow}>
                        <View style={[styles.exerciseBadge, index === 0 && styles.exerciseBadgeA, index === 1 && styles.exerciseBadgeB]}>
                          <AppText tone="inverse" variant="caption" weight="700">
                            {planExercise.priority}
                          </AppText>
                        </View>
                        <View style={styles.exerciseInfo}>
                          <AppText variant="bodySmall" weight="600">{exercise?.name ?? planExercise.exerciseId}</AppText>
                        <AppText tone="muted" variant="caption">
                          {planExercise.sets}组 × {planExercise.reps ?? `${planExercise.repMin}-${planExercise.repMax}`}次
                        </AppText>
                      </View>
                    </View>
                  </AppCard>
                  );
                })}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      {!isLoading && !hasPlan ? (
        <EmptyState
          actionLabel="选择训练计划"
          description="从系统方案中选择一个，开始你的训练之旅。"
          onActionPress={() => router.push('/(tabs)/plan')}
          title="还没有训练计划"
        />
      ) : null}

      <AppModalSheet
        onClose={() => setIsPlanSwitcherVisible(false)}
        title="切换计划"
        visible={isPlanSwitcherVisible}
      >
        <View style={styles.planList}>
          {userPlans.map((plan) => {
            const isActive = plan.id === group?.activePlanId;
            return (
              <Pressable
                accessibilityRole="button"
                disabled={isActive}
                key={plan.id}
                onPress={() => setPendingSwitchPlan(plan)}
                style={({ pressed }) => [styles.planItem, isActive && styles.planItemActive, pressed && styles.pressed]}
              >
                <View style={styles.planIcon}>
                  <Ionicons color={isActive ? colors.surface : colors.primary} name="clipboard-outline" size={18} />
                </View>
                <View style={styles.planInfo}>
                  <AppText tone={isActive ? 'inverse' : 'default'} variant="bodySmall" weight="600">{plan.name}</AppText>
                  <AppText tone={isActive ? 'inverse' : 'muted'} variant="caption">
                    {formatPlanSource(plan.source)} · {plan.durationWeeks}周 · 每周{plan.frequencyPerWeek}练
                  </AppText>
                </View>
                {isActive ? <Tag label="当前" tone="dark" /> : <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />}
              </Pressable>
            );
          })}
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setPendingSwitchPlan(null)}
        title="确认切换"
        visible={Boolean(pendingSwitchPlan)}
      >
        {pendingSwitchPlan ? (
          <View style={styles.switchInfo}>
            <AppText variant="bodySmall" weight="600">{pendingSwitchPlan.name}</AppText>
            <AppText tone="muted" variant="caption">切换后今日训练将按新计划生成</AppText>
          </View>
        ) : null}
        <View style={styles.switchActions}>
          <AppButton onPress={() => setPendingSwitchPlan(null)} variant="secondary">取消</AppButton>
          <AppButton onPress={() => pendingSwitchPlan && void switchPlan(pendingSwitchPlan)}>确认切换</AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setPlanSwitchNotice(null)}
        position="center"
        subtitle={planSwitchNotice?.message}
        title={planSwitchNotice?.title ?? '已切换'}
        visible={Boolean(planSwitchNotice)}
      >
        <AppButton onPress={() => setPlanSwitchNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  heroStats: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  heroDivider: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    height: 48,
    width: 1,
  },
  restCard: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
  },
  quickGrid: {
    gap: spacing.sm,
  },
  quickEntry: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.lg,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickText: {
    flex: 1,
    gap: 2,
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseCard: {
    padding: spacing.md,
  },
  exerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  exerciseBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  exerciseBadgeA: {
    backgroundColor: colors.primary,
  },
  exerciseBadgeB: {
    backgroundColor: colors.accent,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  planList: {
    gap: spacing.sm,
  },
  planItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  planItemActive: {
    backgroundColor: colors.dark,
  },
  planIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  planInfo: {
    flex: 1,
    gap: 2,
  },
  switchInfo: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  switchActions: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
