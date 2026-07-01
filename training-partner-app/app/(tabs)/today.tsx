import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { liftmarkImages } from '@/assets/images';
import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppModalSheet, AppText, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type {
  ExercisePriority,
  PhaseType,
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  TodayPlanResult,
  Weekday,
} from '@/domain/plan/plan.types';
import type { RecoveryMode } from '@/domain/plan/plan.service';
import { calculateSuggestedWeight } from '@/domain/weight/weight-calculator';
import type {
  CreateSessionFromTodayPlanInput,
  WorkoutSession,
  WorkoutSessionDetail,
} from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
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

type WorkoutRecordScope = 'solo_local' | 'group_local';

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
    message: '本次训练会创建 A/B/C 全部计划动作。',
    mode: 'good',
    status: '完整动作',
    tone: 'success',
  },
  {
    icon: 'flash-outline',
    message: '本次训练只创建 A/B 动作，隐藏 C 类补充动作。',
    mode: 'normal',
    status: '精简辅助',
    tone: 'warning',
  },
  {
    icon: 'speedometer-outline',
    message: '本次训练只创建 A 类主项动作。',
    mode: 'bad',
    status: '只做主项',
    tone: 'warning',
  },
  {
    icon: 'moon-outline',
    message: '不创建训练 session，保留为休息日。',
    mode: 'very_bad',
    status: '今日休息',
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

function getPlanWeekOptions(days: PlanDay[], fallbackWeek: number): number[] {
  const weeks = [...new Set(days.map((day) => day.week))].sort((left, right) => left - right);
  return weeks.length > 0 ? weeks : [fallbackWeek];
}

function getDaysForWeek(days: PlanDay[], week: number): PlanDay[] {
  return days
    .filter((day) => day.week === week)
    .slice()
    .sort((left, right) => left.weekday - right.weekday);
}

function getPlanDayKey(planId: string, week: number, weekday: Weekday): string {
  return `${planId}:${week}:${weekday}`;
}

function getCompletedPlanDayKeys(details: WorkoutSessionDetail[], planId: string): Set<string> {
  return new Set(
    details
      .filter((detail) => detail.session.planId === planId && detail.session.status === 'completed')
      .map((detail) => getPlanDayKey(planId, detail.session.week, detail.session.weekday)),
  );
}

function resolveAutoFollowPlanDay({
  completedKeys,
  currentWeek,
  days,
  planId,
  todayWeekday,
}: {
  completedKeys: Set<string>;
  currentWeek: number;
  days: PlanDay[];
  planId: string;
  todayWeekday: Weekday;
}): PlanDay | null {
  const orderedDays = days
    .slice()
    .sort((left, right) => left.week - right.week || left.weekday - right.weekday);
  const activeIndex = orderedDays.findIndex(
    (day) => day.week > currentWeek || (day.week === currentWeek && day.weekday >= todayWeekday),
  );
  const searchDays = activeIndex >= 0
    ? [...orderedDays.slice(activeIndex), ...orderedDays.slice(0, activeIndex)]
    : orderedDays;

  return (
    searchDays.find((day) => !completedKeys.has(getPlanDayKey(planId, day.week, day.weekday))) ??
    searchDays[0] ??
    null
  );
}

function formatDayChoiceTitle(day: PlanDay): string {
  if (day.weekday === 5 || /补|弱/.test(`${day.title}${day.focus}`)) {
    return '补弱';
  }
  if (day.weekday >= 1 && day.weekday <= 4) {
    return `Day ${day.weekday}`;
  }
  const labels: Record<Weekday, string> = {
    1: '周一',
    2: '周二',
    3: '周三',
    4: '周四',
    5: '周五',
    6: '周六',
    7: '周日',
  };
  return labels[day.weekday];
}

function formatDayChoiceSubtitle(day: PlanDay): string {
  return [day.title, day.focus].filter(Boolean).join(' · ');
}

function isSameWorkoutSelection(
  session: WorkoutSession,
  input: CreateSessionFromTodayPlanInput,
): boolean {
  return (
    session.planId === input.planId &&
    session.week === input.week &&
    session.weekday === input.weekday &&
    session.trainingMode === (input.trainingMode ?? 'group_local')
  );
}

function formatSessionSelection(session: WorkoutSession): string {
  const weekdayLabels: Record<Weekday, string> = {
    1: '周一',
    2: '周二',
    3: '周三',
    4: '周四',
    5: '周五',
    6: '周六',
    7: '周日',
  };
  const scopeLabel = session.trainingMode === 'solo_local' ? '仅我记录' : '小组成员';
  return `第 ${session.week} 周 · ${weekdayLabels[session.weekday]} · ${scopeLabel}`;
}

function formatWorkoutStartSelection(
  input: CreateSessionFromTodayPlanInput,
  day: PlanDay | null,
): string {
  const weekdayLabels: Record<Weekday, string> = {
    1: '周一',
    2: '周二',
    3: '周三',
    4: '周四',
    5: '周五',
    6: '周六',
    7: '周日',
  };
  const dayLabel = day && day.week === input.week ? formatDayChoiceTitle(day) : weekdayLabels[input.weekday];
  const scopeLabel = input.trainingMode === 'solo_local' ? '仅我记录' : '小组成员';
  return `第 ${input.week} 周 · ${dayLabel} · ${scopeLabel}`;
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
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('good');
  const [todayPlan, setTodayPlan] = useState<TodayPlanResult | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [planPhases, setPlanPhases] = useState<PlanPhase[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [group, setGroup] = useState<Group | null>(null);
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyOverview>(emptyWeeklyOverview);
  const [isAdviceSheetVisible, setAdviceSheetVisible] = useState(false);
  const [isDaySheetVisible, setDaySheetVisible] = useState(false);
  const [isScopeSheetVisible, setScopeSheetVisible] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const [selectedWeekday, setSelectedWeekday] = useState<Weekday | null>(null);
  const [isPlanSelectionManual, setPlanSelectionManual] = useState(false);
  const [recordScope, setRecordScope] = useState<WorkoutRecordScope>('group_local');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>([]);
  const [conflictingSession, setConflictingSession] = useState<WorkoutSession | null>(null);
  const [pendingWorkoutStart, setPendingWorkoutStart] =
    useState<CreateSessionFromTodayPlanInput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

  const loadHome = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const allGroups = await repositories.groupRepository.listGroups();
      const nextGroup = allGroups.find((item) => item.id === selectedGroupId) ?? allGroups[0] ?? null;
      if (!nextGroup) {
        setGroup(null);
        setActivePlan(null);
        setTodayPlan(null);
        setMembers([]);
        setProfiles({});
        setPlanPhases([]);
        setPlanDays([]);
        setSelectedWeek(null);
        setSelectedWeekday(null);
        setExerciseMap({});
        setWeeklyOverview(emptyWeeklyOverview);
        return;
      }
      if (nextGroup.id !== selectedGroupId) {
        setSelectedGroupId(nextGroup.id);
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
      const [weekSessions, nextPhases, nextPlanDays] = await Promise.all([
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
        nextActivePlan
          ? repositories.planRepository.listPlanDays(nextActivePlan.id)
          : Promise.resolve([]),
      ]);
      const weekDetails = await Promise.all(
        weekSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)),
      );

      let result: TodayPlanResult | null = null;
      let nextExerciseMap: Record<string, Exercise> = {};
      let nextSelectedWeek: number | null = null;
      let nextSelectedWeekday: Weekday | null = null;

      if (nextActivePlan) {
        const weekOptions = getPlanWeekOptions(nextPlanDays, nextGroup.currentWeek);
        const completedPlanDayKeys = getCompletedPlanDayKeys(weekDetails, nextActivePlan.id);
        const autoFollowDay = resolveAutoFollowPlanDay({
          completedKeys: completedPlanDayKeys,
          currentWeek: nextGroup.currentWeek,
          days: nextPlanDays,
          planId: nextActivePlan.id,
          todayWeekday,
        });
        const autoWeek = autoFollowDay?.week ??
          (weekOptions.includes(nextGroup.currentWeek) ? nextGroup.currentWeek : weekOptions[0]);
        const manualWeek =
          isPlanSelectionManual && selectedWeek && weekOptions.includes(selectedWeek)
            ? selectedWeek
            : null;
        nextSelectedWeek = manualWeek ?? autoWeek;
        const daysForSelectedWeek = getDaysForWeek(nextPlanDays, nextSelectedWeek);
        const manualWeekday =
          isPlanSelectionManual &&
          selectedWeekday &&
          daysForSelectedWeek.some((day) => day.weekday === selectedWeekday)
            ? selectedWeekday
            : null;
        nextSelectedWeekday =
          manualWeekday ??
          (autoFollowDay?.week === nextSelectedWeek ? autoFollowDay.weekday : null) ??
          (daysForSelectedWeek.some((day) => day.weekday === todayWeekday)
            ? todayWeekday
            : (daysForSelectedWeek[0]?.weekday ?? todayWeekday));
        const phaseForSelectedWeek =
          nextPhases.find(
            (phase) =>
              nextSelectedWeek !== null &&
              nextSelectedWeek >= phase.startWeek &&
              nextSelectedWeek <= phase.endWeek,
          ) ?? nextPhases.find((phase) => phase.type === nextGroup.currentPhaseType);

        result = await repositories.planRepository.getTodayPlan({
          currentWeek: nextSelectedWeek,
          fridayEnabled: true,
          groupId: nextGroup.id,
          phaseType: phaseForSelectedWeek?.type ?? nextGroup.currentPhaseType,
          planId: nextGroup.activePlanId,
          recoveryMode,
          weekday: nextSelectedWeekday,
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
      setPlanDays(nextPlanDays);
      setSelectedWeek(nextSelectedWeek);
      setSelectedWeekday(nextSelectedWeekday);
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
  }, [isPlanSelectionManual, repositories, recoveryMode, selectedGroupId, selectedWeek, selectedWeekday, setSelectedGroupId, todayWeekday]);

  useFocusEffect(
    useCallback(() => {
      void loadHome();
    }, [loadHome]),
  );

  const resolveSelectedWorkoutPlan = useCallback(async (): Promise<TodayPlanResult | null> => {
    if (!group || !activePlan) {
      return null;
    }

    const currentWeek = selectedWeek ?? group.currentWeek;
    const daysForSelectedWeek = getDaysForWeek(planDays, currentWeek);
    const selectedDayStillExists =
      selectedWeekday && daysForSelectedWeek.some((day) => day.weekday === selectedWeekday);
    const weekday =
      selectedDayStillExists
        ? selectedWeekday
        : daysForSelectedWeek.some((day) => day.weekday === todayWeekday)
          ? todayWeekday
          : (daysForSelectedWeek[0]?.weekday ?? todayWeekday);
    const phaseForSelectedWeek =
      planPhases.find(
        (phase) => currentWeek >= phase.startWeek && currentWeek <= phase.endWeek,
      ) ?? planPhases.find((phase) => phase.type === group.currentPhaseType);

    const resolvedPlan = await repositories.planRepository.getTodayPlan({
      currentWeek,
      fridayEnabled: true,
      groupId: group.id,
      phaseType: phaseForSelectedWeek?.type ?? group.currentPhaseType,
      planId: activePlan.id,
      recoveryMode,
      weekday,
    });

    const planExerciseIds = resolvedPlan.exercises.map((exercise) => exercise.exerciseId);
    const nextExercises =
      planExerciseIds.length > 0
        ? await repositories.exerciseRepository.listExercisesByIds(planExerciseIds)
        : [];

    setSelectedWeek(currentWeek);
    setSelectedWeekday(weekday);
    setTodayPlan(resolvedPlan);
    setExerciseMap(Object.fromEntries(nextExercises.map((exercise) => [exercise.id, exercise])));

    return resolvedPlan;
  }, [
    activePlan,
    group,
    planDays,
    planPhases,
    recoveryMode,
    repositories,
    selectedWeek,
    selectedWeekday,
    todayWeekday,
  ]);

  const openWorkoutScope = useCallback(async () => {
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

    let resolvedPlan: TodayPlanResult | null = null;
    try {
      resolvedPlan = await resolveSelectedWorkoutPlan();
    } catch (resolveError) {
      setError(resolveError instanceof Error ? resolveError.message : '训练计划刷新失败。');
      return;
    }

    if (!resolvedPlan?.day || resolvedPlan.isRestDay || resolvedPlan.exercises.length === 0) {
      setNotice({
        title: '今日计划休息',
        message: '恢复也是计划的一部分。可以去计划页查看本周安排。',
      });
      return;
    }

    const nextScope: WorkoutRecordScope = members.length > 1 ? 'group_local' : 'solo_local';
    const currentMemberId = members[0]?.id;
    setRecordScope(nextScope);
    setSelectedParticipantIds(
      nextScope === 'solo_local' && currentMemberId
        ? [currentMemberId]
        : members.map((member) => member.id),
    );
    setScopeSheetVisible(true);
  }, [group, guardFeature, members, resolveSelectedWorkoutPlan]);

  const toggleParticipant = useCallback((memberId: string) => {
    setSelectedParticipantIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }, []);

  const createWorkoutSession = useCallback(
    async (input: CreateSessionFromTodayPlanInput) => {
      const session = await repositories.workoutRepository.createSessionFromTodayPlan(input);
      void enqueueSyncCandidate({
        entityType: 'workoutSessions',
        localId: session.id,
        operation: 'create',
        payload: {
          date: session.date,
          groupId: session.groupId,
          phaseId: session.phaseId,
          planId: session.planId,
          status: session.status,
          title: session.title,
          trainingMode: session.trainingMode,
          week: session.week,
          weekday: session.weekday,
        },
        status: 'pending_create',
        updatedAt: session.updatedAt,
      }).catch(() => undefined);
      setScopeSheetVisible(false);
      setConflictingSession(null);
      setPendingWorkoutStart(null);
      router.push({ pathname: '/workout/[sessionId]', params: { sessionId: session.id } });
    },
    [repositories],
  );

  const startWorkout = useCallback(async () => {
    if (!guardFeature('start_workout')) {
      return;
    }

    const currentMemberId = members[0]?.id;
    const availableMemberIds = new Set(members.map((member) => member.id));
    const participantMemberIds =
      recordScope === 'solo_local'
        ? currentMemberId
          ? [currentMemberId]
          : []
        : selectedParticipantIds.filter((memberId) => availableMemberIds.has(memberId));

    if (participantMemberIds.length === 0) {
      setNotice({ title: '请选择参与成员', message: '本次训练至少需要选择 1 位记录对象。' });
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      const resolvedPlan = await resolveSelectedWorkoutPlan();

      if (!group || !resolvedPlan?.day || resolvedPlan.isRestDay || resolvedPlan.exercises.length === 0) {
        setScopeSheetVisible(false);
        setNotice({ title: '暂无可开始训练', message: '请选择一个包含动作的训练日后再开始。' });
        return;
      }

      const startInput: CreateSessionFromTodayPlanInput = {
        date: getLocalDateString(),
        groupId: group.id,
        phaseId: resolvedPlan.phase.id,
        planExerciseIds: resolvedPlan.exercises.map((exercise) => exercise.id),
        planId: resolvedPlan.plan.id,
        participantMemberIds,
        title: resolvedPlan.day.title,
        trainingMode: recordScope,
        week: resolvedPlan.day.week,
        weekday: resolvedPlan.day.weekday,
      };

      const openSessions = await repositories.workoutRepository.listOpenSessionsForDate({
        date: startInput.date,
        groupId: startInput.groupId,
      });
      const hasMatchingOpenSession = openSessions.some((session) =>
        isSameWorkoutSelection(session, startInput),
      );
      const conflict = hasMatchingOpenSession
        ? null
        : openSessions.find((session) => !isSameWorkoutSelection(session, startInput));

      if (conflict) {
        setPendingWorkoutStart(startInput);
        setConflictingSession(conflict);
        setScopeSheetVisible(false);
        return;
      }

      await createWorkoutSession(startInput);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '开始训练失败。');
    } finally {
      setIsStarting(false);
    }
  }, [
    createWorkoutSession,
    group,
    guardFeature,
    members,
    recordScope,
    repositories,
    resolveSelectedWorkoutPlan,
    selectedParticipantIds,
  ]);

  const continueConflictingSession = useCallback(() => {
    if (!conflictingSession) {
      return;
    }

    const sessionId = conflictingSession.id;
    setConflictingSession(null);
    setPendingWorkoutStart(null);
    router.push({ pathname: '/workout/[sessionId]', params: { sessionId } });
  }, [conflictingSession]);

  const discardConflictAndStart = useCallback(async () => {
    if (!conflictingSession || !pendingWorkoutStart) {
      return;
    }

    setIsStarting(true);
    setError(null);

    try {
      await repositories.workoutRepository.updateSession({
        id: conflictingSession.id,
        status: 'cancelled',
      });
      await createWorkoutSession(pendingWorkoutStart);
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '开始训练失败。');
    } finally {
      setIsStarting(false);
    }
  }, [conflictingSession, createWorkoutSession, pendingWorkoutStart, repositories]);

  const changeRecordScope = useCallback(
    (scope: WorkoutRecordScope) => {
      setRecordScope(scope);
      if (scope === 'solo_local') {
        const currentMemberId = members[0]?.id;
        setSelectedParticipantIds(currentMemberId ? [currentMemberId] : []);
        return;
      }

      setSelectedParticipantIds((current) => {
        const validCurrent = current.filter((memberId) => members.some((member) => member.id === memberId));
        return validCurrent.length > 0 ? validCurrent : members.map((member) => member.id);
      });
    },
    [members],
  );

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
  const selectedWeekValue = selectedWeek ?? group?.currentWeek ?? 1;
  const nextDeloadDays = group ? getDaysUntilNextDeload(selectedWeekValue, planPhases) : null;
  const phaseLabel = formatPhaseLabel(todayPlan?.phase ?? null, group?.currentPhaseType);
  const selectedPlanDay = todayPlan?.day ?? null;
  const dayLabel = selectedPlanDay
    ? `第 ${selectedPlanDay.week} 周 · ${formatDayChoiceTitle(selectedPlanDay)}`
    : `第 ${selectedWeekValue} 周`;
  const planWeekOptions = getPlanWeekOptions(planDays, selectedWeekValue);
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
              <Ionicons color={colors.textStrong} name="phone-portrait-outline" size={18} />
              <AppText variant="bodySmall" weight="800">
                当前使用训练记录
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
              <PlanQuickSwitchCard
                dayLabel={dayLabel}
                onPress={() => setDaySheetVisible(true)}
                phaseLabel={phaseLabel}
                planName={activePlan.name}
                progressLabel={weeklyProgressLabel}
                progressPercent={weeklyProgressPercent}
              />

              <RecoveryModeSelector
                currentMode={recoveryMode}
                onChange={setRecoveryMode}
                onMorePress={() => setAdviceSheetVisible(true)}
                options={recoveryOptions}
              />

              {isRestState ? (
                <HomeEmptyState
                  actionLabel={todayPlan?.isRestDay ? '查看本周安排' : '调整动作筛选'}
                  compact
                  description={todayPlan?.reason ?? '恢复也是计划的一部分'}
                  icon="moon-outline"
                  onActionPress={() => {
                    if (todayPlan?.isRestDay) {
                      router.push('/(tabs)/plan');
                    } else {
                      setAdviceSheetVisible(true);
                    }
                  }}
                  title="今日计划休息"
                />
              ) : null}

              {!isRestState ? (
                <TodaySummaryCard
                  activePlanWeeks={activePlanWeeks}
                  dayTitle={selectedPlanDay?.title ?? '今日训练'}
                  mainFocus={mainFocus ?? '暂无动作'}
                  nextDeloadDays={nextDeloadDays}
                  phaseLabel={phaseLabel}
                  selectedWeek={selectedWeekValue}
                  suggestedWeight={suggestedWeight}
                />
              ) : null}

              {!isRestState ? (
                <StartWorkoutCard
                  disabled={!canStartWorkout || isStarting}
                  isStarting={isStarting}
                  onPress={() => void openWorkoutScope()}
                />
              ) : null}

              {!isRestState ? (
                <TodayFocusList
                  items={focusExercises}
                  onOpenAll={() => router.push('/(tabs)/plan')}
                />
              ) : null}

              <PartnerStrip
                currentMemberId={currentMember?.id}
                members={members}
                onMemberPress={(member) =>
                  router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } })
                }
                onOpenAll={() => router.push('/settings/members' as never)}
                profiles={profiles}
              />

              <WeeklyOverviewGrid overview={weeklyOverview} />

            </>
          ) : null}
        </>
      ) : null}

      <PlanDayPickerSheet
        days={planDays}
        onClose={() => setDaySheetVisible(false)}
        onFreeTraining={() => {
          setDaySheetVisible(false);
          router.push('/history/manual' as never);
        }}
        onSelectDay={(day) => {
          setPlanSelectionManual(true);
          setSelectedWeek(day.week);
          setSelectedWeekday(day.weekday);
          setDaySheetVisible(false);
        }}
        onSelectWeek={(week) => {
          setPlanSelectionManual(true);
          setSelectedWeek(week);
        }}
        selectedWeek={selectedWeekValue}
        selectedWeekday={selectedWeekday}
        visible={isDaySheetVisible}
        weekOptions={planWeekOptions}
      />

      <WorkoutScopeSheet
        currentMemberId={currentMember?.id}
        isStarting={isStarting}
        members={members}
        onClose={() => setScopeSheetVisible(false)}
        onScopeChange={changeRecordScope}
        onStart={() => void startWorkout()}
        onToggleMember={toggleParticipant}
        scope={recordScope}
        selectedMemberIds={selectedParticipantIds}
        profiles={profiles}
        visible={isScopeSheetVisible}
      />

      <AppModalSheet
        onClose={() => {
          setConflictingSession(null);
          setPendingWorkoutStart(null);
        }}
        position="center"
        subtitle="今天还有一场未完成训练，与当前选择的计划或训练日不同。"
        title="继续上次训练？"
        visible={Boolean(conflictingSession)}
      >
        {conflictingSession ? (
          <View style={styles.conflictSummary}>
            <View style={styles.conflictRow}>
              <AppText tone="muted" variant="caption" weight="800">
                上次训练
              </AppText>
              <AppText variant="bodySmall" weight="900">
                {conflictingSession.title}
              </AppText>
              <AppText tone="muted" variant="caption">
                {formatSessionSelection(conflictingSession)}
              </AppText>
            </View>
            {pendingWorkoutStart ? (
              <View style={styles.conflictRow}>
                <AppText tone="muted" variant="caption" weight="800">
                  当前选择
                </AppText>
                <AppText variant="bodySmall" weight="900">
                  {pendingWorkoutStart.title}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {formatWorkoutStartSelection(pendingWorkoutStart, todayPlan?.day ?? null)}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.conflictActions}>
          <AppButton onPress={continueConflictingSession} size="lg">
            继续上次训练
          </AppButton>
          <AppButton
            loading={isStarting}
            onPress={() => void discardConflictAndStart()}
            size="lg"
            variant="danger"
          >
            放弃旧训练并开始新计划
          </AppButton>
          <AppButton
            onPress={() => {
              setConflictingSession(null);
              setPendingWorkoutStart(null);
            }}
            variant="ghost"
          >
            返回
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setAdviceSheetVisible(false)}
        subtitle="这里会影响本次创建的动作快照。完整动作包含 A/B/C，精简辅助只保留 A/B，只做主项只保留 A。"
        title="选择动作筛选"
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

function PlanQuickSwitchCard({
  dayLabel,
  onPress,
  phaseLabel,
  planName,
  progressLabel,
  progressPercent,
}: {
  dayLabel: string;
  onPress: () => void;
  phaseLabel: string;
  planName: string;
  progressLabel: string;
  progressPercent: number;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.planSwitchCard, pressed && styles.pressed]}>
      <View style={styles.planSwitchMain}>
        <View style={styles.planSwitchIcon}>
          <Ionicons color={colors.primary} name="calendar-outline" size={20} />
        </View>
        <View style={styles.planSwitchText}>
          <AppText numberOfLines={1} variant="bodySmall" weight="900">
            {planName}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {dayLabel} · {phaseLabel}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
      </View>
      <View style={styles.planProgressRow}>
        <AppText tone="muted" variant="caption">
          本周进度 {progressLabel}
        </AppText>
        <View style={styles.planProgressTrack}>
          <View style={[styles.planProgressFill, { width: `${progressPercent}%` }]} />
        </View>
      </View>
    </Pressable>
  );
}

