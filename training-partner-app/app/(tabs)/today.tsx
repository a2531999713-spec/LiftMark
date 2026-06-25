import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { liftmarkImages } from '@/assets/images';
import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type {
  ExercisePriority,
  PhaseType,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  TodayPlanResult,
  Weekday,
} from '@/domain/plan/plan.types';
import type { RecoveryMode } from '@/domain/plan/plan.service';
import { calculateSuggestedWeight } from '@/domain/weight/weight-calculator';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, shadows, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

type SuggestedWeightDisplay = {
  hint: string;
  value: string;
};

type WeeklyOverview = {
  completedSets: number;
  durationSeconds: number;
  sessionCount: number;
  volume: number;
};

type FocusExercise = {
  exercise: Exercise | null;
  planExercise: PlanExercise;
};

type HeroAction = 'start' | 'plan';

type AdviceConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  mode: RecoveryMode;
  status: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
};

const emptyWeeklyOverview: WeeklyOverview = {
  completedSets: 0,
  durationSeconds: 0,
  sessionCount: 0,
  volume: 0,
};

const priorityRank: Record<ExercisePriority, number> = {
  A: 0,
  B: 1,
  C: 2,
};

const recoveryOptions: AdviceConfig[] = [
  {
    icon: 'shield-checkmark-outline',
    message: '按计划执行，今天可以正常训练。',
    mode: 'good',
    status: '状态良好',
    tone: 'success',
  },
  {
    icon: 'flash-outline',
    message: '优先完成 A/B 动作，C 动作可选。',
    mode: 'normal',
    status: '状态一般',
    tone: 'warning',
  },
  {
    icon: 'speedometer-outline',
    message: '建议降低强度，或只完成 A 动作。',
    mode: 'bad',
    status: '状态较差',
    tone: 'warning',
  },
  {
    icon: 'moon-outline',
    message: '今天可以休息，不需要强行补练。',
    mode: 'very_bad',
    status: '建议休息',
    tone: 'danger',
  },
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

function getWeekStart(date = new Date()): Date {
  const next = new Date(date);
  const day = next.getDay() === 0 ? 7 : next.getDay();
  next.setDate(next.getDate() - day + 1);
  next.setHours(12, 0, 0, 0);
  return next;
}

function getWeekEnd(date = new Date()): Date {
  const next = getWeekStart(date);
  next.setDate(next.getDate() + 6);
  return next;
}

function formatTodayDate(date = new Date()): string {
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  return `${date.getMonth() + 1}月${date.getDate()}日 ${weekdays[date.getDay()]}`;
}

function getGreetingByHour(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

function formatGreeting(member: GroupMember | null): string {
  const greeting = getGreetingByHour();
  return member ? `${greeting}，${member.displayName} 👋` : `${greeting} 👋`;
}

function formatPrescription(exercise: PlanExercise): string {
  if (exercise.sets && exercise.reps) {
    return `${exercise.sets} 组 × ${exercise.reps} 次`;
  }

  if (exercise.sets && exercise.repMin && exercise.repMax) {
    return `${exercise.sets} 组 × ${exercise.repMin}-${exercise.repMax} 次`;
  }

  if (exercise.sets) {
    return `${exercise.sets} 组`;
  }

  return '按现场状态安排';
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => `${part}`.padStart(2, '0')).join(':');
}

function getSessionDurationSeconds(detail: WorkoutSessionDetail): number {
  if (!detail.session.startedAt || !detail.session.finishedAt) {
    return 0;
  }

  const startedAt = new Date(detail.session.startedAt).getTime();
  const finishedAt = new Date(detail.session.finishedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt <= startedAt) {
    return 0;
  }

  return Math.round((finishedAt - startedAt) / 1000);
}

function summarizeWeeklyOverview(
  details: WorkoutSessionDetail[],
  memberId?: string,
): WeeklyOverview {
  if (!memberId) {
    return emptyWeeklyOverview;
  }

  const detailSummaries = details.map((detail) => {
    const completedSets = detail.sets.filter((set) => set.memberId === memberId && set.completed);
    return {
      completedSets: completedSets.length,
      durationSeconds: completedSets.length > 0 ? getSessionDurationSeconds(detail) : 0,
      volume: completedSets.reduce(
        (sum, set) =>
          sum +
          (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
        0,
      ),
    };
  });

  return {
    completedSets: detailSummaries.reduce((sum, item) => sum + item.completedSets, 0),
    durationSeconds: detailSummaries.reduce((sum, item) => sum + item.durationSeconds, 0),
    sessionCount: detailSummaries.filter((item) => item.completedSets > 0).length,
    volume: detailSummaries.reduce((sum, item) => sum + item.volume, 0),
  };
}

function formatPhaseLabel(phase: PlanPhase | null, phaseType?: PhaseType): string {
  if (phase?.name) {
    return phase.name;
  }

  const labels: Record<PhaseType, string> = {
    conditioning: '体能阶段',
    custom: '训练阶段',
    deload: '减量周',
    hypertrophy: '增肌阶段',
    strength: '增力阶段',
  };

  return labels[phaseType ?? 'custom'];
}

function getDaysUntilNextDeload(currentWeek: number, phases: PlanPhase[]): number | null {
  const nextDeload = phases
    .filter((phase) => phase.type === 'deload' && phase.startWeek > currentWeek)
    .sort((left, right) => left.startWeek - right.startWeek)[0];

  if (!nextDeload) {
    return null;
  }

  return Math.max(1, (nextDeload.startWeek - currentWeek) * 7);
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
    return { value: '参考上次重量', hint: '训练时可手动调整' };
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
        ? `按 ${Math.round(result.percent1RM * 100)}% 估算`
        : '按计划次数估算',
    };
  }

  if (result.status === 'missing_1rm') {
    return { value: '缺少 1RM', hint: '去成员资料补充参考主项' };
  }

  return { value: '参考上次重量', hint: '孤立或器械动作按历史调整' };
}

