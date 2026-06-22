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
          {/* ═══ Greeting ═══ */}
          <View style={styles.greeting}>
            <View>
              <AppText variant="title" weight="900">{getGreetingByHour()}</AppText>
              <AppText tone="muted" variant="caption">
                {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/history')}
              style={styles.greetingAction}
            >
              <Ionicons color={colors.textMuted} name="bar-chart-outline" size={22} />
            </Pressable>
          </View>

          {/* ═══ Hero Card ═══ */}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/plan')}
            style={({ pressed }) => [styles.hero, pressed && styles.heroPressed]}
          >
            <View style={styles.heroAccent} />
            <View style={styles.heroContent}>
              <View style={styles.heroHeader}>
                <View style={styles.heroBadge}>
                  <Ionicons color={colors.primary} name="flame" size={12} />
                  <AppText variant="caption" weight="900" style={styles.heroBadgeText}>
                    {selectedChoice.free ? '自由训练' : heroTheme}
                  </AppText>
                </View>
                <AppText variant="caption" style={styles.heroWeek}>{cycleLabel}</AppText>
              </View>

              <AppText variant="headline" weight="900" style={styles.heroTitle}>
                今日训练
              </AppText>
              <AppText variant="bodySmall" style={styles.heroSubtitle}>
                {activePlan?.name ?? '开始你的训练'}
              </AppText>

              <View style={styles.heroStats}>
                <View style={styles.heroStat}>
                  <AppText variant="subtitle" weight="900" style={styles.heroStatValue}>
                    {planExercises.length}
                  </AppText>
                  <AppText variant="caption" style={styles.heroStatLabel}>动作</AppText>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <AppText variant="subtitle" weight="900" style={styles.heroStatValue}>
                    {members.length}
                  </AppText>
                  <AppText variant="caption" style={styles.heroStatLabel}>成员</AppText>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStat}>
                  <Ionicons color={colors.primary} name="chevron-forward" size={18} />
                </View>
              </View>
            </View>
          </Pressable>

          {/* ═══ Quick Nav ═══ */}
          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/(tabs)/history')}
              style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}
            >
              <Ionicons color={colors.accent} name="time-outline" size={18} />
              <AppText variant="caption" weight="800">记录</AppText>
            </Pressable>

            <View style={styles.navDivider} />

            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/history/analytics' as never)}
              style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}
            >
              <Ionicons color={colors.warning} name="trending-up-outline" size={18} />
              <AppText variant="caption" weight="800">分析</AppText>
            </Pressable>

            <View style={styles.navDivider} />

            <Pressable
              accessibilityRole="button"
              onPress={() => setPlanSwitcherVisible(true)}
              style={({ pressed }) => [styles.navItem, pressed && styles.navPressed]}
            >
              <Ionicons color={colors.success} name="swap-horizontal-outline" size={18} />
              <AppText variant="caption" weight="800">切换</AppText>
            </Pressable>
          </View>

          {/* ═══ Exercise Chips ═══ */}
          {(planExercises.length > 0 || selectedChoice.free) && (
            <View style={styles.exercises}>
              <View style={styles.exercisesHeader}>
                <AppText variant="subtitle" weight="900">训练内容</AppText>
                <AppText tone="muted" variant="caption">
                  {selectedChoice.free ? '自由训练' : `${planExercises.length} 个动作`}
                </AppText>
              </View>
              <View style={styles.chipRow}>
                {(selectedChoice.free ? freeExerciseRows : planExercises.slice(0, 6)).map((item, index) => {
                  const name = selectedChoice.free
                    ? (item as typeof freeExerciseRows[0]).name
                    : exerciseMap[(item as typeof planExercises[0]).exerciseId]?.name ?? '动作';
                  return (
                    <View key={selectedChoice.free ? (item as typeof freeExerciseRows[0]).id : (item as typeof planExercises[0]).id} style={styles.chip}>
                      <View style={styles.chipDot}>
                        <AppText variant="caption" weight="900" style={styles.chipDotText}>{index + 1}</AppText>
                      </View>
                      <AppText numberOfLines={1} variant="bodySmall" weight="800">{name}</AppText>
                    </View>
                  );
                })}
              </View>
              {planExercises.length > 6 && (
                <AppText tone="muted" variant="caption" style={styles.chipMore}>
                  +{planExercises.length - 6} 更多
                </AppText>
              )}
            </View>
          )}

          {/* ═══ CTA ═══ */}
          <Pressable
            accessibilityRole="button"
            disabled={!canStartWorkout || isStarting}
            onPress={() => void startWorkout()}
            style={({ pressed }) => [
              styles.cta,
              pressed && styles.ctaPressed,
              (!canStartWorkout || isStarting) && styles.ctaDisabled,
            ]}
          >
            <Ionicons color={colors.surface} name="play" size={20} />
            <AppText variant="bodySmall" weight="900" style={styles.ctaText}>
              {isStarting ? '正在开始...' : '开始训练'}
            </AppText>
          </Pressable>

          {/* ═══ Progress ═══ */}
          <View style={styles.progress}>
            <View style={styles.progressTop}>
              <AppText variant="caption" weight="800">训练进度</AppText>
              <AppText variant="caption" weight="900" style={styles.progressValue}>{activePlanProgress}%</AppText>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${activePlanProgress}%` }]} />
            </View>
            <View style={styles.progressBottom}>
              <AppText tone="muted" variant="caption">第 {group.currentWeek} / {activePlanWeeks} 周</AppText>
              <Pressable accessibilityRole="button" onPress={() => setPlanSwitcherVisible(true)}>
                <AppText variant="caption" weight="800" style={styles.progressLink}>切换计划</AppText>
              </Pressable>
            </View>
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  greeting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  greetingAction: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },

  hero: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    marginBottom: spacing.xxl,
    overflow: 'hidden',
  },
  heroPressed: {
    opacity: 0.95,
  },
  heroAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary,
    opacity: 0.15,
    transform: [{ translateX: 30 }, { translateY: -30 }],
  },
  heroContent: {
    padding: spacing.xl,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  heroBadgeText: {
    color: colors.primary,
  },
  heroWeek: {
    color: 'rgba(255,255,255,0.5)',
  },
  heroTitle: {
    color: colors.surface,
    marginBottom: spacing.xs,
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    marginBottom: spacing.xl,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroStatValue: {
    color: colors.surface,
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.5)',
  },
  heroStatDivider: {
    width: 1,
    height: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },

  navRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.xxl,
    ...shadows.card,
  },
  navItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  navPressed: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
  },
  navDivider: {
    width: 1,
    height: '60%',
    backgroundColor: colors.border,
    alignSelf: 'center',
  },

  exercises: {
    marginBottom: spacing.xxl,
  },
  exercisesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  chipDot: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
  },
  chipDotText: {
    color: colors.primary,
    fontSize: 10,
  },
  chipMore: {
    marginTop: spacing.sm,
  },

  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    marginBottom: spacing.xxl,
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaText: {
    color: colors.surface,
  },

  progress: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xxl,
    ...shadows.card,
  },
  progressTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressValue: {
    color: colors.primary,
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 4,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  progressBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLink: {
    color: colors.primary,
  },

  planSwitchList: {
    gap: spacing.sm,
  },
  planSwitchItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
    ...shadows.card,
  },
  planSwitchItemActive: {
    backgroundColor: colors.dark,
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