function RecoveryModeSelector({
  currentMode,
  onChange,
  onMorePress,
  options,
}: {
  currentMode: RecoveryMode;
  onChange: (mode: RecoveryMode) => void;
  onMorePress: () => void;
  options: AdviceConfig[];
}) {
  return (
    <AppCard style={styles.recoverySelectorCard}>
      <View style={styles.selectorHeader}>
        <AppText variant="bodySmall" weight="900">
          动作筛选
        </AppText>
        <Pressable accessibilityRole="button" onPress={onMorePress} style={styles.selectorMore}>
          <AppText tone="muted" variant="caption" weight="800">
            说明
          </AppText>
          <Ionicons color={colors.textMuted} name="information-circle-outline" size={15} />
        </Pressable>
      </View>
      <View style={styles.recoveryPills}>
        {options.map((option) => {
          const active = currentMode === option.mode;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.mode}
              onPress={() => onChange(option.mode)}
              style={({ pressed }) => [
                styles.recoveryPill,
                active && styles.recoveryPillActive,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons color={active ? colors.surface : colors.textMuted} name={option.icon} size={15} />
              <AppText
                numberOfLines={1}
                style={active ? styles.recoveryPillTextActive : styles.recoveryPillText}
                variant="caption"
                weight="900"
              >
                {option.status}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

function TodaySummaryCard({
  activePlanWeeks,
  dayTitle,
  mainFocus,
  nextDeloadDays,
  phaseLabel,
  selectedWeek,
  suggestedWeight,
}: {
  activePlanWeeks: number;
  dayTitle: string;
  mainFocus: string;
  nextDeloadDays: number | null;
  phaseLabel: string;
  selectedWeek: number;
  suggestedWeight: SuggestedWeightDisplay;
}) {
  return (
    <View style={styles.todaySummary}>
      <ImageBackground
        imageStyle={styles.summaryImage}
        resizeMode="cover"
        source={liftmarkImages.trainingHero}
        style={styles.summaryImageBackground}
      >
        <View style={styles.summaryScrim} />
        <View style={styles.summaryContent}>
          <View style={styles.phaseBadge}>
            <Ionicons color={colors.surface} name="flash" size={13} />
            <AppText tone="inverse" variant="caption" weight="900">
              {phaseLabel}
            </AppText>
          </View>
          <AppText numberOfLines={1} style={styles.summaryTitle} variant="title" weight="900">
            {dayTitle}
          </AppText>
          <AppText numberOfLines={1} style={styles.summarySubtitle} variant="bodySmall" weight="700">
            {mainFocus}
          </AppText>
        </View>
      </ImageBackground>
      <View style={styles.metricRow}>
        <SmallMetricCard helper={suggestedWeight.hint} label="建议重量" value={suggestedWeight.value} />
        <SmallMetricCard
          label={nextDeloadDays ? '距离下次减载' : '当前周数'}
          value={nextDeloadDays ? `${nextDeloadDays} 天` : `第 ${selectedWeek} / ${activePlanWeeks || '-'} 周`}
        />
      </View>
    </View>
  );
}

function StartWorkoutCard({
  disabled,
  isStarting,
  onPress,
}: {
  disabled: boolean;
  isStarting: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.startSection}>
      <View style={styles.startCopy}>
        <AppText variant="subtitle" weight="900">
          准备开始
        </AppText>
        <AppText tone="muted" variant="caption">
          开始前选择本次记录给谁，避免把未参与成员写入训练记录。
        </AppText>
      </View>
      <AppButton disabled={disabled} icon="play" loading={isStarting} onPress={onPress} size="lg">
        选择成员并开始
      </AppButton>
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
  onMemberPress,
  onOpenAll,
  profiles,
}: {
  currentMemberId?: string;
  members: GroupMember[];
  onMemberPress: (member: GroupMember) => void;
  onOpenAll: () => void;
  profiles: Record<string, MemberProfile | null>;
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
              <View style={active && styles.avatarActiveWrap}>
                <Avatar
                  avatarLocalUri={profiles[member.id]?.avatarLocalUri}
                  avatarThumbUrl={profiles[member.id]?.avatarThumbUrl}
                  avatarUrl={profiles[member.id]?.avatarUrl ?? member.avatarUrl}
                  name={member.displayName}
                  size={52}
                />
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
      <Ionicons color={color} name={icon} size={24} />
    </View>
  );
}

function PlanDayPickerSheet({
  days,
  onClose,
  onFreeTraining,
  onSelectDay,
  onSelectWeek,
  selectedWeek,
  selectedWeekday,
  visible,
  weekOptions,
}: {
  days: PlanDay[];
  onClose: () => void;
  onFreeTraining: () => void;
  onSelectDay: (day: PlanDay) => void;
  onSelectWeek: (week: number) => void;
  selectedWeek: number;
  selectedWeekday: Weekday | null;
  visible: boolean;
  weekOptions: number[];
}) {
  const weekDays = getDaysForWeek(days, selectedWeek);

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="这里只切换本次首页和即将开始的训练，不会修改小组当前周。"
      title="选择今天练哪天"
      visible={visible}
    >
      <View style={styles.weekChips}>
        {weekOptions.map((week) => (
          <Pressable
            accessibilityRole="button"
            key={week}
            onPress={() => onSelectWeek(week)}
            style={({ pressed }) => [
              styles.weekChip,
              week === selectedWeek && styles.weekChipActive,
              pressed && styles.pressed,
            ]}
          >
            <AppText
              style={week === selectedWeek ? styles.weekChipTextActive : styles.weekChipText}
              variant="caption"
              weight="900"
            >
              第 {week} 周
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.dayChoiceList}>
        {weekDays.length === 0 ? (
          <AppText tone="muted" variant="bodySmall">
            这一周还没有计划训练日。
          </AppText>
        ) : (
          weekDays.map((day) => {
            const active = day.weekday === selectedWeekday;
            return (
              <Pressable
                accessibilityRole="button"
                key={day.id}
                onPress={() => onSelectDay(day)}
                style={({ pressed }) => [
                  styles.dayChoice,
                  active && styles.dayChoiceActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.dayChoiceIcon}>
                  <AppText tone="inverse" variant="caption" weight="900">
                    {formatDayChoiceTitle(day).replace('Day ', 'D')}
                  </AppText>
                </View>
                <View style={styles.dayChoiceText}>
                  <AppText variant="bodySmall" weight="900">
                    {formatDayChoiceTitle(day)}
                  </AppText>
                  <AppText numberOfLines={1} tone="muted" variant="caption">
                    {formatDayChoiceSubtitle(day)}
                  </AppText>
                </View>
                {active ? <Tag label="当前" tone="brand" /> : null}
              </Pressable>
            );
          })
        )}

        <Pressable accessibilityRole="button" onPress={onFreeTraining} style={({ pressed }) => [styles.freeTrainingChoice, pressed && styles.pressed]}>
          <View style={styles.freeTrainingIcon}>
            <Ionicons color={colors.primary} name="create-outline" size={18} />
          </View>
          <View style={styles.dayChoiceText}>
            <AppText variant="bodySmall" weight="900">
              自由训练
            </AppText>
            <AppText tone="muted" variant="caption">
              不关联计划，进入补录训练保存本次记录。
            </AppText>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
        </Pressable>
      </View>
    </AppModalSheet>
  );
}

function WorkoutScopeSheet({
  currentMemberId,
  isStarting,
  members,
  onClose,
  onScopeChange,
  onStart,
  onToggleMember,
  scope,
  selectedMemberIds,
  profiles,
  visible,
}: {
  currentMemberId?: string;
  isStarting: boolean;
  members: GroupMember[];
  onClose: () => void;
  onScopeChange: (scope: WorkoutRecordScope) => void;
  onStart: () => void;
  onToggleMember: (memberId: string) => void;
  scope: WorkoutRecordScope;
  selectedMemberIds: string[];
  profiles: Record<string, MemberProfile | null>;
  visible: boolean;
}) {
  const selectedCount = scope === 'solo_local' ? (currentMemberId ? 1 : 0) : selectedMemberIds.length;
  const canStart = selectedCount > 0 && !isStarting;

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="未选择的成员不会生成本次计划组；小组记录后续同步需要成员确认。"
      title="本次训练记录给谁"
      visible={visible}
    >
      <View style={styles.scopeTabs}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onScopeChange('solo_local')}
          style={[styles.scopeTab, scope === 'solo_local' && styles.scopeTabActive]}
        >
          <Ionicons color={scope === 'solo_local' ? colors.surface : colors.textMuted} name="person-outline" size={16} />
          <AppText
            style={scope === 'solo_local' ? styles.scopeTabTextActive : styles.scopeTabText}
            variant="caption"
            weight="900"
          >
            仅我记录
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onScopeChange('group_local')}
          style={[styles.scopeTab, scope === 'group_local' && styles.scopeTabActive]}
        >
          <Ionicons color={scope === 'group_local' ? colors.surface : colors.textMuted} name="people-outline" size={16} />
          <AppText
            style={scope === 'group_local' ? styles.scopeTabTextActive : styles.scopeTabText}
            variant="caption"
            weight="900"
          >
            小组成员
          </AppText>
        </Pressable>
      </View>

      {scope === 'solo_local' ? (
        <View style={styles.scopeHint}>
          <Ionicons color={colors.primary} name="checkmark-circle" size={20} />
          <View style={styles.scopeHintText}>
            <AppText variant="bodySmall" weight="900">
              只为当前成员生成训练组
            </AppText>
            <AppText tone="muted" variant="caption">
              其他小组成员不会出现在本次训练执行页。
            </AppText>
          </View>
        </View>
      ) : (
        <View style={styles.memberSelectList}>
          {members.map((member) => {
            const selected = selectedMemberIds.includes(member.id);
            return (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                key={member.id}
                onPress={() => onToggleMember(member.id)}
                style={({ pressed }) => [
                  styles.memberSelectRow,
                  selected && styles.memberSelectRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={selected && styles.memberSelectAvatarActiveWrap}>
                  <Avatar
                    avatarLocalUri={profiles[member.id]?.avatarLocalUri}
                    avatarThumbUrl={profiles[member.id]?.avatarThumbUrl}
                    avatarUrl={profiles[member.id]?.avatarUrl ?? member.avatarUrl}
                    name={member.displayName}
                    size={38}
                  />
                </View>
                <View style={styles.memberSelectText}>
                  <AppText variant="bodySmall" weight="900">
                    {member.displayName}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    {member.id === currentMemberId ? '当前成员' : '参与本次训练后等待确认同步'}
                  </AppText>
                </View>
                <Ionicons
                  color={selected ? colors.primary : colors.textMuted}
                  name={selected ? 'checkmark-circle' : 'ellipse-outline'}
                  size={21}
                />
              </Pressable>
            );
          })}
        </View>
      )}

      <AppButton disabled={!canStart} loading={isStarting} onPress={onStart} size="lg">
        开始训练
      </AppButton>
    </AppModalSheet>
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
    height: 44,
    justifyContent: 'center',
    width: 44,
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
    height: 52,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 52,
  },
  avatarActive: {
    borderColor: colors.primary,
    borderWidth: 3,
  },
  avatarActiveWrap: {
    borderColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: 2,
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
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  currentMemberName: {
    color: colors.primary,
  },
  dayChoice: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  dayChoiceActive: {
    borderColor: colors.primary,
  },
  dayChoiceIcon: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  dayChoiceList: {
    gap: spacing.sm,
  },
  dayChoiceText: {
    flex: 1,
    gap: 2,
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
    padding: spacing.md,
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
  freeTrainingChoice: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  freeTrainingIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
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
  conflictActions: {
    gap: spacing.sm,
  },
  conflictRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: 3,
    padding: spacing.md,
  },
  conflictSummary: {
    gap: spacing.sm,
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
    minHeight: 50,
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
    minHeight: 188,
    padding: spacing.lg,
    paddingTop: spacing.lg,
  },
  heroDay: {
    color: 'rgba(255,255,255,0.86)',
    marginTop: spacing.sm,
  },
  heroImage: {
    opacity: 0.94,
  },
  heroImageBackground: {
    minHeight: 188,
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
    minHeight: 82,
    padding: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  memberSelectAvatar: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  memberSelectAvatarActive: {
    backgroundColor: colors.primary,
  },
  memberSelectAvatarActiveWrap: {
    borderColor: colors.primary,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  memberSelectList: {
    gap: spacing.sm,
  },
  memberSelectRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  memberSelectRowActive: {
    borderColor: colors.primary,
  },
  memberSelectText: {
    flex: 1,
    gap: 2,
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
  planProgressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  planProgressRow: {
    gap: spacing.xs,
  },
  planProgressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 7,
    overflow: 'hidden',
    width: '100%',
  },
  planSwitchCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  planSwitchIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  planSwitchMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  planSwitchText: {
    flex: 1,
    gap: 2,
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
  recoveryPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    flexGrow: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 34,
    minWidth: '23%',
    paddingHorizontal: spacing.sm,
  },
  recoveryPillActive: {
    backgroundColor: colors.primary,
  },
  recoveryPillText: {
    color: colors.textMuted,
  },
  recoveryPillTextActive: {
    color: colors.surface,
  },
  recoveryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recoverySelectorCard: {
    gap: spacing.sm,
    padding: spacing.md,
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
  scopeHint: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 68,
    padding: spacing.md,
  },
  scopeHintText: {
    flex: 1,
    gap: 2,
  },
  scopeTab: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 40,
  },
  scopeTabActive: {
    backgroundColor: colors.primary,
  },
  scopeTabText: {
    color: colors.textMuted,
  },
  scopeTabTextActive: {
    color: colors.surface,
  },
  scopeTabs: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  sectionAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  selectorHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selectorMore: {
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
  startCopy: {
    flex: 1,
    gap: 2,
  },
  startSection: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    ...shadows.card,
  },
  summaryContent: {
    gap: spacing.xs,
    justifyContent: 'flex-end',
    minHeight: 122,
    padding: spacing.md,
  },
  summaryImage: {
    opacity: 0.94,
  },
  summaryImageBackground: {
    borderRadius: radius.lg,
    minHeight: 122,
    overflow: 'hidden',
  },
  summaryScrim: {
    backgroundColor: 'rgba(1,12,22,0.58)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  summarySubtitle: {
    color: 'rgba(255,255,255,0.86)',
  },
  summaryTitle: {
    color: colors.surface,
  },
  todaySummary: {
    gap: spacing.md,
  },
  weekChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  weekChipActive: {
    backgroundColor: colors.primary,
  },
  weekChipText: {
    color: colors.textMuted,
  },
  weekChipTextActive: {
    color: colors.surface,
  },
  weekChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
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
    minHeight: 78,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    ...shadows.card,
  },
  weeklySection: {
    gap: spacing.md,
  },
});