function getAdviceConfig(mode: RecoveryMode): AdviceConfig {
  return recoveryOptions.find((option) => option.mode === mode) ?? recoveryOptions[0];
}

function getFocusExercises(
  planExercises: PlanExercise[],
  exerciseMap: Record<string, Exercise>,
): FocusExercise[] {
  return planExercises
    .slice()
    .sort(
      (left, right) =>
        priorityRank[left.priority] - priorityRank[right.priority] ||
        left.orderIndex - right.orderIndex,
    )
    .slice(0, 3)
    .map((planExercise) => ({
      exercise: exerciseMap[planExercise.exerciseId] ?? null,
      planExercise,
    }));
}

export default function TodayRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const todayWeekday = useMemo(() => getTodayWeekday(), []);
  const { guardFeature, sheets } = useAuthGate();
  const authStatus = useAuthStore((state) => state.authStatus);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('good');
  const [todayPlan, setTodayPlan] = useState<TodayPlanResult | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [planPhases, setPlanPhases] = useState<PlanPhase[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [group, setGroup] = useState<Group | null>(null);
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyOverview>(emptyWeeklyOverview);
  const [isAdviceSheetVisible, setAdviceSheetVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const loadHome = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        setGroup(null);
        setActivePlan(null);
        setTodayPlan(null);
        setMembers([]);
        setProfiles({});
        setPlanPhases([]);
        setExerciseMap({});
        setWeeklyOverview(emptyWeeklyOverview);
        return;
      }

      const [nextActivePlan, nextMembers] = await Promise.all([
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
        repositories.memberRepository.listMembers(nextGroup.id),
      ]);
      const nextProfiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );
      const nextProfilesByMemberId = Object.fromEntries(nextProfiles);
      const currentMember = nextMembers[0] ?? null;
      const [weekSessions, nextPhases] = await Promise.all([
        repositories.workoutRepository.listSessions({
          fromDate: getLocalDateString(getWeekStart()),
          groupId: nextGroup.id,
          memberId: currentMember?.id,
          toDate: getLocalDateString(getWeekEnd()),
          limit: 80,
        }),
        nextActivePlan
          ? repositories.planRepository.listPlanPhases(nextActivePlan.id)
          : Promise.resolve([]),
      ]);
      const weekDetails = await Promise.all(
        weekSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)),
      );

      let result: TodayPlanResult | null = null;
      let nextExerciseMap: Record<string, Exercise> = {};

      if (nextActivePlan) {
        result = await repositories.planRepository.getTodayPlan({
          currentWeek: nextGroup.currentWeek,
          fridayEnabled: nextGroup.fridayEnabled,
          groupId: nextGroup.id,
          phaseType: nextGroup.currentPhaseType,
          planId: nextGroup.activePlanId,
          recoveryMode,
          weekday: todayWeekday,
        });

        const planExerciseIds = result.exercises.map((exercise) => exercise.exerciseId);
        const nextExercises =
          await repositories.exerciseRepository.listExercisesByIds(planExerciseIds);
        nextExerciseMap = Object.fromEntries(
          nextExercises.map((exercise) => [exercise.id, exercise]),
        );
      }

      setGroup(nextGroup);
      setActivePlan(nextActivePlan);
      setTodayPlan(result);
      setMembers(nextMembers);
      setProfiles(nextProfilesByMemberId);
      setPlanPhases(nextPhases);
      setExerciseMap(nextExerciseMap);
      setWeeklyOverview(summarizeWeeklyOverview(weekDetails, currentMember?.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练数据加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, recoveryMode, todayWeekday]);

  useFocusEffect(
    useCallback(() => {
      void loadHome();
    }, [loadHome]),
  );

  const startWorkout = useCallback(async () => {
    if (!guardFeature('start_workout')) {
      return;
    }

    if (!group) {
      setNotice({ title: '暂无训练计划', message: '创建或导入一个计划后，再开始今日训练。' });
      return;
    }

    if (members.length === 0) {
      setNotice({ title: '还没有训练成员', message: '添加成员后可计算建议重量并记录训练。' });
      return;
    }

    if (!todayPlan?.day || todayPlan.isRestDay || todayPlan.exercises.length === 0) {
      setNotice({
        title: '今日计划休息',
        message: '恢复也是计划的一部分。可以去计划页查看本周安排。',
      });
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
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
  }, [group, guardFeature, members.length, repositories, todayPlan]);

  const currentMember = members[0] ?? null;
  const currentProfile = currentMember ? (profiles[currentMember.id] ?? null) : null;
  const planExercises = useMemo(() => todayPlan?.exercises ?? [], [todayPlan]);
  const focusExercises = useMemo(
    () => getFocusExercises(planExercises, exerciseMap),
    [exerciseMap, planExercises],
  );
  const mainFocus = focusExercises[0]?.exercise?.name ?? todayPlan?.day?.focus ?? null;
  const firstPlanExercise = focusExercises[0]?.planExercise ?? null;
  const firstExercise = focusExercises[0]?.exercise ?? null;
  const suggestedWeight = formatSuggestedWeight(firstPlanExercise, firstExercise, currentProfile);
  const activePlanWeeks = activePlan?.durationWeeks ?? 0;
  const weeklyTarget = activePlan?.frequencyPerWeek ?? 0;
  const weeklyProgressPercent =
    weeklyTarget > 0
      ? Math.min(100, Math.round((weeklyOverview.sessionCount / weeklyTarget) * 100))
      : 0;
  const weeklyProgressLabel =
    weeklyTarget > 0
      ? `${Math.min(weeklyOverview.sessionCount, weeklyTarget)} / ${weeklyTarget}`
      : `${weeklyOverview.sessionCount} / -`;
  const nextDeloadDays = group ? getDaysUntilNextDeload(group.currentWeek, planPhases) : null;
  const phaseLabel = formatPhaseLabel(todayPlan?.phase ?? null, group?.currentPhaseType);
  const isRestState = Boolean(
    todayPlan?.isRestDay ||
    recoveryMode === 'very_bad' ||
    (todayPlan && planExercises.length === 0),
  );
  const canStartWorkout = Boolean(
    group &&
    activePlan &&
    members.length > 0 &&
    todayPlan?.day &&
    !todayPlan.isRestDay &&
    planExercises.length > 0,
  );
  const heroAction: HeroAction = canStartWorkout ? 'start' : 'plan';
  const heroTitle = isRestState ? '今日计划休息' : (todayPlan?.day?.title ?? '今日训练');
  const heroSubtitle = activePlan?.name ?? '创建或导入一个计划，开始你的训练之旅';
  const advice = getAdviceConfig(recoveryMode);

  return (
    <Screen contentStyle={styles.screenContent}>
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!isLoading ? (
        <>
          <HomeHeader
            currentMember={currentMember}
            onNotificationPress={() =>
              setNotice({ title: '功能开发中', message: '该功能正在开发中，后续版本开放。' })
            }
          />

          {authStatus === 'offline_authenticated' ? (
            <View style={styles.offlineBanner}>
              <Ionicons color={colors.textStrong} name="cloud-offline-outline" size={18} />
              <AppText variant="bodySmall" weight="800">
                当前离线，已进入本机模式
              </AppText>
            </View>
          ) : null}

          {error ? (
            <HomeEmptyState
              actionLabel="重新加载"
              description="请重试"
              icon="warning-outline"
              onActionPress={() => void loadHome()}
              title="训练数据加载失败"
            />
          ) : null}

          {!error && !activePlan ? (
            <HomeEmptyState
              actions={[
                {
                  label: '创建计划',
                  onPress: () => {
                    if (guardFeature('create_plan')) router.push('/plan/create' as never);
                  },
                },
                {
                  label: '导入计划',
                  onPress: () => {
                    if (guardFeature('import_plan')) router.push('/(tabs)/plan');
                  },
                },
              ]}
              description="创建或导入一个计划，开始你的训练之旅"
              icon="clipboard-outline"
              title="暂无训练计划"
            />
          ) : null}

          {!error && activePlan && members.length === 0 ? (
            <HomeEmptyState
              actionLabel="添加成员"
              description="添加成员后可计算建议重量并记录训练"
              icon="person-add-outline"
              onActionPress={() => {
                if (guardFeature('add_member', { memberCount: members.length })) {
                  router.push({ pathname: '/member/new', params: { returnTo: 'settings' } });
                }
              }}
              title="还没有训练成员"
            />
          ) : null}

          {!error && activePlan && members.length > 0 ? (
            <>
              <TodayTrainingHero
                actionLabel={heroAction === 'start' ? '开始今日训练' : '查看本周安排'}
                dayLabel={
                  todayPlan?.day
                    ? `第 ${group?.currentWeek ?? todayPlan.day.week} 周 · Day ${todayPlan.day.weekday}`
                    : `第 ${group?.currentWeek ?? 1} 周`
                }
                disabled={isStarting}
                isStarting={isStarting}
                onActionPress={
                  heroAction === 'start'
                    ? () => void startWorkout()
                    : () => router.push('/(tabs)/plan')
                }
                phaseLabel={phaseLabel}
                planName={heroSubtitle}
                progressLabel={weeklyProgressLabel}
                progressPercent={weeklyProgressPercent}
                title={heroTitle}
              />

              {isRestState ? (
                <HomeEmptyState
                  actionLabel="查看本周安排"
                  compact
                  description={todayPlan?.reason ?? '恢复也是计划的一部分'}
                  icon="moon-outline"
                  onActionPress={() => router.push('/(tabs)/plan')}
                  title="今日计划休息"
                />
              ) : null}

              <View style={styles.metricRow}>
                <SmallMetricCard
                  label={nextDeloadDays ? '距离下次减载' : '当前周数'}
                  value={
                    nextDeloadDays
                      ? `${nextDeloadDays} 天`
                      : `第 ${group?.currentWeek ?? 1} / ${activePlanWeeks || '-'} 周`
                  }
                />
                <SmallMetricCard
                  helper={suggestedWeight.hint}
                  label="今日主项"
                  value={mainFocus ?? '暂无动作'}
                />
              </View>

              <TodayFocusList
                items={focusExercises}
                onOpenAll={() => router.push('/(tabs)/plan')}
              />

              <PartnerStrip
                currentMemberId={currentMember?.id}
                members={members}
                onInvite={() => {
                  if (guardFeature('online_training')) {
                    setNotice({
                      title: '邀请后续开放',
                      message: '当前版本为本机小组，云同步邀请后续开放。',
                    });
                  }
                }}
                onMemberPress={(member) =>
                  router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } })
                }
                onOpenAll={() => router.push('/settings/members' as never)}
              />

              <WeeklyOverviewGrid overview={weeklyOverview} />

              <TrainingAdviceCard advice={advice} onPress={() => setAdviceSheetVisible(true)} />
            </>
          ) : null}
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setAdviceSheetVisible(false)}
        subtitle="这里只影响今日重点动作展示，训练中仍可根据现场状态调整。"
        title="选择今日状态"
        visible={isAdviceSheetVisible}
      >
        <View style={styles.recoveryList}>
          {recoveryOptions.map((option) => (
            <Pressable
              accessibilityRole="button"
              key={option.mode}
              onPress={() => {
                setRecoveryMode(option.mode);
                setAdviceSheetVisible(false);
              }}
              style={({ pressed }) => [
                styles.recoveryItem,
                recoveryMode === option.mode && styles.recoveryItemActive,
                pressed && styles.pressed,
              ]}
            >
              <AdviceIcon tone={option.tone} icon={option.icon} />
              <View style={styles.recoveryText}>
                <AppText variant="bodySmall" weight="900">
                  {option.status}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {option.message}
                </AppText>
              </View>
              {recoveryMode === option.mode ? <Tag label="当前" tone="brand" /> : null}
            </Pressable>
          ))}
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function HomeHeader({
  currentMember,
  onNotificationPress,
}: {
  currentMember: GroupMember | null;
  onNotificationPress: () => void;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText style={styles.headerTitle} variant="title" weight="900">
          {formatGreeting(currentMember)}
        </AppText>
        <AppText tone="muted" variant="bodySmall">
          {formatTodayDate()}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onNotificationPress}
        style={styles.notificationButton}
      >
        <Ionicons color={colors.textStrong} name="notifications-outline" size={24} />
        <View style={styles.notificationDot} />
      </Pressable>
    </View>
  );
}

