import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppModalSheet,
  AppText,
  EmptyState,
  PriorityTag,
  Screen,
  SectionHeader,
  Tag,
} from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { PhaseType, PlanDay, PlanExercise, PlanTemplate, TodayPlanResult, Weekday } from '@/domain/plan/plan.types';
import type { RecoveryMode } from '@/domain/plan/plan.service';
import { calculateSuggestedWeight } from '@/domain/weight/weight-calculator';
import { colors, radius, shadows, spacing } from '@/theme';

type RecoveryOption = {
  icon: 'happy-outline' | 'ellipse-outline' | 'sad-outline' | 'moon-outline';
  mode: RecoveryMode;
  label: string;
};

type TrainingChoice = {
  key: 'today' | `day${number}` | 'weak' | 'free';
  label: string;
  subtitle: string;
  weekday?: Weekday;
  forceFriday?: boolean;
  free?: boolean;
};

type PlanSwitchNotice = {
  message: string;
  title: string;
};

type SuggestedWeightDisplay = {
  hint: string;
  value: string;
};

const recoveryOptions: RecoveryOption[] = [
  { icon: 'happy-outline', mode: 'good', label: '状态好' },
  { icon: 'ellipse-outline', mode: 'normal', label: '一般' },
  { icon: 'sad-outline', mode: 'bad', label: '状态差' },
  { icon: 'moon-outline', mode: 'very_bad', label: '休息' },
];

const fallbackPlanDayChoices: TrainingChoice[] = [
  { key: 'day1', label: 'Day 1', subtitle: '训练日', weekday: 1 },
  { key: 'day2', label: 'Day 2', subtitle: '训练日', weekday: 2 },
  { key: 'day3', label: 'Day 3', subtitle: '训练日', weekday: 3 },
  { key: 'day4', label: 'Day 4', subtitle: '训练日', weekday: 4 },
];

const specialTrainingChoices: TrainingChoice[] = [
  { key: 'weak', label: '补弱', subtitle: '针对薄弱部位', weekday: 5, forceFriday: true },
  { key: 'free', label: '自由训练', subtitle: '自定义训练', free: true },
];

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

function formatPrescription(exercise: PlanExercise): string {
  if (exercise.sets && exercise.reps) {
    return `${exercise.sets} 组 x ${exercise.reps} 次`;
  }

  if (exercise.sets && exercise.repMin && exercise.repMax) {
    return `${exercise.sets} 组 x ${exercise.repMin}-${exercise.repMax} 次`;
  }

  if (exercise.sets) {
    return `${exercise.sets} 组`;
  }

  return '按现场状态安排';
}

function formatIntensity(exercise: PlanExercise): string {
  const parts = [];

  if (exercise.percent1RM) {
    parts.push(`${Math.round(exercise.percent1RM * 1000) / 10}% 1RM`);
  }

  if (exercise.rpeTarget) {
    parts.push(`RPE ${exercise.rpeTarget}`);
  }

  if (exercise.rirTarget) {
    parts.push(`RIR ${exercise.rirTarget}`);
  }

  return parts.length > 0 ? parts.join(' · ') : '按状态调整重量';
}

function formatSuggestedWeight(
  planExercise: PlanExercise | null,
  exercise: Exercise | null,
  profile: MemberProfile | null,
): SuggestedWeightDisplay {
  if (!profile) {
    return { value: '未设置资料', hint: '补充 1RM 后自动计算' };
  }

  if (!planExercise) {
    return { value: '参考上次重量', hint: '自由训练可手动输入' };
  }

  const result = calculateSuggestedWeight({
    referenceLift: planExercise.referenceLift,
    percent1RM: planExercise.percent1RM,
    repMax: planExercise.repMax,
    repMin: planExercise.repMin,
    reps: planExercise.reps,
    equipment: exercise?.equipment ?? 'other',
    profile,
  });

  if (result.status === 'ready') {
    return {
      value: `${result.weight} kg`,
      hint: result.percent1RM
        ? `按 ${Math.round(result.percent1RM * 100)}% 参考主项估算`
        : '按计划次数估算',
    };
  }

  if (result.status === 'missing_1rm') {
    return { value: '缺少 1RM', hint: '去成员资料补充参考主项' };
  }

  return { value: '参考上次重量', hint: '孤立或器械动作先按历史重量调整' };
}

