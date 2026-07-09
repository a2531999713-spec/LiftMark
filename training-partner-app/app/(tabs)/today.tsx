import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { liftmarkImages } from '@/assets/images';
import { AccountPanel, type AccountProfileUpdate } from '@/components/account';
import { AnnouncementModal } from '@/components/announcement/AnnouncementModal';
import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import {
  CurrentGroupStartCard,
  HomeHeader,
  PlanProgressCard,
  TodayFocusList,
  TodayTrainingHero,
  type TodayFocusItem,
} from '@/components/home';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import { resolveDefaultTrainingMember, resolveDefaultTrainingMemberId } from '@/domain/member/member-selection';
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
import { resolveHomeStatus, type HomeStatus } from '@/domain/home/home-status';
import { calculateSuggestedWeight } from '@/domain/weight/weight-calculator';
import type {
  CreateSessionFromTodayPlanInput,
  WorkoutSession,
  WorkoutSessionDetail,
} from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import {
  deleteAccountAvatar,
  getAccountProfileCache,
  getAvatarDisplay,
  syncAccountAvatarToLocalMemberProfiles,
  updateAccountAvatarFromPicker,
  updateAccountProfileDetails,
  type AccountProfileCache,
  type AvatarPickSource,
} from '@/services/avatar';
import { syncGroupMembersAvatar } from '@/services/memberSyncService';
import { updateDisplayNameAcrossLocalProfiles } from '@/services/profileSyncService';
import { ensureTrainingGroupMainline } from '@/services/trainingMainlineService';
import { ensurePlanStructureCompatibleForGroup } from '@/services/planStructureCompatibilityService';
import {
  fetchCurrentAnnouncement,
  shouldShowAnnouncement,
  type Announcement,
} from '@/services/announcementService';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
import { colors, radius, shadows, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
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

type LastPerformanceMap = Record<string, string>;

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

function maskPhone(phone?: string) {
  if (!phone) return undefined;
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)} **** ${phone.slice(-4)}`;
}

function getMembershipLabel(tier: ReturnType<typeof useAuthStore.getState>['membershipTier']) {
  if (tier === 'lifetime') return '永久会员';
  if (tier === 'pro') return '高级会员';
  return '免费版';
}

function getSyncLabel(authStatus: ReturnType<typeof useAuthStore.getState>['authStatus']) {
  if (authStatus === 'authenticated') return '可手动同步';
  if (authStatus === 'offline_authenticated') return '本机保存';
  if (authStatus === 'unauthenticated') return '未登录';
  return '检查中';
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

function summarizeLastPerformance(
  details: WorkoutSessionDetail[],
  memberId?: string,
): LastPerformanceMap {
  if (!memberId) {
    return {};
  }

  const result: LastPerformanceMap = {};
  const orderedDetails = details
    .slice()
    .sort((left, right) => right.session.date.localeCompare(left.session.date));

  for (const detail of orderedDetails) {
    for (const exercise of detail.exercises) {
      if (result[exercise.exerciseId]) {
        continue;
      }
      const completedSets = detail.sets
        .filter(
          (set) =>
            set.memberId === memberId &&
            set.exerciseRecordId === exercise.id &&
            set.completed &&
            !set.skipped,
        )
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      const latestSet = completedSets[0];
      const weight = latestSet?.actualWeight ?? latestSet?.plannedWeight;
      const reps = latestSet?.actualReps ?? latestSet?.plannedReps;
      if (typeof weight === 'number' && typeof reps === 'number') {
        result[exercise.exerciseId] = `上次 ${weight}kg × ${reps}次`;
      }
    }
  }

  return result;
}

function estimatePlanVolume(
  planExercises: PlanExercise[],
  exerciseMap: Record<string, Exercise>,
  profile: MemberProfile | null,
): string {
  if (!profile) {
    return '--';
  }

  const total = planExercises.reduce((sum, planExercise) => {
    const sets = planExercise.sets ?? 0;
    const reps = planExercise.reps ?? planExercise.repMax ?? planExercise.repMin ?? 0;
    if (sets <= 0 || reps <= 0) {
      return sum;
    }

    const exercise = exerciseMap[planExercise.exerciseId] ?? null;
    const result = calculateSuggestedWeight({
      referenceLift: planExercise.referenceLift,
      percent1RM: planExercise.percent1RM,
      repMax: planExercise.repMax,
      repMin: planExercise.repMin,
      reps: planExercise.reps,
      equipment: exercise?.equipment ?? 'other',
      profile,
    });

    if (result.status !== 'ready') {
      return sum;
    }

    return sum + result.weight * sets * reps;
  }, 0);

  return total > 0 ? formatKg(total) : '--';
}

function estimateWorkoutMinutes(planExercises: PlanExercise[]) {
  if (planExercises.length === 0) {
    return undefined;
  }

  const seconds = planExercises.reduce((sum, exercise) => {
    const sets = exercise.sets ?? 3;
    const rest = exercise.restSeconds ?? 90;
    return sum + sets * (rest + 45);
  }, 8 * 60);

  return Math.max(20, Math.round(seconds / 60 / 5) * 5);
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

const homeHeaderTitlePool = [
  // 激励型
  '今天也别空过',
  '把训练刻进今天',
  '完成一组，再说别的',
  '计划在这，剩下靠你',
  '今天继续推进',
  '这一组算数',
  '慢慢加重，稳定进步',
  '练完再休息',
  '重量不骗人，练就对了',
  '今天不偷懒，明天不后悔',
  '昨天的极限，今天的热身',
  '每次训练都在超越自己',
  '汗水是进步的证明',
  '今天的努力，明天的底气',
  '别让昨天的自己失望',
  '每组都全力以赴',
  '变强没有捷径，但有今天',
    // 沉稳型
  '专注当下，每组到位',
  '稳稳推进，悄悄变强',
  '按计划训练，凭实力进步',
  '组间休息，别休息太久',
  '今天是计划的一部分',
  '稳定的节奏，持续的进步',
  '把动作做好，把重量加稳',
  '训练不会骗人，数据会说话',
  // 目标导向
  '今天的训练，明天的成绩',
  '按计划执行，看数据说话',
  '每完成一次，就更近一步',
  '记录今天，见证未来',
  '训练有计划，进步有方向',
  '今天的完成度是多少？',
  '让每次训练都有意义',
  '今天的训练，就是明天的突破',
    // 热血型
  '练就完了，别多想',
  '只有练过才知道',
  '今日不练，更待何时',
  '把疲惫碾碎，把力量炼成',
  '燃起来，今天的训练开始了',
  '别废话，直接开练',
  '每个动作都在铸造更好的你',
  '今天份的狠劲，用在这里',
    // 佛系有力量
  '来了就好，开练吧',
  '练多少都是进步',
  '今天状态不错，继续保持',
  '训练是和自己对话的时间',
  '慢慢来，比较快',
  '今天能练多少是多少',
  '享受训练的过程，结果自然来',
  '不急，但不停',
   // 功能关联
  '今天计划已就绪，开始吧',
  '你的训练，由你掌控',
  '用数据记录每一次进步',
  '计划在这里，执行在你',
  '每次训练都是数据积累',
  '让训练有迹可循',
  '今天要完成几个动作？',
  '重量、组数、次数，都在这里',
  '今日训练，今日毕',
  '把时间献给训练',
    // 文艺简约
  '一组一组的来，一点一点的强',
  '让今天比昨天多一点',
  '认真训练，认真生活',
  '力量，从每一次动作中生长',
  '刻下今天的训练痕迹',
  '练刻，记录每一次成长',
];

function pickDailyHomeTitle() {
  const key = getLocalDateString();
  const score = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return homeHeaderTitlePool[score % homeHeaderTitlePool.length];
}

function buildHomeHeaderCopy(input: {
  currentGroupName?: string;
  memberCount: number;
  syncLabel: string;
}): { subtitle: string; title: string } {
  const groupLabel = input.currentGroupName
    ? `${input.currentGroupName} · ${input.memberCount} 人`
    : input.syncLabel;

  return {
    subtitle: `${formatTodayDate()} · ${groupLabel}`,
    title: pickDailyHomeTitle(),
  };
}

async function loadOrDefault<T>(label: string, task: Promise<T>, fallback: T): Promise<T> {
  try {
    return await task;
  } catch (error) {
    console.error(`[home] ${label} failed`, error);
    return fallback;
  }
}

function isTrainablePlan(plan: PlanTemplate | null): plan is PlanTemplate {
  if (!plan) return false;
  if (plan.source === 'system' || plan.visibility === 'system') return true;
  return !plan.status || plan.status === 'active';
}

function compactDetails(details: (WorkoutSessionDetail | null)[]): WorkoutSessionDetail[] {
  return details.filter((detail): detail is WorkoutSessionDetail => Boolean(detail));
}

function isSameWorkoutSelection(
  session: WorkoutSession,
  input: CreateSessionFromTodayPlanInput,
): boolean {
  return (
    session.planId === input.planId &&
    (!session.planDayId || !input.planDayId || session.planDayId === input.planDayId) &&
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
  const membershipTier = useAuthStore((state) => state.membershipTier);
  const logout = useAuthStore((state) => state.logout);
  const updateLocalUser = useAuthStore((state) => state.updateLocalUser);
  const user = useAuthStore((state) => state.user);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [recoveryMode, setRecoveryMode] = useState<RecoveryMode>('good');
  const [todayPlan, setTodayPlan] = useState<TodayPlanResult | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  // 未经 isTrainablePlan 过滤的原始 activePlan，用于识别 completed/archived/abandoned
  const [rawActivePlan, setRawActivePlan] = useState<PlanTemplate | null>(null);
  const [planPhases, setPlanPhases] = useState<PlanPhase[]>([]);
  const [planDays, setPlanDays] = useState<PlanDay[]>([]);
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [group, setGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [lastPerformanceByExerciseId, setLastPerformanceByExerciseId] = useState<LastPerformanceMap>({});
  const [recentVisibleSessionCount, setRecentVisibleSessionCount] = useState(0);
  const [weeklyOverview, setWeeklyOverview] = useState<WeeklyOverview>(emptyWeeklyOverview);
  const [isAdviceSheetVisible, setAdviceSheetVisible] = useState(false);
  const [isAccountMenuVisible, setAccountMenuVisible] = useState(false);
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
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [latestWeightLabel, setLatestWeightLabel] = useState<string | null>(null);
  const loadHomeRequestRef = useRef(0);
  const lastAnnouncementFetchRef = useRef(0);
  const ANNOUNCEMENT_FETCH_THROTTLE_MS = 5 * 60 * 1000;

  const loadHome = useCallback(async () => {
    const requestId = loadHomeRequestRef.current + 1;
    loadHomeRequestRef.current = requestId;
    const isLatestRequest = () => requestId === loadHomeRequestRef.current;

    // 已有数据时不强制 loading（避免切 Tab 白屏），只在无数据时显示 loading
    const hasData = Boolean(group && todayPlan);
    if (!hasData) {
      setIsLoading(true);
    }
    setError(null);

    try {
      await initializeLocalDatabase();
      const latestUser = useAuthStore.getState().user;
      const allGroups = await repositories.groupRepository.listGroups();
      if (!isLatestRequest()) return;
      setGroups(allGroups);
      let nextGroup = allGroups.find((item) => item.id === selectedGroupId) ?? allGroups[0] ?? null;
      if (!nextGroup) {
        const nextAccountProfile = latestUser ? await getAccountProfileCache(latestUser.id) : null;
        if (!isLatestRequest()) return;
        setGroup(null);
        setActivePlan(null);
        setRawActivePlan(null);
        setTodayPlan(null);
        setMembers([]);
        setProfiles({});
        setAccountProfile(nextAccountProfile);
        setLastPerformanceByExerciseId({});
        setPlanPhases([]);
        setPlanDays([]);
        setSelectedWeek(null);
        setSelectedWeekday(null);
        setExerciseMap({});
        setRecentVisibleSessionCount(0);
        setWeeklyOverview(emptyWeeklyOverview);
        return;
      }
      if (nextGroup.id !== selectedGroupId) {
        setSelectedGroupId(nextGroup.id);
      }

      void syncGroupMembersAvatar(nextGroup.id).catch((avatarError) => {
        console.error('[home] member avatar sync failed', avatarError);
      });

      const [loadedActivePlan, nextMembers] = await Promise.all([
        loadOrDefault('active plan load', repositories.planRepository.getPlanById(nextGroup.activePlanId), null),
        loadOrDefault('member list load', repositories.memberRepository.listMembers(nextGroup.id), []),
      ]);
      const nextActivePlan = isTrainablePlan(loadedActivePlan) ? loadedActivePlan : null;
      const nextProfiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await loadOrDefault(
            `member profile ${member.id}`,
            repositories.memberRepository.getMemberProfile(member.id),
            null,
          ),
        ]),
      );
      const nextProfilesByMemberId = Object.fromEntries(nextProfiles);
      const currentMember = resolveDefaultTrainingMember(nextMembers, latestUser?.id);
      const [weekSessions, recentSessions, nextPhasesInitial, nextPlanDaysInitial, nextAccountProfile] = await Promise.all([
        loadOrDefault(
          'weekly sessions load',
          repositories.workoutRepository.listSessions({
            fromDate: getLocalDateString(getWeekStart()),
            groupId: nextGroup.id,
            memberId: currentMember?.id,
            toDate: getLocalDateString(getWeekEnd()),
            limit: 80,
          }),
          [],
        ),
        loadOrDefault(
          'recent sessions load',
          repositories.workoutRepository.listSessions({
            groupId: nextGroup.id,
            memberId: currentMember?.id,
            limit: 80,
          }),
          [],
        ),
        nextActivePlan
          ? loadOrDefault('plan phases load', repositories.planRepository.listPlanPhases(nextActivePlan.id), [])
          : Promise.resolve([]),
        nextActivePlan
          ? loadOrDefault('plan days load', repositories.planRepository.listPlanDays(nextActivePlan.id), [])
          : Promise.resolve([]),
        latestUser ? loadOrDefault('account profile load', getAccountProfileCache(latestUser.id), null) : Promise.resolve(null),
      ]);
      // 用 let 以便计划结构兼容修复后能重新赋值
      let nextPhases = nextPhasesInitial;
      let nextPlanDays = nextPlanDaysInitial;
      const weekDetails = await Promise.all(
        weekSessions.map((session) =>
          loadOrDefault(`weekly session detail ${session.id}`, repositories.workoutRepository.getSessionDetail(session.id), null),
        ),
      );
      const recentDetails = await Promise.all(
        recentSessions.map((session) =>
          loadOrDefault(`recent session detail ${session.id}`, repositories.workoutRepository.getSessionDetail(session.id), null),
        ),
      );

      let result: TodayPlanResult | null = null;
      let nextExerciseMap: Record<string, Exercise> = {};
      let nextSelectedWeek: number | null = null;
      let nextSelectedWeekday: Weekday | null = null;

      if (nextActivePlan) {
        const weekOptions = getPlanWeekOptions(nextPlanDays, nextGroup.currentWeek);
        const safeWeekDetails = compactDetails(weekDetails);
        const completedPlanDayKeys = getCompletedPlanDayKeys(safeWeekDetails, nextActivePlan.id);
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

        result = await loadOrDefault(
          'today plan load',
          repositories.planRepository.getTodayPlan({
            currentWeek: nextSelectedWeek,
            fridayEnabled: true,
            groupId: nextGroup.id,
            phaseType: phaseForSelectedWeek?.type ?? nextGroup.currentPhaseType,
            planId: nextGroup.activePlanId,
            recoveryMode,
            weekday: nextSelectedWeekday,
          }),
          null,
        );

        // 首页解析失败时，尝试一次计划结构兼容修复后重新解析。
        // 覆盖场景：plan_phases 缺失、currentWeek 超出范围、currentPhaseType 不匹配、
        // plan_days.phase_id 悬空。修复后重新读取 phases/days 并重试 getTodayPlan。
        if (!result && nextActivePlan) {
          try {
            const compatibility = await ensurePlanStructureCompatibleForGroup({
              repositories,
              group: nextGroup,
              plan: nextActivePlan,
            });
            if (compatibility.repaired) {
              // 修复后重新读取 phases/days 与重试 today plan
              const repairedPhases = await loadOrDefault(
                'plan phases reload after compatibility',
                repositories.planRepository.listPlanPhases(nextActivePlan.id),
                [],
              );
              const repairedDays = await loadOrDefault(
                'plan days reload after compatibility',
                repositories.planRepository.listPlanDays(nextActivePlan.id),
                [],
              );
              nextPhases = repairedPhases;
              nextPlanDays = repairedDays;
              // 用修复后的 group 重新计算 week/weekday/phase
              const repairedWeekOptions = getPlanWeekOptions(repairedDays, compatibility.group.currentWeek);
              const repairedAutoWeek = repairedWeekOptions.includes(compatibility.group.currentWeek)
                ? compatibility.group.currentWeek
                : repairedWeekOptions[0];
              nextSelectedWeek = manualWeek ?? repairedAutoWeek;
              const repairedDaysForWeek = getDaysForWeek(repairedDays, nextSelectedWeek);
              nextSelectedWeekday =
                manualWeekday ??
                (repairedDaysForWeek.some((day) => day.weekday === todayWeekday)
                  ? todayWeekday
                  : (repairedDaysForWeek[0]?.weekday ?? todayWeekday));
              const repairedPhaseForWeek =
                repairedPhases.find(
                  (phase) =>
                    nextSelectedWeek !== null &&
                    nextSelectedWeek >= phase.startWeek &&
                    nextSelectedWeek <= phase.endWeek,
                ) ?? repairedPhases.find((phase) => phase.type === compatibility.group.currentPhaseType);

              result = await loadOrDefault(
                'today plan reload after compatibility',
                repositories.planRepository.getTodayPlan({
                  currentWeek: nextSelectedWeek,
                  fridayEnabled: true,
                  groupId: compatibility.group.id,
                  phaseType: repairedPhaseForWeek?.type ?? compatibility.group.currentPhaseType,
                  planId: nextGroup.activePlanId,
                  recoveryMode,
                  weekday: nextSelectedWeekday,
                }),
                null,
              );
              if (result) {
                // 修复成功，更新 group 引用以便后续渲染使用正确的 currentWeek/currentPhaseType
                nextGroup = compatibility.group;
              }
            }
          } catch (compatibilityError) {
            console.warn('[home] plan structure compatibility failed', compatibilityError);
          }
        }

        const planExerciseIds = result?.exercises.map((exercise) => exercise.exerciseId) ?? [];
        const nextExercises =
          planExerciseIds.length > 0
            ? await loadOrDefault(
              'exercise map load',
              repositories.exerciseRepository.listExercisesByIds(planExerciseIds),
              [],
            )
            : [];
        nextExerciseMap = Object.fromEntries(
          nextExercises.map((exercise) => [exercise.id, exercise]),
        );
      }

      if (!isLatestRequest()) return;
      setGroup(nextGroup);
      setActivePlan(nextActivePlan);
      setRawActivePlan(loadedActivePlan);
      setTodayPlan(result);
      setPlanDays(nextPlanDays);
      setSelectedWeek(nextSelectedWeek);
      setSelectedWeekday(nextSelectedWeekday);
      setMembers(nextMembers);
      setProfiles(nextProfilesByMemberId);
      setAccountProfile(nextAccountProfile);
      setLastPerformanceByExerciseId(summarizeLastPerformance(compactDetails(recentDetails), currentMember?.id));
      setPlanPhases(nextPhases);
      setExerciseMap(nextExerciseMap);
      setRecentVisibleSessionCount(recentSessions.length);
      setWeeklyOverview(summarizeWeeklyOverview(compactDetails(weekDetails), currentMember?.id));
      try {
        if (currentMember) {
          const metrics = await repositories.bodyMetricsRepository.listMetrics(currentMember.id, 1);
          const latestMetric = metrics[0];
          setLatestWeightLabel(
            latestMetric?.weightKg
              ? `${latestMetric.weightKg}kg · ${latestMetric.date}`
              : null,
          );
        } else {
          setLatestWeightLabel(null);
        }
      } catch {
        setLatestWeightLabel(null);
      }
    } catch (loadError) {
      if (!isLatestRequest()) return;
      console.error('[home] load failed', loadError);
      setError(loadError instanceof Error ? loadError.message : '训练数据加载失败。');
    } finally {
      if (isLatestRequest()) {
        setIsLoading(false);
      }
    }
  }, [isPlanSelectionManual, repositories, recoveryMode, selectedGroupId, selectedWeek, selectedWeekday, setSelectedGroupId, todayWeekday, group, todayPlan]);

  useFocusEffect(
    useCallback(() => {
      void loadHome();
      return () => {
        loadHomeRequestRef.current += 1;
      };
    }, [loadHome]),
  );

  const loadAnnouncement = useCallback(async () => {
    if (authStatus !== 'authenticated' && authStatus !== 'offline_authenticated') {
      return;
    }
    const now = Date.now();
    if (now - lastAnnouncementFetchRef.current < ANNOUNCEMENT_FETCH_THROTTLE_MS) {
      return;
    }
    lastAnnouncementFetchRef.current = now;
    const current = await fetchCurrentAnnouncement();
    if (current && (await shouldShowAnnouncement(current))) {
      setAnnouncement(current);
      setAnnouncementVisible(true);
    }
  }, [authStatus, ANNOUNCEMENT_FETCH_THROTTLE_MS]);

  useFocusEffect(
    useCallback(() => {
      void loadAnnouncement();
    }, [loadAnnouncement]),
  );

  const createInitialTrainingGroup = useCallback(async () => {
    if (!guardFeature('create_group')) {
      return;
    }

    setIsCreatingGroup(true);
    try {
      const { group: createdGroup } = await ensureTrainingGroupMainline(repositories, {
        displayName: user?.displayName,
        groupName: '我的训练小组',
        selectedGroupId,
        userId: user?.id,
      });
      setSelectedGroupId(createdGroup.id);
      await loadHome();
    } catch (createError) {
      setNotice({
        title: '创建小组失败',
        message: createError instanceof Error ? createError.message : '请稍后重试。',
      });
    } finally {
      setIsCreatingGroup(false);
    }
  }, [guardFeature, loadHome, repositories, selectedGroupId, setSelectedGroupId, user]);

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
    const currentMemberId = resolveDefaultTrainingMemberId(members, user?.id);
    const participantMemberIds =
      nextScope === 'solo_local' && currentMemberId
        ? [currentMemberId]
        : members.map((member) => member.id);
    const resumeInput: CreateSessionFromTodayPlanInput = {
      date: getLocalDateString(),
      groupId: group.id,
      phaseId: resolvedPlan.phase.id,
      planExerciseIds: resolvedPlan.exercises.map((exercise) => exercise.id),
      planDayId: resolvedPlan.day.id,
      planId: resolvedPlan.plan.id,
      participantMemberIds,
      title: resolvedPlan.day.title,
      trainingMode: nextScope,
      week: resolvedPlan.day.week,
      weekday: resolvedPlan.day.weekday,
    };

    try {
      const openSessions = await repositories.workoutRepository.listOpenSessionsForDate({
        date: resumeInput.date,
        groupId: resumeInput.groupId,
      });
      const matchingSession = openSessions.find((session) => isSameWorkoutSelection(session, resumeInput));
      if (matchingSession) {
        router.push({ pathname: '/workout/[sessionId]', params: { sessionId: matchingSession.id } });
        return;
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : '读取未完成训练失败。');
      return;
    }

    setRecordScope(nextScope);
    setSelectedParticipantIds(participantMemberIds);
    setScopeSheetVisible(true);
  }, [group, guardFeature, members, repositories, resolveSelectedWorkoutPlan, user?.id]);

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
          planCycleId: session.planCycleId,
          planDayId: session.planDayId,
          phaseId: session.phaseId,
          planId: session.planId,
          recordedByUserId: session.recordedByUserId,
          sourceDeviceId: session.sourceDeviceId,
          status: session.status,
          title: session.title,
          trainingMode: session.trainingMode,
          week: session.week,
          weekday: session.weekday,
        },
        status: 'pending_create',
        updatedAt: session.updatedAt,
      }).catch(() => undefined);
      const detail = await repositories.workoutRepository.getSessionDetail(session.id);
      void Promise.all(
        detail.exercises.map((record) =>
          enqueueSyncCandidate({
            entityType: 'workoutExerciseRecords',
            localId: record.id,
            operation: 'create',
            payload: {
              exerciseId: record.exerciseId,
              groupId: session.groupId,
              notes: record.notes,
              orderIndex: record.orderIndex,
              parentServerId: session.id,
              planCycleId: record.planCycleId,
              planDayId: record.planDayId,
              planExerciseId: record.planExerciseId,
              plannedPercent1RM: record.plannedPercent1RM,
              plannedRepMax: record.plannedRepMax,
              plannedRepMin: record.plannedRepMin,
              plannedReps: record.plannedReps,
              plannedRestSeconds: record.plannedRestSeconds,
              plannedSets: record.plannedSets,
              priority: record.priority,
              replacedFromExerciseId: record.replacedFromExerciseId,
              sessionId: record.sessionId,
            },
            status: 'pending_create',
            updatedAt: session.updatedAt,
          }),
        ),
      ).catch(() => undefined);
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

    const currentMemberId = resolveDefaultTrainingMemberId(members, user?.id);
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
        planDayId: resolvedPlan.day.id,
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
    user?.id,
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
        const currentMemberId = resolveDefaultTrainingMemberId(members, user?.id);
        setSelectedParticipantIds(currentMemberId ? [currentMemberId] : []);
        return;
      }

      setSelectedParticipantIds((current) => {
        const validCurrent = current.filter((memberId) => members.some((member) => member.id === memberId));
        return validCurrent.length > 0 ? validCurrent : members.map((member) => member.id);
      });
    },
    [members, user?.id],
  );

  const currentMember = resolveDefaultTrainingMember(members, user?.id);
  const currentProfile = currentMember ? (profiles[currentMember.id] ?? null) : null;
  const planExercises = useMemo(() => todayPlan?.exercises ?? [], [todayPlan]);
  const focusExercises = useMemo(
    () => getFocusExercises(planExercises, exerciseMap),
    [exerciseMap, planExercises],
  );
  const mainFocus = focusExercises[0]?.exercise?.name ?? todayPlan?.day?.focus ?? null;
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
  const phaseLabel = formatPhaseLabel(todayPlan?.phase ?? null, group?.currentPhaseType);
  const selectedPlanDay = todayPlan?.day ?? null;
  const dayLabel = selectedPlanDay
    ? `第 ${selectedPlanDay.week} 周 · ${formatDayChoiceTitle(selectedPlanDay)}`
    : `第 ${selectedWeekValue} 周`;
  const planSubtitle = selectedPlanDay
    ? `${dayLabel} · ${selectedPlanDay.focus || phaseLabel}`
    : `${dayLabel} · ${phaseLabel}`;
  const planWeekOptions = getPlanWeekOptions(planDays, selectedWeekValue);
  const displayName =
    accountProfile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    currentMember?.displayName ||
    '练刻用户';
  const avatarDisplay = getAvatarDisplay({
    accountProfile,
    fallbackLocalUri: currentProfile?.avatarLocalUri,
    fallbackThumbUrl: currentProfile?.avatarThumbUrl,
    fallbackUrl: currentProfile?.avatarUrl ?? currentMember?.avatarUrl,
    user,
  });
  const phoneMasked = accountProfile?.phoneMasked ?? maskPhone(user?.phone);
  const liftmarkId = accountProfile?.liftmarkId ?? user?.liftmarkId;
  const membershipLabel = getMembershipLabel(membershipTier);
  const syncLabel = getSyncLabel(authStatus);
  const estimatedVolume = estimatePlanVolume(planExercises, exerciseMap, currentProfile);
  const estimatedMinutes = estimateWorkoutMinutes(planExercises);
  const focusItems: TodayFocusItem[] = focusExercises.map(({ exercise, planExercise }) => ({
    id: planExercise.id,
    lastPerformance: lastPerformanceByExerciseId[planExercise.exerciseId] ?? '暂无上次记录',
    name: exercise?.name ?? '未知动作',
    prescription: formatPrescription(planExercise),
    priority: planExercise.priority,
  }));
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
  const homeHeaderCopy = buildHomeHeaderCopy({
    currentGroupName: group?.name,
    memberCount: members.length,
    syncLabel,
  });

  // 将首页数据收敛为明确状态枚举，避免「计划未就绪」吞掉 completed/archived/abandoned 等情况。
  const homeStatus: HomeStatus = resolveHomeStatus({
    authStatus,
    groupsCount: groups.length,
    membersCount: members.length,
    rawActivePlan,
    activePlan,
    todayPlanExists: Boolean(todayPlan),
    isRestState,
    hasError: Boolean(error),
  });

  // 计划状态相关文案，对应 homeStatus 中的 planCompleted/planArchived/planAbandoned/planNotReady。
  const planStatusCopy: Record<
    'planCompleted' | 'planArchived' | 'planAbandoned' | 'planNotReady',
    { title: string; description: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    planCompleted: {
      title: '当前计划已完成',
      description: '可前往计划页归档当前计划，或开启新周期继续训练。',
      icon: 'ribbon-outline',
    },
    planArchived: {
      title: '当前计划已归档',
      description: '归档计划不能作为今日训练，请创建或导入新计划。',
      icon: 'archive-outline',
    },
    planAbandoned: {
      title: '当前计划已放弃',
      description: '该计划已标记为放弃，请创建或导入新计划。',
      icon: 'trash-outline',
    },
    planNotReady: {
      title: '今日训练内容暂未解析成功',
      description: '已尝试自动修复计划结构。若仍失败，可能是计划没有训练日或阶段信息缺失。可重新加载，或前往计划页检查计划内容。',
      icon: 'refresh-outline',
    },
  };

  const syncAccountProfileAvatarToMembers = useCallback(
    async (profile: AccountProfileCache) => {
      if (!user) return;
      const syncResult = await syncAccountAvatarToLocalMemberProfiles({
        avatarLocalUri: profile.avatarLocalUri,
        avatarThumbUrl: profile.avatarThumbUrl,
        avatarUpdatedAt: profile.avatarUpdatedAt,
        avatarUrl: profile.avatarUrl,
        fallbackMemberId: currentMember?.id,
        userId: user.id,
      });
      if (Object.keys(syncResult.profilesByMemberId).length > 0) {
        setProfiles((current) => ({ ...current, ...syncResult.profilesByMemberId }));
      }
    },
    [currentMember?.id, user],
  );

  const saveAccountProfile = useCallback(
    async (input: AccountProfileUpdate) => {
      if (!user) {
        throw new Error('请先登录后再修改资料。');
      }
      const nextDisplayName = input.displayName.trim();
      const nextUser = { ...user, displayName: nextDisplayName };
      const nextProfile = await updateAccountProfileDetails({
        age: input.age,
        displayName: nextDisplayName,
        gender: input.gender,
        user: nextUser,
      });
      await updateLocalUser({ displayName: nextDisplayName });
      const { updatedMembers } = await updateDisplayNameAcrossLocalProfiles({
        displayName: nextDisplayName,
        fallbackGroupId: currentMember?.groupId,
        fallbackMemberId: currentMember?.id,
        userId: user.id,
      });
      if (updatedMembers.length > 0) {
        setMembers((current) =>
          current.map((member) => updatedMembers.find((updated) => updated.id === member.id) ?? member),
        );
      }
      setAccountProfile(nextProfile);
    },
    [currentMember?.groupId, currentMember?.id, updateLocalUser, user],
  );

  const pickAccountAvatar = useCallback(
    async (source: AvatarPickSource) => {
      if (!user) {
        throw new Error('请先登录后再修改头像。');
      }
      const result = await updateAccountAvatarFromPicker(user, source);
      if (!result.ok) {
        throw new Error(result.message);
      }
      setAccountProfile(result.profile);
      await syncAccountProfileAvatarToMembers(result.profile);
      if (result.message) {
        setNotice({ title: '头像已更新', message: result.message });
      }
    },
    [syncAccountProfileAvatarToMembers, user],
  );

  const removeAccountAvatar = useCallback(async () => {
    if (!user) {
      throw new Error('请先登录后再修改头像。');
    }
    const nextProfile = await deleteAccountAvatar(user);
    setAccountProfile(nextProfile);
    await syncAccountProfileAvatarToMembers(nextProfile);
  }, [syncAccountProfileAvatarToMembers, user]);

  const navigateFromAccountMenu = useCallback((next: () => void) => {
    setAccountMenuVisible(false);
    next();
  }, []);
  const confirmLogout = useCallback(() => {
    setAccountMenuVisible(false);
    Alert.alert('确认退出登录？', '退出后将无法使用账号相关功能，但本机训练记录不会被删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/account/login' as never));
        },
      },
    ]);
  }, [logout]);

  return (
    <Screen contentStyle={styles.screenContent}>
      {isLoading && !group ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? (
        <EmptyState title="首页暂时无法加载" description={error} />
      ) : null}

      {!error ? (
        <>
          <HomeHeader
            avatarLocalUri={avatarDisplay.avatarLocalUri}
            avatarThumbUrl={avatarDisplay.avatarThumbUrl}
            avatarUrl={avatarDisplay.avatarUrl}
            displayName={displayName}
            onAvatarPress={() => setAccountMenuVisible(true)}
            subtitle={homeHeaderCopy.subtitle}
            title={homeHeaderCopy.title}
            titlePool={homeHeaderTitlePool}
          />

          {authStatus === 'offline_authenticated' ? (
            <View style={styles.offlineBanner}>
              <Ionicons color={colors.textStrong} name="phone-portrait-outline" size={18} />
              <AppText variant="bodySmall" weight="800">
                当前使用训练记录
              </AppText>
            </View>
          ) : null}

          {!error && groups.length > 0 ? (
            <View style={styles.quickActionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push('/profile/body-metrics' as never)}
                style={({ pressed }) => [styles.quickActionCard, pressed && styles.pressed]}
              >
                <View style={styles.quickActionIcon}>
                  <Ionicons color={colors.primary} name="scale-outline" size={20} />
                </View>
                <View style={styles.quickActionText}>
                  <AppText variant="bodySmall" weight="900">
                    记录体重
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    {latestWeightLabel ?? '点击快速记录今日体重'}
                  </AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
              </Pressable>
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

          {!error && groups.length === 0 ? (
            <HomeEmptyState
              actionLabel={isCreatingGroup ? '正在创建...' : '创建小组'}
              description="先建立一个训练小组，再添加计划和成员。"
              icon="people-outline"
              onActionPress={() => {
                if (!isCreatingGroup) void createInitialTrainingGroup();
              }}
              title="暂无训练小组"
            />
          ) : null}

          {!error && groups.length > 0 && !activePlan ? (
            homeStatus === 'planCompleted' ||
            homeStatus === 'planArchived' ||
            homeStatus === 'planAbandoned' ? (
              <HomeEmptyState
                actions={[
                  { label: '查看计划', onPress: () => router.push('/(tabs)/plan') },
                  {
                    label: '创建新计划',
                    onPress: () => {
                      if (guardFeature('create_plan')) router.push('/plan/create' as never);
                    },
                  },
                ]}
                description={planStatusCopy[homeStatus].description}
                icon={planStatusCopy[homeStatus].icon}
                title={planStatusCopy[homeStatus].title}
              />
            ) : (
              <HomeEmptyState
                actions={[
                  ...(recentVisibleSessionCount > 0
                    ? [
                        {
                          label: '查看历史',
                          onPress: () => router.push('/(tabs)/history'),
                        },
                      ]
                    : []),
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
                description={
                  recentVisibleSessionCount > 0
                    ? `已找到 ${recentVisibleSessionCount} 条历史训练。创建或导入计划后，可继续安排今日训练。`
                    : '创建或导入一个计划，开始你的训练之旅'
                }
                icon="clipboard-outline"
                title={recentVisibleSessionCount > 0 ? '暂无当前计划' : '暂无训练计划'}
              />
            )
          ) : null}

          {!error && groups.length > 0 && activePlan && members.length === 0 ? (
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
              <PlanProgressCard
                onPress={() => setDaySheetVisible(true)}
                planName={activePlan.name}
                progressLabel={weeklyProgressLabel}
                progressPercent={weeklyProgressPercent}
                subtitle={planSubtitle}
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

              {!isRestState && !todayPlan ? (
                <HomeEmptyState
                  actions={[
                    { label: '重新加载', onPress: () => void loadHome() },
                    { label: '查看计划', onPress: () => router.push('/(tabs)/plan') },
                  ]}
                  compact
                  description={planStatusCopy.planNotReady.description}
                  icon={planStatusCopy.planNotReady.icon}
                  title={planStatusCopy.planNotReady.title}
                />
              ) : null}

              {!isRestState && todayPlan ? (
                <TodayTrainingHero
                  estimatedMinutes={estimatedMinutes}
                  imageSource={liftmarkImages.trainingHero}
                  metrics={[
                    { label: '本次训练', value: `${planExercises.length} 个动作` },
                    { label: '预计容量', value: estimatedVolume },
                    { label: '历史最佳', value: '暂无历史' },
                  ]}
                  subtitle={mainFocus ?? '暂无动作'}
                  title={selectedPlanDay?.title ?? todayPlan?.day?.focus ?? '今日训练'}
                />
              ) : null}

              {!isRestState && todayPlan ? (
                <CurrentGroupStartCard
                  buttonLabel={members.length > 0 ? '选择成员并开始' : '添加成员并开始'}
                  currentMemberId={currentMember?.id}
                  disabled={!canStartWorkout || isStarting}
                  groupName={group?.name ?? '默认训练小组'}
                  isStarting={isStarting}
                  members={members}
                  onStartPress={() => void openWorkoutScope()}
                  profiles={profiles}
                />
              ) : null}

              {!isRestState && todayPlan ? (
                <TodayFocusList
                  items={focusItems}
                  onItemPress={() => router.push('/(tabs)/plan')}
                  onOpenAll={() => router.push('/(tabs)/plan')}
                />
              ) : null}

            </>
          ) : null}
        </>
      ) : null}

      {isAccountMenuVisible ? (
        <AccountPanel
          accountProfile={accountProfile}
          activePlanName={activePlan?.name}
          avatarLocalUri={avatarDisplay.avatarLocalUri}
          avatarThumbUrl={avatarDisplay.avatarThumbUrl}
          avatarUrl={avatarDisplay.avatarUrl}
          currentGroup={group}
          currentMemberId={currentMember?.id}
          displayName={displayName}
          groups={groups}
          liftmarkId={liftmarkId}
          membershipLabel={membershipLabel}
          members={members}
          onAboutPress={() => navigateFromAccountMenu(() => router.push('/about' as never))}
          onAvatarPick={pickAccountAvatar}
          onAvatarRemove={removeAccountAvatar}
          onClose={() => setAccountMenuVisible(false)}
          onCreateGroupPress={() => navigateFromAccountMenu(() => router.push('/profile/groups' as never))}
          onGroupSettingsPress={() => navigateFromAccountMenu(() => router.push('/profile/groups' as never))}
          onLogoutPress={confirmLogout}
          onManageMembersPress={() => navigateFromAccountMenu(() => router.push('/groups/manage' as never))}
          onPrivacyPress={() => navigateFromAccountMenu(() => router.push('/legal/privacy' as never))}
          onSaveProfile={saveAccountProfile}
          onSelectGroup={setSelectedGroupId}
          onTermsPress={() => navigateFromAccountMenu(() => router.push('/legal/terms' as never))}
          phoneMasked={phoneMasked}
          syncLabel={syncLabel}
          visible
        />
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

      {announcement ? (
        <AnnouncementModal
          announcement={announcement}
          onClose={() => setAnnouncementVisible(false)}
          visible={announcementVisible}
        />
      ) : null}
    </Screen>
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
  quickActionRow: {
    gap: spacing.sm,
  },
  quickActionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...shadows.card,
  },
  quickActionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  quickActionText: {
    flex: 1,
    gap: 2,
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
  recoverySelectorAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  recoverySelectorBar: {
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
  recoverySelectorText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recoveryList: {
    gap: spacing.sm,
  },
  recoveryText: {
    flex: 1,
    gap: 2,
  },
  screenContent: {
    gap: spacing.md,
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
  summaryFilterChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.68)',
    borderColor: 'rgba(255, 255, 255, 0.24)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xxs,
    minHeight: 32,
    paddingHorizontal: spacing.sm,
  },
  summaryTitle: {
    color: colors.surface,
  },
  summaryTopRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
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