function TodayTrainingHero({
  actionLabel,
  dayLabel,
  disabled,
  isStarting,
  onActionPress,
  phaseLabel,
  planName,
  progressLabel,
  progressPercent,
  title,
}: {
  actionLabel: string;
  dayLabel: string;
  disabled: boolean;
  isStarting: boolean;
  onActionPress: () => void;
  phaseLabel: string;
  planName: string;
  progressLabel: string;
  progressPercent: number;
  title: string;
}) {
  return (
    <View style={styles.heroCard}>
      <ImageBackground
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={liftmarkImages.trainingHero}
        style={styles.heroImageBackground}
      >
        <View style={styles.heroScrim} />
        <View style={styles.heroTextScrim} />
        <View style={styles.heroContent}>
          <View style={styles.phaseBadge}>
            <Ionicons color={colors.surface} name="flash" size={13} />
            <AppText tone="inverse" variant="caption" weight="900">
              {phaseLabel}
            </AppText>
          </View>

          <AppText style={styles.heroDay} variant="bodySmall" weight="700">
            {dayLabel}
          </AppText>
          <AppText style={styles.heroTitle} variant="display" weight="900">
            {title}
          </AppText>
          <AppText numberOfLines={2} style={styles.heroPlan} variant="body" weight="700">
            {planName}
          </AppText>

          <View style={styles.heroProgressHeader}>
            <AppText style={styles.heroProgressText} variant="bodySmall" weight="800">
              本周进度
            </AppText>
            <AppText style={styles.heroProgressText} variant="bodySmall" weight="900">
              {progressLabel}
            </AppText>
          </View>
          <View style={styles.heroProgressTrack}>
            <View style={[styles.heroProgressFill, { width: `${progressPercent}%` }]} />
          </View>
        </View>
      </ImageBackground>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={onActionPress}
        style={({ pressed }) => [
          styles.heroButton,
          disabled && styles.heroButtonDisabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <AppText style={styles.heroButtonText} variant="subtitle" weight="900">
          {isStarting ? '正在开始...' : actionLabel}
        </AppText>
        <Ionicons
          color={colors.surface}
          name={actionLabel.includes('开始') ? 'play' : 'calendar-outline'}
          size={22}
        />
      </Pressable>
    </View>
  );
}

function SmallMetricCard({
  helper,
  label,
  value,
}: {
  helper?: string;
  label: string;
  value: string;
}) {
  return (
    <AppCard style={styles.metricCard}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="title" weight="900">
        {value}
      </AppText>
      {helper ? (
        <AppText numberOfLines={1} tone="subtle" variant="caption">
          {helper}
        </AppText>
      ) : null}
    </AppCard>
  );
}

function TodayFocusList({ items, onOpenAll }: { items: FocusExercise[]; onOpenAll: () => void }) {
  return (
    <AppCard style={styles.focusCard}>
      <SectionTop actionLabel="查看全部" onActionPress={onOpenAll} title="今日重点" />
      {items.length === 0 ? (
        <AppText tone="muted" variant="bodySmall">
          今日没有需要执行的重点动作。
        </AppText>
      ) : (
        <View style={styles.focusRows}>
          {items.map(({ exercise, planExercise }) => (
            <Pressable
              accessibilityRole="button"
              key={planExercise.id}
              onPress={onOpenAll}
              style={({ pressed }) => [styles.focusRow, pressed && styles.focusRowPressed]}
            >
              <PriorityBadge priority={planExercise.priority} />
              <View style={styles.focusText}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">
                  {exercise?.name ?? '未知动作'}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {formatPrescription(planExercise)}
                </AppText>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          ))}
        </View>
      )}
      <View style={styles.priorityLegend}>
        <LegendItem priority="A" text="为高优先级" />
        <LegendItem priority="B" text="为中优先级" />
        <LegendItem priority="C" text="为可选" />
      </View>
    </AppCard>
  );
}

function PriorityBadge({ priority }: { priority: ExercisePriority }) {
  const badgeStyle =
    priority === 'A' ? styles.priorityA : priority === 'B' ? styles.priorityB : styles.priorityC;
  const textStyle =
    priority === 'A'
      ? styles.priorityTextA
      : priority === 'B'
        ? styles.priorityTextB
        : styles.priorityTextC;

  return (
    <View style={[styles.priorityBadge, badgeStyle]}>
      <AppText style={textStyle} variant="subtitle" weight="900">
        {priority}
      </AppText>
    </View>
  );
}

function LegendItem({ priority, text }: { priority: ExercisePriority; text: string }) {
  const textStyle =
    priority === 'A'
      ? styles.priorityTextA
      : priority === 'B'
        ? styles.priorityTextB
        : styles.priorityTextC;

  return (
    <View style={styles.legendItem}>
      <AppText style={textStyle} variant="bodySmall" weight="900">
        {priority}
      </AppText>
      <AppText tone="muted" variant="caption">
        {text}
      </AppText>
    </View>
  );
}

function PartnerStrip({
  currentMemberId,
  members,
  onInvite,
  onMemberPress,
  onOpenAll,
}: {
  currentMemberId?: string;
  members: GroupMember[];
  onInvite: () => void;
  onMemberPress: (member: GroupMember) => void;
  onOpenAll: () => void;
}) {
  const visibleMembers = members.slice(0, 4);
  const overflowCount = Math.max(0, members.length - visibleMembers.length);

  return (
    <View style={styles.partnerSection}>
      <SectionTop
        actionLabel="查看全部"
        onActionPress={onOpenAll}
        title={`当前搭子（${members.length}）`}
      />
      <View style={styles.partnerRow}>
        {visibleMembers.map((member) => {
          const active = member.id === currentMemberId;
          return (
            <Pressable
              accessibilityRole="button"
              key={member.id}
              onPress={() => onMemberPress(member)}
              style={({ pressed }) => [styles.partnerItem, pressed && styles.pressed]}
            >
              <View style={[styles.avatar, active && styles.avatarActive]}>
                {member.avatarUrl ? (
                  <Image source={{ uri: member.avatarUrl }} style={styles.avatarImage} />
                ) : (
                  <AppText tone="inverse" variant="bodySmall" weight="900">
                    {member.displayName.slice(0, 1)}
                  </AppText>
                )}
              </View>
              <AppText
                numberOfLines={1}
                style={active && styles.currentMemberName}
                variant="caption"
                weight="900"
              >
                {active ? '当前' : member.displayName}
              </AppText>
            </Pressable>
          );
        })}

        {overflowCount > 0 ? (
          <Pressable accessibilityRole="button" onPress={onOpenAll} style={styles.partnerItem}>
            <View style={styles.avatarOverflow}>
              <AppText variant="bodySmall" weight="900">
                +{overflowCount}
              </AppText>
            </View>
            <AppText tone="muted" variant="caption">
              更多
            </AppText>
          </Pressable>
        ) : null}

        <Pressable accessibilityRole="button" onPress={onInvite} style={styles.partnerItem}>
          <View style={styles.inviteAvatar}>
            <Ionicons color={colors.textStrong} name="add" size={26} />
          </View>
          <AppText tone="muted" variant="caption" weight="900">
            邀请
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

function WeeklyOverviewGrid({ overview }: { overview: WeeklyOverview }) {
  return (
    <View style={styles.weeklySection}>
      <AppText variant="subtitle" weight="900">
        本周概览
      </AppText>
      <View style={styles.weekGrid}>
        <WeeklyTile label="我的本周训练次数" value={`${overview.sessionCount} 次`} />
        <WeeklyTile label="我的完成组数" value={`${overview.completedSets} 组`} />
        <WeeklyTile label="我的训练总量" value={formatKg(overview.volume)} />
        <WeeklyTile label="我的训练时长" value={formatDuration(overview.durationSeconds)} />
      </View>
    </View>
  );
}

function WeeklyTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.weekTile}>
      <AppText numberOfLines={1} tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="title" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function TrainingAdviceCard({ advice, onPress }: { advice: AdviceConfig; onPress: () => void }) {
  return (
    <View style={styles.adviceSection}>
      <AppText variant="subtitle" weight="900">
        训练建议
      </AppText>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({ pressed }) => [styles.adviceCard, pressed && styles.pressed]}
      >
        <AdviceIcon icon={advice.icon} tone={advice.tone} />
        <View style={styles.adviceText}>
          <AppText
            style={
              advice.tone === 'danger'
                ? styles.adviceDanger
                : advice.tone === 'warning'
                  ? styles.adviceWarning
                  : styles.adviceSuccess
            }
            variant="subtitle"
            weight="900"
          >
            {advice.status}
          </AppText>
          <AppText tone="muted" variant="bodySmall">
            {advice.message}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
      </Pressable>
    </View>
  );
}

function AdviceIcon({
  icon,
  tone,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tone: AdviceConfig['tone'];
}) {
  const color =
    tone === 'danger'
      ? colors.danger
      : tone === 'warning'
        ? colors.warning
        : tone === 'success'
          ? colors.success
          : colors.textMuted;
  const background =
    tone === 'danger'
      ? colors.dangerSoft
      : tone === 'warning'
        ? colors.warningSoft
        : tone === 'success'
          ? colors.successSoft
          : colors.surfaceMuted;

  return (
    <View style={[styles.adviceIcon, { backgroundColor: background }]}>
      <Ionicons color={color} name={icon} size={30} />
    </View>
  );
}

function HomeEmptyState({
  actionLabel,
  actions,
  compact = false,
  description,
  icon,
  onActionPress,
  title,
}: {
  actionLabel?: string;
  actions?: { label: string; onPress: () => void }[];
  compact?: boolean;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  onActionPress?: () => void;
  title: string;
}) {
  return (
    <AppCard style={[styles.emptyCard, compact && styles.emptyCardCompact]}>
      <View style={styles.emptyIcon}>
        <Ionicons color={colors.primary} name={icon} size={24} />
      </View>
      <View style={styles.emptyText}>
        <AppText variant="subtitle" weight="900">
          {title}
        </AppText>
        <AppText tone="muted" variant="bodySmall">
          {description}
        </AppText>
      </View>
      {actions ? (
        <View style={styles.emptyActions}>
          {actions.map((action, index) => (
            <AppButton
              key={action.label}
              onPress={action.onPress}
              style={styles.emptyActionButton}
              variant={index === 0 ? 'primary' : 'secondary'}
            >
              {action.label}
            </AppButton>
          ))}
        </View>
      ) : null}
      {actionLabel ? (
        <AppButton onPress={onActionPress} style={styles.emptySingleButton} variant="secondary">
          {actionLabel}
        </AppButton>
      ) : null}
    </AppCard>
  );
}

function SectionTop({
  actionLabel,
  onActionPress,
  title,
}: {
  actionLabel: string;
  onActionPress: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionTop}>
      <AppText variant="subtitle" weight="900">
        {title}
      </AppText>
      <Pressable accessibilityRole="button" onPress={onActionPress} style={styles.sectionAction}>
        <AppText tone="muted" variant="caption" weight="800">
          {actionLabel}
        </AppText>
        <Ionicons color={colors.textMuted} name="chevron-forward" size={14} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  adviceCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 76,
    padding: spacing.md,
    ...shadows.card,
  },
  adviceDanger: {
    color: colors.danger,
  },
  adviceIcon: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  adviceSection: {
    gap: spacing.md,
  },
  adviceSuccess: {
    color: colors.success,
  },
  adviceText: {
    flex: 1,
    gap: 2,
  },
  adviceWarning: {
    color: colors.warning,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 58,
  },
  avatarActive: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  avatarImage: {
    height: '100%',
    width: '100%',
  },
  avatarOverflow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  currentMemberName: {
    color: colors.primary,
  },
  emptyActionButton: {
    flex: 1,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  emptyCardCompact: {
    padding: spacing.lg,
  },
  emptyIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  emptySingleButton: {
    width: '100%',
  },
  emptyText: {
    gap: spacing.xs,
  },
  focusCard: {
    gap: spacing.md,
  },
  focusRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  focusRowPressed: {
    opacity: 0.82,
  },
  focusRows: {
    gap: spacing.xs,
  },
  focusText: {
    flex: 1,
    gap: 2,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    color: colors.textStrong,
  },
  heroButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    minHeight: 58,
    paddingHorizontal: spacing.xl,
  },
  heroButtonDisabled: {
    opacity: 0.65,
  },
  heroButtonText: {
    color: colors.surface,
  },
  heroCard: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroContent: {
    gap: spacing.sm,
    minHeight: 270,
    padding: spacing.xl,
    paddingTop: spacing.xl,
  },
  heroDay: {
    color: 'rgba(255,255,255,0.86)',
    marginTop: spacing.sm,
  },
  heroImage: {
    opacity: 0.94,
  },
  heroImageBackground: {
    minHeight: 270,
  },
  heroPlan: {
    color: 'rgba(255,255,255,0.9)',
    maxWidth: '82%',
  },
  heroProgressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  heroProgressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  heroProgressText: {
    color: colors.surface,
  },
  heroProgressTrack: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.pill,
    height: 8,
    maxWidth: 220,
    overflow: 'hidden',
    width: '58%',
  },
  heroScrim: {
    backgroundColor: 'rgba(1,12,22,0.45)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroTextScrim: {
    backgroundColor: 'rgba(1,12,22,0.58)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
    width: '74%',
  },
  heroTitle: {
    color: colors.surface,
  },
  inviteAvatar: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderStyle: 'dashed',
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  offlineBanner: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
    ...shadows.card,
  },
  metricCard: {
    flex: 1,
    gap: spacing.xs,
    minHeight: 98,
    padding: spacing.lg,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  notificationButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  notificationDot: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: 9,
    top: 9,
    width: 12,
  },
  partnerItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 58,
  },
  partnerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  partnerSection: {
    gap: spacing.md,
  },
  phaseBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.86,
    transform: [{ scale: 0.99 }],
  },
  priorityA: {
    backgroundColor: colors.primarySoft,
  },
  priorityB: {
    backgroundColor: colors.warningSoft,
  },
  priorityBadge: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  priorityC: {
    backgroundColor: colors.accentSoft,
  },
  priorityLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  priorityTextA: {
    color: colors.primary,
  },
  priorityTextB: {
    color: colors.warning,
  },
  priorityTextC: {
    color: colors.accent,
  },
  recoveryItem: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 74,
    padding: spacing.md,
  },
  recoveryItemActive: {
    borderColor: colors.primary,
  },
  recoveryList: {
    gap: spacing.sm,
  },
  recoveryText: {
    flex: 1,
    gap: 2,
  },
  screenContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  sectionAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  sectionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  weekGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  weekTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 90,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  weeklySection: {
    gap: spacing.md,
  },
});