function formatFridayStrategy(strategy: Group['fridayStrategy']) {
  if (strategy === 'allow_weak') {
    return '允许补弱';
  }

  if (strategy === 'allow_free') {
    return '允许自由训练';
  }

  return '默认休息';
}

function formatPlanSource(source: PlanTemplate['source']) {
  const labels: Record<PlanTemplate['source'], string> = {
    system: '系统方案',
    user: '手动创建',
    system_copy: '来自系统方案',
    blank_created: '空白创建',
    imported: '导入计划',
    duplicated: '复制计划',
  };
  return labels[source];
}

function getDayKey(weekday: Weekday): `day${number}` {
  return `day${weekday}`;
}

function buildPlanDayChoices(days: PlanDay[], currentWeek: number): TrainingChoice[] {
  const scopedDays = days.filter((day) => day.week === currentWeek);
  const candidates = scopedDays.length > 0 ? scopedDays : days;
  const seen = new Set<number>();

  const choices = candidates
    .slice()
    .sort((a, b) => a.weekday - b.weekday || a.title.localeCompare(b.title))
    .flatMap((day) => {
      if (seen.has(day.weekday)) {
        return [];
      }

      seen.add(day.weekday);
      return [
        {
          key: getDayKey(day.weekday),
          label: `Day ${day.weekday}`,
          subtitle: day.title,
          weekday: day.weekday,
        } satisfies TrainingChoice,
      ];
    });

  return choices.length > 0 ? choices : fallbackPlanDayChoices;
}

function resolveChoiceForExecution(key: TrainingChoice['key'], todayWeekday: Weekday): TrainingChoice {
  if (key === 'today') {
    return { key: 'today', label: '今天', subtitle: '按今日安排', weekday: todayWeekday };
  }

  if (key === 'weak') {
    return specialTrainingChoices[0];
  }

  if (key === 'free') {
    return specialTrainingChoices[1];
  }

  const weekday = Number(key.replace('day', '')) as Weekday;
  return { key, label: `Day ${weekday}`, subtitle: '训练日', weekday };
}

function getChoiceByKey(key: TrainingChoice['key'], choices: TrainingChoice[], todayWeekday: Weekday) {
  if (key === 'today') {
    return resolveChoiceForExecution(key, todayWeekday);
  }

  return choices.find((choice) => choice.key === key) ?? resolveChoiceForExecution(key, todayWeekday);
}

function getGreetingByHour(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export default function TodayRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const todayWeekday = useMemo(() => getTodayWeekday(), []);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('good');
  const [selectedChoiceKey, setSelectedChoiceKey] = useState<TrainingChoice['key']>('today');
  const [todayPlan, setTodayPlan] = useState<TodayPlanResult | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [planDayChoices, setPlanDayChoices] = useState<TrainingChoice[]>(fallbackPlanDayChoices);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [freeExercises, setFreeExercises] = useState<Exercise[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [group, setGroup] = useState<Group | null>(null);
  const [cycleLabel, setCycleLabel] = useState('');
  const [isPlanSwitcherVisible, setPlanSwitcherVisible] = useState(false);
  const [pendingSwitchPlan, setPendingSwitchPlan] = useState<PlanTemplate | null>(null);
  const [planSwitchNotice, setPlanSwitchNotice] = useState<PlanSwitchNotice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trainingChoices = useMemo<TrainingChoice[]>(() => [...planDayChoices, ...specialTrainingChoices], [planDayChoices]);

  const selectedChoice = useMemo<TrainingChoice>(
    () => getChoiceByKey(selectedChoiceKey, trainingChoices, todayWeekday),
    [selectedChoiceKey, todayWeekday, trainingChoices],
  );

  const loadTodayPlan = useCallback(async (choiceKey = selectedChoiceKey) => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const [nextActivePlan, nextUserPlans, nextPlanDays] = await Promise.all([
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
        repositories.planRepository.listUserPlans(),
        repositories.planRepository.listPlanDays(nextGroup.activePlanId),
      ]);
      const effectiveChoice = resolveChoiceForExecution(choiceKey, todayWeekday);
      const phaseType = nextGroup.currentPhaseType as PhaseType;
      const effectiveRecoveryMode = recoveryMode === 'very_bad' ? 'bad' : recoveryMode;
      const effectiveWeekday = effectiveChoice.weekday ?? todayWeekday;
      const manualFriday =
        effectiveChoice.forceFriday || nextGroup.fridayStrategy === 'allow_weak' || nextGroup.fridayStrategy === 'allow_free';
      const result = effectiveChoice.free
        ? null
        : await repositories.planRepository.getTodayPlan({
            currentWeek: nextGroup.currentWeek,
            fridayEnabled: manualFriday || nextGroup.fridayEnabled,
            groupId: nextGroup.id,
            phaseType,
            planId: nextGroup.activePlanId,
            recoveryMode: effectiveRecoveryMode,
            weekday: effectiveWeekday,
          });
      const nextMembers = await repositories.memberRepository.listMembers(nextGroup.id);
      const nextProfiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );
      const planExerciseIds = result?.exercises.map((exercise) => exercise.exerciseId) ?? [];
      const [nextExercises, allExercises] = await Promise.all([
        repositories.exerciseRepository.listExercisesByIds(planExerciseIds),
        repositories.exerciseRepository.listExercises(),
      ]);

      setTodayPlan(result);
      setMembers(nextMembers);
      setProfiles(Object.fromEntries(nextProfiles));
      setExerciseMap(Object.fromEntries(nextExercises.map((exercise) => [exercise.id, exercise])));
      setFreeExercises(allExercises.slice(0, 5));
      setGroup(nextGroup);
      setActivePlan(nextActivePlan);
      setUserPlans(nextUserPlans);
      setPlanDayChoices(buildPlanDayChoices(nextPlanDays, nextGroup.currentWeek));
      setCycleLabel(nextActivePlan ? `第 ${nextGroup.currentWeek}/${nextActivePlan.durationWeeks} 周` : '当前周期');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '今日训练加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, recoveryMode, selectedChoiceKey, todayWeekday]);

  useFocusEffect(
    useCallback(() => {
      void loadTodayPlan();
    }, [loadTodayPlan]),
  );

  const resolvePhaseTypeForPlan = useCallback(
    async (planId: string): Promise<PhaseType> => {
      const phases = await repositories.planRepository.listPlanPhases(planId);
      return phases[0]?.type ?? 'custom';
    },
    [repositories],
  );

  const switchPlan = useCallback(
    async (plan: PlanTemplate) => {
      if (!group || plan.id === group.activePlanId) {
        setPlanSwitcherVisible(false);
        setPendingSwitchPlan(null);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        await repositories.groupRepository.updateGroup(group.id, {
          activePlanId: plan.id,
          currentPhaseType: await resolvePhaseTypeForPlan(plan.id),
          currentWeek: 1,
        });
        setSelectedChoiceKey('today');
        setPlanSwitcherVisible(false);
        setPendingSwitchPlan(null);
        await loadTodayPlan('today');
        setPlanSwitchNotice({
          title: '已切换计划',
          message: `当前训练计划已切换为\u201C${plan.name}\u201D，今日训练内容已刷新。历史记录不会受影响。`,
        });
      } catch (switchError) {
        setError(switchError instanceof Error ? switchError.message : '切换计划失败。');
      } finally {
        setIsLoading(false);
      }
    },
    [group, loadTodayPlan, repositories, resolvePhaseTypeForPlan],
  );

  const startWorkout = useCallback(async () => {
    if (!group) {
      return;
    }

    if (members.length === 0) {
      Alert.alert('还没有成员', '请先添加成员，再开始训练。');
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      if (selectedChoice.free || !todayPlan?.day || todayPlan.exercises.length === 0) {
        const firstExercise = freeExercises[0];
        const firstMember = members[0];
        if (!firstExercise || !firstMember) {
          throw new Error('还没有可用于自由训练的动作或成员。');
        }

        const session = await repositories.workoutRepository.createManualSession({
          completed: false,
          date: getLocalDateString(),
          exerciseId: firstExercise.id,
          groupId: group.id,
          memberId: firstMember.id,
          planId: group.activePlanId,
          reps: 8,
          rpe: 7,
          setCount: 3,
          title: selectedChoice.key === 'weak' ? '周五补弱' : '自由训练',
        });

        router.push({ pathname: '/workout/[sessionId]', params: { sessionId: session.id } });
        return;
      }

      const session = await repositories.workoutRepository.createSessionFromTodayPlan({
        date: getLocalDateString(),
        groupId: group.id,
        phaseId: todayPlan.phase.id,
        planExerciseIds: todayPlan.exercises.map((exercise) => exercise.id),
        planId: todayPlan.plan.id,
        title: todayPlan.day.title,
        week: todayPlan.day.week,
        weekday: todayPlan.day.weekday,
      });

      router.push({ pathname: '/workout/[sessionId]', params: { sessionId: session.id } });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '开始训练失败。');
    } finally {
      setIsStarting(false);
    }
  }, [freeExercises, group, members, repositories, selectedChoice, todayPlan]);

  const planExercises = todayPlan?.exercises ?? [];
  const freeExerciseRows = freeExercises.slice(0, 3);
  const firstPlanExercise = planExercises[0] ?? null;
  const firstExercise = firstPlanExercise ? exerciseMap[firstPlanExercise.exerciseId] ?? null : freeExerciseRows[0] ?? null;
  const canStartWorkout =
    members.length > 0 &&
    (selectedChoice.free || selectedChoice.key === 'weak' || Boolean(todayPlan && !todayPlan.isRestDay && planExercises.length > 0));
  const isDefaultFridayRest = todayWeekday === 5 && selectedChoice.key === 'today' && group?.fridayStrategy === 'default_rest';
  const activePlanWeeks = activePlan?.durationWeeks ?? todayPlan?.plan.durationWeeks ?? 16;
  const activePlanProgress = Math.min(100, Math.round(((group?.currentWeek ?? 1) / activePlanWeeks) * 100));
  const heroTheme = selectedChoice.free
    ? '自由训练'
    : isDefaultFridayRest
      ? '周五休息'
      : todayPlan?.day?.title ?? selectedChoice.label;

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/history')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="bar-chart-outline" size={22} />
        </Pressable>
      }
      subtitle={cycleLabel || undefined}
    >
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? <EmptyState title="训练暂时无法加载" description={error} /> : null}

      {!isLoading && !error && !group ? (
        <EmptyState
          actionLabel="开始设置"
          description="先创建小组并激活训练计划，才能看到今日训练安排。"
          onActionPress={() => router.push('/(tabs)/plan')}
          title="还没有训练计划"
        />
      ) : null}

      {!isLoading && !error && group ? (
        <>
          {/* ═══ Header ═══ */}
          <View style={styles.headerSection}>
            <View>
              <AppText variant="title" weight="900">{getGreetingByHour()}</AppText>
              <AppText tone="muted" variant="caption">
                {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
              </AppText>
            </View>
            <View style={styles.statusBar}>
              <Tag label={activePlan?.name ?? '无计划'} tone="dark" />
              <AppText variant="bodySmall" weight="900">{cycleLabel}</AppText>
            </View>
          </View>

          {/* ═══ Quick Actions Grid ═══ */}
          <View style={styles.quickActionsGrid}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/plan')}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.quickActionPressed]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.brandSoft }]}>
                <Ionicons color={colors.brand} name="clipboard-outline" size={20} />
              </View>
              <AppText variant="bodySmall" weight="800">今日训练</AppText>
              <AppText tone="muted" variant="caption">{activePlan?.name ?? '去查看'}</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/history')}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.quickActionPressed]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.accentSoft }]}>
                <Ionicons color={colors.accent} name="time-outline" size={20} />
              </View>
              <AppText variant="bodySmall" weight="800">训练记录</AppText>
              <AppText tone="muted" variant="caption">查看历史</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history/analytics' as never)}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.quickActionPressed]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.warningSoft }]}>
                <Ionicons color={colors.warning} name="trending-up-outline" size={20} />
              </View>
              <AppText variant="bodySmall" weight="800">训练分析</AppText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/members')}
              style={({ pressed }) => [styles.quickActionCard, pressed && styles.quickActionPressed]}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: colors.successSoft }]}>
                <Ionicons color={colors.success} name="people-outline" size={20} />
              </View>
              <AppText variant="bodySmall" weight="800">训练搭子</AppText>
              <AppText tone="muted" variant="caption">开发中</AppText>
            </Pressable>
          </View>

          {/* ═══ Today Workout Card ═══ */}
          <AppCard style={styles.todayWorkoutCard}>
            <SectionHeader subtitle="基于今日计划" title="今日训练" />

            {selectedChoice.free || (selectedChoice.key === 'weak' && planExercises.length === 0) ? (
              <>
                {freeExerciseRows.map((exercise, index) => (
                  <View key={exercise.id} style={styles.exerciseRow}>
                    <PriorityTag priority={index === 0 ? 'A' : index === 1 ? 'B' : 'C'} />
                    <View style={styles.exerciseInfo}>
                      <AppText variant="bodySmall" weight="900">{exercise.name}</AppText>
                      <AppText tone="muted" variant="caption">自由训练建议 · 现场设置重量</AppText>
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                {planExercises.slice(0, 3).map((planExercise) => {
                  const exercise = exerciseMap[planExercise.exerciseId] ?? null;
                  return (
                    <View key={planExercise.id} style={styles.exerciseRow}>
                      <PriorityTag priority={planExercise.priority} />
                      <View style={styles.exerciseInfo}>
                        <AppText variant="bodySmall" weight="900">{exercise?.name ?? planExercise.exerciseId}</AppText>
                        <AppText tone="muted" variant="caption">{formatPrescription(planExercise)} · {formatIntensity(planExercise)}</AppText>
                      </View>
                    </View>
                  );
                })}
                {planExercises.length > 3 && (
                  <AppText tone="muted" variant="caption">还有 {planExercises.length - 3} 个动作...</AppText>
                )}
              </>
            )}

            {members.length > 0 && (
              <>
                <View style={styles.divider} />
                <AppText variant="bodySmall" weight="900">成员建议重量</AppText>
                {members.slice(0, 2).map((member) => {
                  const suggestedWeight = formatSuggestedWeight(firstPlanExercise, firstExercise, profiles[member.id] ?? null);
                  return (
                    <View key={member.id} style={styles.weightRow}>
                      <View style={styles.avatarSmall}>
                        <AppText tone="inverse" variant="caption">{member.displayName.slice(0, 1)}</AppText>
                      </View>
                      <View style={styles.weightInfo}>
                        <AppText variant="bodySmall" weight="900">{member.displayName}</AppText>
                        <AppText tone="muted" variant="caption">{suggestedWeight.hint}</AppText>
                      </View>
                      <AppText variant="bodySmall" weight="900">{suggestedWeight.value}</AppText>
                    </View>
                  );
                })}
                {members.length > 2 && (
                  <AppText tone="muted" variant="caption">还有 {members.length - 2} 位成员...</AppText>
                )}
              </>
            )}

            <AppButton
              disabled={!canStartWorkout || isStarting}
              icon="play-outline"
              onPress={() => void startWorkout()}
              size="lg"
              style={styles.startButton}
            >
              {isStarting ? '正在开始...' : '开始训练'}
            </AppButton>
          </AppCard>

          {/* ═══ Plan Switcher ═══ */}
          <View style={styles.planSwitchRow}>
            <View style={styles.planSwitchInfo}>
              <AppText variant="bodySmall" weight="900">{activePlan?.name ?? '无计划'}</AppText>
              <AppText tone="muted" variant="caption">第 {group.currentWeek} / {activePlanWeeks} 周</AppText>
            </View>
            <View style={styles.progressFillWrap}>
              <View style={[styles.progressFill, { width: `${activePlanProgress}%` }]} />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPlanSwitcherVisible(true)}
              style={styles.planSwitchBtn}
            >
              <AppText variant="bodySmall" weight="900">切换</AppText>
            </Pressable>
          </View>

          {/* ═══ Empty State ═══ */}
          {!todayPlan && !selectedChoice.free && (
            <EmptyState
              actionLabel="创建计划"
              description="当前没有训练计划，去创建或导入一个计划开始训练。"
              onActionPress={() => router.push('/(tabs)/plan')}
              title="还没有训练计划"
            />
          )}
        </>
      ) : null}

      {/* ═══ Plan Switcher Modal ═══ */}
      <AppModalSheet
        onClose={() => setPlanSwitcherVisible(false)}
        subtitle={'这里只列出我的计划。系统方案需先在计划页点击\u201C使用此方案\u201D。'}
        title="选择当前计划"
        visible={Boolean(group && isPlanSwitcherVisible)}
      >
        {userPlans.length === 0 ? (
          <EmptyState
            actionLabel="去计划页"
            description="复制系统方案或导入计划后，训练页才可以切换执行计划。"
            onActionPress={() => {
              setPlanSwitcherVisible(false);
              router.push('/(tabs)/plan');
            }}
            title="还没有我的计划"
          />
        ) : (
          <View style={styles.planSwitchList}>
            {userPlans.map((plan) => {
              const isActive = plan.id === group?.activePlanId;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={isActive || isLoading}
                  key={plan.id}
                  onPress={() => setPendingSwitchPlan(plan)}
                  style={({ pressed }) => [styles.planSwitchItem, isActive && styles.planSwitchItemActive, pressed && styles.pressed]}
                >
                  <View style={styles.planSwitchIcon}>
                    <Ionicons color={isActive ? colors.surface : colors.primary} name="clipboard-outline" size={18} />
                  </View>
                  <View style={styles.exerciseText}>
                    <AppText tone={isActive ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                      {plan.name}
                    </AppText>
                    <AppText tone={isActive ? 'inverse' : 'muted'} variant="caption">
                      {formatPlanSource(plan.source)} · {plan.durationWeeks} 周 · 每周 {plan.frequencyPerWeek} 练
                    </AppText>
                  </View>
                  {isActive ? <Tag label="当前计划" tone="dark" /> : <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />}
                </Pressable>
              );
            })}
          </View>
        )}
      </AppModalSheet>

      {/* ═══ Switch Confirm Modal ═══ */}
      <AppModalSheet
        onClose={() => setPendingSwitchPlan(null)}
        subtitle="切换后训练页会按新计划生成今日训练，历史记录不会受影响。"
        title="切换当前计划？"
        visible={Boolean(pendingSwitchPlan)}
      >
        {pendingSwitchPlan ? (
          <AppCard style={styles.switchConfirmCard} tone="soft">
            <AppText variant="bodySmall" weight="900">
              {pendingSwitchPlan.name}
            </AppText>
            <AppText tone="muted" variant="caption">
              {formatPlanSource(pendingSwitchPlan.source)} · {pendingSwitchPlan.durationWeeks} 周 · 每周 {pendingSwitchPlan.frequencyPerWeek} 练
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.confirmActions}>
          <AppButton onPress={() => setPendingSwitchPlan(null)} variant="secondary">
            取消
          </AppButton>
          <AppButton disabled={isLoading} onPress={() => (pendingSwitchPlan ? void switchPlan(pendingSwitchPlan) : undefined)}>
            切换
          </AppButton>
        </View>
      </AppModalSheet>

      {/* ═══ Switch Notice Modal ═══ */}
      <AppModalSheet
        onClose={() => setPlanSwitchNotice(null)}
        position="center"
        subtitle={planSwitchNotice?.message}
        title={planSwitchNotice?.title ?? '已切换计划'}
        visible={Boolean(planSwitchNotice)}
      >
        <AppButton onPress={() => setPlanSwitchNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
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

  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  statusBar: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },

  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  quickActionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: '47%',
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  quickActionPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  quickActionIcon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },

  todayWorkoutCard: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  divider: {
    backgroundColor: colors.border,
    height: 1,
    marginVertical: spacing.xs,
  },
  startButton: {
    marginTop: spacing.sm,
  },

  exerciseRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exerciseInfo: {
    flex: 1,
    gap: 2,
  },
  weightRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatarSmall: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  weightInfo: {
    flex: 1,
    gap: 2,
  },

  planSwitchRow: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  planSwitchInfo: {
    gap: 2,
  },
  planSwitchBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  progressFillWrap: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 4,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.brand,
    borderRadius: radius.pill,
    height: '100%',
  },

  planSwitchList: {
    gap: spacing.sm,
  },
  planSwitchItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  planSwitchItemActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  planSwitchIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  switchConfirmCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  confirmActions: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
});
