import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, MiniBarLineChart, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { AuthGateSheets } from '@/components/auth';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import { DEFAULT_CYCLE_WEEK_COUNT } from '@/domain/plan/defaultCycle';
import type { PlanCycleOverview, PlanDay, PlanTemplate } from '@/domain/plan/plan.types';
import { getPlanCycleStatusLabel, isPlanCycleReadyToComplete } from '@/domain/plan/planCycle.service';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import {
  describeSchemeGoal,
  describeSchemeLevel,
  listSystemTrainingSchemes,
  type SystemTrainingScheme,
} from '@/domain/plan/systemSchemes';
import { pickImportedPlanDocument } from '@/services/planDocumentService';
import { createCurrentPlanFile, PlanFileError, serializePlanFile } from '@/services/planFileService';
import {
  activateTrainingPlanForGroup,
  ensureTrainingGroupMainline,
} from '@/services/trainingMainlineService';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type PlanNotice = {
  message: string;
  title: string;
};

type SharePrompt = {
  content: string;
  message: string;
  title: string;
};

type ActivationPrompt = {
  message: string;
  plan: PlanTemplate;
  title: string;
};

type DaySummary = {
  day: PlanDay;
  exerciseCount: number;
  exerciseNames: string[];
};

type PlanDashboardStats = {
  recentSessionsCompletedSets: number[];
  recentSessionsVolume: number[];
  recentSessionsLabels: string[];
  recentSessionDate?: string;
  weeklyCompletedSets: number;
  weeklySessionCount: number;
  weeklyVolume: number;
};

const RECENT_SESSION_CHART_LIMIT = 6;

const emptyStats: PlanDashboardStats = {
  recentSessionsCompletedSets: [],
  recentSessionsVolume: [],
  recentSessionsLabels: [],
  weeklyCompletedSets: 0,
  weeklySessionCount: 0,
  weeklyVolume: 0,
};

function describePlanSource(source: PlanTemplate['source']) {
  const labels: Record<PlanTemplate['source'], string> = {
    system: '系统方案',
    user: '手动创建',
    system_copy: '系统方案副本',
    blank_created: '空白创建',
    imported: '导入计划',
    duplicated: '复制计划',
  };
  return labels[source];
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${`${date.getDate()}`.padStart(2, '0')}`;
}

function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function summarizeWorkoutDetails(details: WorkoutSessionDetail[]): Pick<PlanDashboardStats, 'weeklyCompletedSets' | 'weeklyVolume'> {
  const completedSets = details.flatMap((detail) => detail.sets).filter((set) => set.completed);
  return {
    weeklyCompletedSets: completedSets.length,
    weeklyVolume: completedSets.reduce(
      (sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
      0,
    ),
  };
}

function isTrainablePlan(plan: PlanTemplate | null): plan is PlanTemplate {
  if (!plan) return false;
  if (plan.source === 'system' || plan.visibility === 'system') return true;
  return !plan.status || plan.status === 'active';
}

function buildRecentSessions(details: WorkoutSessionDetail[]): Pick<
  PlanDashboardStats,
  'recentSessionsCompletedSets' | 'recentSessionsVolume' | 'recentSessionsLabels' | 'recentSessionDate'
> {
  const completedDetails = details
    .filter((detail) => detail.sets.some((set) => set.completed))
    .sort((left, right) => left.session.date.localeCompare(right.session.date));

  if (completedDetails.length === 0) {
    return {
      recentSessionsCompletedSets: [],
      recentSessionsLabels: [],
      recentSessionsVolume: [],
    };
  }

  const recent = completedDetails.slice(-RECENT_SESSION_CHART_LIMIT);
  return {
    recentSessionDate: recent[recent.length - 1]?.session.date,
    recentSessionsCompletedSets: recent.map((detail) => detail.sets.filter((set) => set.completed).length),
    recentSessionsLabels: recent.map((detail) => formatMonthDay(parseLocalDate(detail.session.date))),
    recentSessionsVolume: recent.map((detail) =>
      detail.sets
        .filter((set) => set.completed)
        .reduce(
          (sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
          0,
        ),
    ),
  };
}

export default function PlanRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const systemSchemes = useMemo(() => listSystemTrainingSchemes(), []);
  const { guardFeature, sheets } = useAuthGate();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const currentUserDisplayName = useAuthStore((state) => state.user?.displayName);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [stats, setStats] = useState<PlanDashboardStats>(emptyStats);
  const [cycleOverview, setCycleOverview] = useState<PlanCycleOverview | null>(null);
  const [dismissedCycleId, setDismissedCycleId] = useState<string | null>(null);
  const [selectedScheme, setSelectedScheme] = useState<SystemTrainingScheme | null>(null);
  const [previewScheme, setPreviewScheme] = useState<SystemTrainingScheme | null>(null);
  const [activationPrompt, setActivationPrompt] = useState<ActivationPrompt | null>(null);
  const [sharePrompt, setSharePrompt] = useState<SharePrompt | null>(null);
  const [notice, setNotice] = useState<PlanNotice | null>(null);
  const [isManageVisible, setManageVisible] = useState(false);
  const [isActionsVisible, setActionsVisible] = useState(false);
  const [isSchemeLibraryVisible, setSchemeLibraryVisible] = useState(false);
  const [moreMenuInlineOpen, setMoreMenuInlineOpen] = useState(false);
  const [deletePromptPlan, setDeletePromptPlan] = useState<PlanTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [isSettingActive, setIsSettingActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emptyPlanIds, setEmptyPlanIds] = useState<Set<string>>(new Set());

  const availableSchemes = useMemo(() => systemSchemes.filter((scheme) => scheme.isAvailable), [systemSchemes]);
  const upcomingSchemes = useMemo(() => systemSchemes.filter((scheme) => !scheme.isAvailable), [systemSchemes]);

  const loadPlans = useCallback(async () => {
    // 已有数据时不强制 loading（避免切 Tab 白屏），只在无数据时显示 loading
    const hasData = Boolean(group && activePlan);
    if (!hasData) {
      setIsLoading(true);
    }
    setError(null);

    try {
      await initializeLocalDatabase();
      const [{ group: nextGroup }, nextUserPlans] = await Promise.all([
        resolveSelectedGroup(repositories.groupRepository, selectedGroupId),
        repositories.planRepository.listUserPlans(),
      ]);
      // 检测空计划（没有 plan_days 的计划），供批量清理
      const nextEmptyPlanIds = new Set<string>();
      await Promise.all(
        nextUserPlans.map(async (plan) => {
          const days = await repositories.planRepository.listPlanDays(plan.id);
          if (days.length === 0) {
            nextEmptyPlanIds.add(plan.id);
          }
        }),
      );
      setEmptyPlanIds(nextEmptyPlanIds);
      if (!nextGroup) {
        setGroup(null);
        setActivePlan(null);
        setUserPlans(nextUserPlans);
        setDaySummaries([]);
        setStats(emptyStats);
        setCycleOverview(null);
        return;
      }
      if (nextGroup.id !== selectedGroupId) {
        setSelectedGroupId(nextGroup.id);
      }

      const loadedActivePlan = await repositories.planRepository.getPlanById(nextGroup.activePlanId);
      const nextActivePlan = isTrainablePlan(loadedActivePlan) ? loadedActivePlan : null;

      let nextDaySummaries: DaySummary[] = [];
      let nextStats = emptyStats;
      let nextCycleOverview: PlanCycleOverview | null = null;

      if (nextActivePlan) {
        const days = await repositories.planRepository.listPlanDays(nextActivePlan.id);
        const scopedDays = days.filter((day) => day.week === nextGroup.currentWeek);
        const dashboardDays = (scopedDays.length > 0 ? scopedDays : days)
          .slice()
          .sort((left, right) => left.weekday - right.weekday || left.title.localeCompare(right.title))
          .slice(0, nextActivePlan.frequencyPerWeek || 7);
        const planExercisesByDay = await Promise.all(
          dashboardDays.map((day) => repositories.planRepository.listPlanExercises(day.id)),
        );
        const exerciseIds = Array.from(
          new Set(planExercisesByDay.flatMap((items) => items.map((exercise) => exercise.exerciseId))),
        );
        const exerciseMap = Object.fromEntries(
          (await repositories.exerciseRepository.listExercisesByIds(exerciseIds)).map((exercise) => [exercise.id, exercise]),
        ) as Record<string, Exercise>;
        nextDaySummaries = dashboardDays.map((day, index) => ({
          day,
          exerciseCount: planExercisesByDay[index]?.length ?? 0,
          exerciseNames: (planExercisesByDay[index] ?? [])
            .slice(0, 2)
            .map((exercise) => exerciseMap[exercise.exerciseId]?.name ?? '未知动作'),
        }));

        const today = getLocalDateString();
        const weekStart = getLocalDateString(addDays(new Date(), -6));
        const sessions = (
          await repositories.workoutRepository.listSessions({
            groupId: nextGroup.id,
            fromDate: getLocalDateString(addDays(new Date(), -89)),
            toDate: today,
            limit: 120,
          })
        ).filter((session) => session.planId === nextActivePlan.id);
        const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
        const weeklyDetails = details.filter((detail) => detail.session.date >= weekStart && detail.session.date <= today);
        const weeklySummary = summarizeWorkoutDetails(weeklyDetails);
        const recentStats = buildRecentSessions(details);

        nextStats = {
          ...weeklySummary,
          ...recentStats,
          weeklySessionCount: weeklyDetails.filter((detail) => detail.sets.some((set) => set.completed)).length,
        };
        const cycles = await repositories.planRepository.listPlanCycles({
          groupId: nextGroup.id,
          planId: nextActivePlan.id,
        });
        const visibleCycle = cycles.find((cycle) => cycle.status === 'active') ?? cycles[0];
        if (visibleCycle) {
          nextCycleOverview = await repositories.planRepository.getPlanCycleOverview(visibleCycle.id);
        }
      }

      setGroup(nextGroup);
      setActivePlan(nextActivePlan);
      setUserPlans(nextUserPlans);
      setDaySummaries(nextDaySummaries);
      setStats(nextStats);
      setCycleOverview(nextCycleOverview);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId, group, activePlan]);

  useFocusEffect(
    useCallback(() => {
      void loadPlans();
    }, [loadPlans]),
  );

  const setCurrentPlan = useCallback(
    async (plan: PlanTemplate, showNotice = true) => {
      if (!group) {
        if (showNotice) {
          setNotice({
            title: '请先创建训练小组',
            message: '使用计划需要先有一个训练小组。请在下方创建小组后重试。',
          });
        }
        return;
      }

      if (!guardFeature('edit_plan')) {
        return;
      }

      setIsSettingActive(plan.id);
      try {
        const { group: updated } = await activateTrainingPlanForGroup(repositories, { group, plan });
        setGroup(updated);
        setActivePlan(plan);
        setManageVisible(false);
        await loadPlans();
        if (showNotice) {
          setNotice({
            title: '已设为当前计划',
            message: `训练页将读取“${plan.name}”。历史记录不会受影响。`,
          });
        }
      } catch (setError) {
        setNotice({
          title: '设置失败',
          message: setError instanceof Error ? setError.message : '设置当前计划失败。',
        });
      } finally {
        setIsSettingActive(null);
      }
    },
    [group, guardFeature, loadPlans, repositories],
  );

  // 为没有小组的账号（如新登录的测试号）创建默认训练小组
  const createDefaultGroup = useCallback(async () => {
    setIsWorking(true);
    try {
      const { group: created } = await ensureTrainingGroupMainline(repositories, {
        displayName: currentUserDisplayName,
        groupName: '我的训练小组',
        selectedGroupId,
        userId: currentUserId,
      });
      setSelectedGroupId(created.id);
      await loadPlans();
    } catch (createError) {
      setNotice({
        title: '创建小组失败',
        message: createError instanceof Error ? createError.message : '请稍后重试。',
      });
    } finally {
      setIsWorking(false);
    }
  }, [currentUserDisplayName, currentUserId, repositories, selectedGroupId, setSelectedGroupId, loadPlans]);

  const sharePlan = useCallback(
    async (plan: PlanTemplate) => {
      if (!guardFeature('share_plan')) {
        return;
      }

      setIsWorking(true);
      try {
        const planFile = await createCurrentPlanFile(repositories, plan.id);
        const json = serializePlanFile(planFile);
        
        // 尝试直接分享
        const shareAvailable = await Sharing.isAvailableAsync();
        if (shareAvailable) {
          const fileName = `${plan.name.replace(/\s+/g, '_')}_${getLocalDateString()}.liftmark.json`;
          const fileUri = `${FileSystem.documentDirectory}${fileName}`;
          await FileSystem.writeAsStringAsync(fileUri, json);
          await Sharing.shareAsync(fileUri, {
            mimeType: 'application/json',
            dialogTitle: `分享 "${plan.name}"`,
          });
          // 清理临时文件
          await FileSystem.deleteAsync(fileUri);
        } else {
          // 降级方案：复制到剪贴板
          setSharePrompt({
            content: json,
            title: '计划内容已生成',
            message: `当前版本暂未保存到文件。你可以复制 .liftmark.json 内容分享给好友。大小约 ${Math.ceil(
              json.length / 1024,
            )} KB。`,
          });
        }
      } catch (shareError) {
        setNotice({
          title: '分享失败',
          message: shareError instanceof Error ? shareError.message : '分享计划失败。',
        });
      } finally {
        setIsWorking(false);
      }
    },
    [guardFeature, repositories],
  );

  const importPlan = useCallback(async () => {
    if (!guardFeature('import_plan')) {
      return;
    }
    if (!group) {
      setNotice({
        title: '请先创建训练小组',
        message: '导入计划需要先有一个训练小组，用来保存当前计划和训练记录。',
      });
      return;
    }

    setIsWorking(true);
    try {
      const { group: targetGroup } = await ensureTrainingGroupMainline(repositories, {
        displayName: currentUserDisplayName,
        groupName: '我的训练小组',
        selectedGroupId,
        userId: currentUserId,
      });
      setSelectedGroupId(targetGroup.id);

      const picked = await pickImportedPlanDocument();
      if (!picked) {
        return;
      }

      const importedPlan = await repositories.planRepository.importUserPlan({
        alternatives: picked.draft.alternatives,
        days: picked.draft.plan.days,
        exercises: picked.draft.exercises,
        phases: picked.draft.plan.phases,
        planExercises: picked.draft.plan.exercises,
        template: picked.draft.plan.template,
      });
      const { group: updatedGroup } = await activateTrainingPlanForGroup(repositories, {
        group: targetGroup,
        plan: importedPlan,
      });
      setGroup(updatedGroup);
      setActivePlan(importedPlan);
      await loadPlans();

      setNotice({
        title: '计划已导入',
        message: `“${importedPlan.name}”已设为当前训练计划。`,
      });
    } catch (importError) {
      console.warn('[PLAN] import failed', {
        groupId: group?.id ?? null,
        message: importError instanceof Error ? importError.message : String(importError),
        planId: activePlan?.id ?? null,
      });
      if (importError instanceof PlanFileError) {
        setNotice({
          title: '计划文件格式不兼容',
          message: importError.message,
        });
        return;
      }

      setNotice({
        title: '导入失败',
        message: importError instanceof Error ? importError.message : '计划导入失败。',
      });
    } finally {
      setIsWorking(false);
    }
  }, [
    activePlan?.id,
    currentUserDisplayName,
    currentUserId,
    group,
    guardFeature,
    loadPlans,
    repositories,
    selectedGroupId,
    setSelectedGroupId,
  ]);

  const openUseScheme = useCallback((scheme: SystemTrainingScheme) => {
    if (!scheme.isAvailable || !scheme.templatePlanId) {
      setNotice({
        title: '方案暂未开放',
        message: '该系统方案还在补齐动作和进阶规则，暂时不能复制为我的计划。',
      });
      return;
    }

    if (!guardFeature('create_plan', { userPlanCount: userPlans.length })) {
      return;
    }

    setSchemeLibraryVisible(false);
    setSelectedScheme(scheme);
  }, [guardFeature, userPlans.length]);

  const confirmUseSelectedScheme = useCallback(async () => {
    if (!selectedScheme) {
      return;
    }

    if (!guardFeature('create_plan', { userPlanCount: userPlans.length })) {
      return;
    }

    setIsWorking(true);
    try {
      const { group: targetGroup } = await ensureTrainingGroupMainline(repositories, {
        displayName: currentUserDisplayName,
        groupName: '我的训练小组',
        selectedGroupId,
        userId: currentUserId,
      });
      setSelectedGroupId(targetGroup.id);

      const plan = await repositories.planRepository.copySystemSchemeToUserPlan({
        scheme: selectedScheme,
        name: selectedScheme.title.replace('方案', '计划'),
      });
      const { group: updatedGroup } = await activateTrainingPlanForGroup(repositories, {
        group: targetGroup,
        plan,
      });
      setGroup(updatedGroup);
      setActivePlan(plan);
      await loadPlans();
      setSelectedScheme(null);
      setNotice({
        title: '已复制到我的计划',
        message: `“${plan.name}”已设为当前训练计划。`,
      });
    } catch (copyError) {
      setNotice({
        title: '复制失败',
        message: copyError instanceof Error ? copyError.message : '使用系统方案失败。',
      });
    } finally {
      setIsWorking(false);
    }
  }, [
    currentUserDisplayName,
    currentUserId,
    guardFeature,
    loadPlans,
    repositories,
    selectedGroupId,
    selectedScheme,
    setSelectedGroupId,
    userPlans.length,
  ]);

  const deletePlan = useCallback(async () => {
    if (!deletePromptPlan) {
      return;
    }

    if (!guardFeature('edit_plan')) {
      return;
    }

    setIsWorking(true);
    try {
      await repositories.planRepository.deleteUserPlan(deletePromptPlan.id);
      setDeletePromptPlan(null);
      await loadPlans();
      setNotice({
        title: '计划已删除',
        message: '只删除了我的计划数据，历史训练记录没有被删除。',
      });
    } catch (deleteError) {
      setNotice({
        title: '删除失败',
        message: deleteError instanceof Error ? deleteError.message : '删除计划失败。',
      });
    } finally {
      setIsWorking(false);
    }
  }, [deletePromptPlan, guardFeature, loadPlans, repositories]);

  const copyShareContent = useCallback(async () => {
    if (!sharePrompt) {
      return;
    }

    await Clipboard.setStringAsync(sharePrompt.content);
    setSharePrompt(null);
    setNotice({
      title: '已复制内容',
      message: '计划 JSON 内容已复制到剪贴板，可以粘贴分享给好友。',
    });
  }, [sharePrompt]);

  const activePlanWeeks = activePlan?.durationWeeks ?? DEFAULT_CYCLE_WEEK_COUNT;
  const activePlanProgress = Math.min(100, Math.round(((group?.currentWeek ?? 1) / activePlanWeeks) * 100));
  const cycleNeedsAttention = Boolean(
    cycleOverview && (
      cycleOverview.cycle.status === 'completed'
      || isPlanCycleReadyToComplete(cycleOverview.cycle, group?.currentWeek ?? 1, cycleOverview.completedWorkoutCount)
    ),
  );
  
  // 按最近使用排序（当前计划排第一）
  const sortedUserPlans = useMemo(() => {
    return [...userPlans].sort((a, b) => {
      if (a.id === group?.activePlanId) return -1;
      if (b.id === group?.activePlanId) return 1;
      return 0;
    });
  }, [userPlans, group?.activePlanId]);

  const cleanupEmptyPlans = useCallback(async () => {
    if (!guardFeature('edit_plan')) {
      return;
    }
    // 只清理非活跃的空计划（活跃计划即使为空也保留，避免误删当前训练目标）
    const toDelete = sortedUserPlans.filter(
      (plan) => emptyPlanIds.has(plan.id) && plan.id !== group?.activePlanId,
    );
    if (toDelete.length === 0) {
      setNotice({ title: '没有空计划', message: '当前没有可清理的空计划。' });
      return;
    }

    setIsWorking(true);
    try {
      let successCount = 0;
      let failCount = 0;
      for (const plan of toDelete) {
        try {
          await repositories.planRepository.deleteUserPlan(plan.id);
          successCount += 1;
        } catch {
          failCount += 1;
        }
      }
      await loadPlans();
      setNotice({
        title: '清理完成',
        message: `已删除 ${successCount} 个空计划${failCount > 0 ? `，${failCount} 个删除失败` : ''}。`,
      });
    } catch (cleanupError) {
      setNotice({
        title: '清理失败',
        message: cleanupError instanceof Error ? cleanupError.message : '清理空计划失败。',
      });
    } finally {
      setIsWorking(false);
    }
  }, [emptyPlanIds, group?.activePlanId, guardFeature, loadPlans, repositories, sortedUserPlans]);

  return (
    <Screen>
      {error ? <EmptyState title="计划暂时无法加载" description={error} /> : null}

      {!error && group ? (
        <>
          <VisualHeroCard
            eyebrow="当前计划"
            icon="clipboard-outline"
            imageSource={liftmarkImages.planHero}
            minHeight={188}
            subtitle={`第 ${group.currentWeek}/${activePlanWeeks} 周 · ${describePlanSource(activePlan?.source ?? 'blank_created')}`}
            title={activePlan?.name ?? '还没有当前计划'}
            actionIcon="settings-outline"
            onActionPress={() => setManageVisible(true)}
          >
            <View style={styles.planMetaRow}>
              <Tag label={`${activePlan?.frequencyPerWeek ?? 0} 天/周`} tone="dark" />
              <Tag label={`${activePlanWeeks} 周周期`} tone="dark" />
              <Tag label={`${activePlanProgress}%`} tone="dark" />
            </View>
            <View style={styles.progressTrackDark}>
              <View style={[styles.progressFill, { width: `${activePlanProgress}%` }]} />
            </View>
          </VisualHeroCard>

          {cycleOverview ? (
            <AppCard style={styles.cycleCard}>
              <View style={styles.cycleHeader}>
                <View style={styles.cycleIcon}>
                  <Ionicons color={colors.primary} name="repeat-outline" size={22} />
                </View>
                <View style={styles.planRowText}>
                  <AppText variant="subtitle" weight="900">{cycleOverview.cycle.name}</AppText>
                  <AppText tone="muted" variant="caption">
                    {cycleOverview.cycle.startDate} — {cycleOverview.cycle.actualEndDate ?? cycleOverview.cycle.endDate ?? '进行中'}
                  </AppText>
                </View>
                <Tag
                  label={getPlanCycleStatusLabel(cycleOverview.cycle.status)}
                  tone={cycleOverview.cycle.status === 'archived' || cycleOverview.cycle.status === 'completed' ? 'success' : 'brand'}
                />
              </View>
              <View style={styles.cycleStats}>
                <StatTile label="计划训练" value={`${cycleOverview.plannedWorkoutCount} 次`} />
                <StatTile label="已完成" value={`${cycleOverview.completedWorkoutCount} 次`} />
                <StatTile label="完成率" value={`${Math.round(cycleOverview.completionRate * 100)}%`} />
                <StatTile label="总训练量" value={formatKg(cycleOverview.totalVolume)} />
              </View>
              <View style={styles.inlineActions}>
                <AppButton
                  onPress={() => router.push({ pathname: '/plan/cycle/[cycleId]', params: { cycleId: cycleOverview.cycle.id } } as never)}
                  style={styles.button}
                  variant="secondary"
                >
                  查看周期总结
                </AppButton>
              </View>
            </AppCard>
          ) : null}

          {cycleOverview && cycleNeedsAttention && dismissedCycleId !== cycleOverview.cycle.id ? (
            <AppCard style={styles.cycleNotice} tone="soft">
              <View style={styles.cycleNoticeHeader}>
                <Ionicons color={colors.success} name="checkmark-circle-outline" size={24} />
                <View style={styles.planRowText}>
                  <AppText variant="bodySmall" weight="900">当前计划周期已完成</AppText>
                  <AppText tone="muted" variant="caption">
                    查看最终统计后，可以结束并归档本周期；训练历史和报告不会被删除。
                  </AppText>
                </View>
              </View>
              <View style={styles.inlineActions}>
                <AppButton
                  onPress={() => router.push({ pathname: '/plan/cycle/[cycleId]', params: { cycleId: cycleOverview.cycle.id } } as never)}
                  style={styles.button}
                >
                  {cycleOverview.cycle.status === 'completed' ? '归档本周期' : '查看并结束周期'}
                </AppButton>
                <AppButton onPress={() => setDismissedCycleId(cycleOverview.cycle.id)} style={styles.button} variant="ghost">暂不处理</AppButton>
              </View>
            </AppCard>
          ) : null}

          <AppCard style={styles.dashboardCard}>
            <View style={styles.dashboardHeader}>
              <View>
                <AppText variant="subtitle">最近训练</AppText>
                <AppText tone="muted" variant="caption">
                  最近 {RECENT_SESSION_CHART_LIMIT} 次训练量与完成组数
                </AppText>
              </View>
              <Tag label={stats.recentSessionDate ? `最近 ${stats.recentSessionDate}` : '暂无训练'} tone={stats.recentSessionDate ? 'success' : 'neutral'} />
            </View>
            <View style={styles.statGrid}>
              <StatTile label="本周训练" value={`${stats.weeklySessionCount} 次`} />
              <StatTile label="本周组数" value={`${stats.weeklyCompletedSets} 组`} />
              <StatTile label="本周训练量" value={formatKg(stats.weeklyVolume)} wide />
            </View>
            <MiniBarLineChart
              chartHeight={120}
              barData={stats.recentSessionsVolume}
              lineData={stats.recentSessionsCompletedSets}
              labels={stats.recentSessionsLabels}
              barUnitLabel="kg"
              lineUnitLabel="组"
              showYAxis={false}
              emptyMessage="最近还没有当前计划的训练记录"
              barFormatValue={(value) => (value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`)}
              lineFormatValue={(value) => `${Math.round(value)}`}
            />
          </AppCard>

          <SectionHeader subtitle="按当前周展示，训练页会读取完整计划。" title="本周安排" />
          {daySummaries.length === 0 ? (
            <AppCard style={styles.emptyPlanCard} tone="soft">
              <AppText variant="bodySmall" weight="900">
                当前计划还没有训练日
              </AppText>
              <AppText tone="muted" variant="caption">
                可以创建或导入计划，也可以先复制系统方案。
              </AppText>
            </AppCard>
          ) : (
            <View style={styles.dayList}>
              {daySummaries.map((summary) => (
                <AppCard key={summary.day.id} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayBadge}>
                      <AppText tone="inverse" variant="caption" weight="900">
                        {summary.day.weekday}
                      </AppText>
                    </View>
                    <View style={styles.dayText}>
                      <AppText variant="bodySmall" weight="900">
                        {summary.day.title}
                      </AppText>
                      <AppText tone="muted" variant="caption">
                        {summary.day.focus} · {summary.exerciseCount} 个动作
                      </AppText>
                    </View>
                    <Tag label={`周 ${summary.day.week}`} tone="neutral" />
                  </View>
                  {summary.exerciseNames.length > 0 ? (
                    <View style={styles.tagRow}>
                      {summary.exerciseNames.map((name) => (
                        <Tag key={name} label={name} tone="neutral" />
                      ))}
                      {summary.exerciseCount > summary.exerciseNames.length ? (
                        <Tag label={`+${summary.exerciseCount - summary.exerciseNames.length}`} tone="accent" />
                      ) : null}
                    </View>
                  ) : null}
                </AppCard>
              ))}
            </View>
          )}

          {isWorking ? (
            <AppText tone="muted" variant="bodySmall">
              正在处理计划...
            </AppText>
          ) : null}
        </>
      ) : null}

      {isLoading && !group ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {!isLoading && !error && !group ? (
        <>
          <EmptyState
            title="还没有训练小组"
            description="创建一个训练小组后，就可以使用训练计划、记录训练数据了。"
            actionLabel="创建训练小组"
            onActionPress={() => void createDefaultGroup()}
          />
          <AppCard style={styles.noGroupCard} tone="soft">
            <AppText variant="bodySmall" weight="900">
              计划入口
            </AppText>
            <View style={styles.inlineActions}>
              <AppButton
                icon="barbell-outline"
                onPress={() =>
                  setNotice({
                    title: '请先创建训练小组',
                    message: '使用系统方案前需要先有一个训练小组。',
                  })
                }
                size="sm"
                variant="secondary"
              >
                使用默认方案
              </AppButton>
              <AppButton
                icon="download-outline"
                onPress={() => void importPlan()}
                size="sm"
                variant="secondary"
              >
                导入计划
              </AppButton>
            </View>
          </AppCard>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setActionsVisible(false)}
        subtitle="页面只展示关键计划状态，低频操作收在这里。"
        title="计划操作"
        visible={isActionsVisible}
      >
        <PlanActionRow
          icon="swap-horizontal-outline"
          label="切换当前计划"
          onPress={() => {
            setActionsVisible(false);
            setManageVisible(true);
          }}
        />
        <PlanActionRow
          disabled={!activePlan}
          icon="create-outline"
          label={activePlan?.source === 'system' ? '查看并复制当前计划' : '编辑当前计划'}
          onPress={() => {
            setActionsVisible(false);
            if (!activePlan) return;
            if (activePlan.source === 'system') {
              router.push({ pathname: '/plan/[planId]', params: { planId: activePlan.id } } as never);
            } else {
              router.push({ pathname: '/plan/edit/[planId]', params: { planId: activePlan.id } } as never);
            }
          }}
        />
        <PlanActionRow
          icon="library-outline"
          label="主流计划库"
          onPress={() => {
            setActionsVisible(false);
            setSchemeLibraryVisible(true);
          }}
        />
        <PlanActionRow
          icon="add-outline"
          label="创建空白计划"
          onPress={() => {
            setActionsVisible(false);
            if (guardFeature('create_plan', { userPlanCount: userPlans.length })) {
              router.push('/plan/create' as never);
            }
          }}
        />
        <PlanActionRow
          icon="download-outline"
          label="导入计划"
          onPress={() => {
            setActionsVisible(false);
            void importPlan();
          }}
        />
        <PlanActionRow
          disabled={!activePlan}
          icon="share-outline"
          label="分享当前计划"
          onPress={() => {
            setActionsVisible(false);
            if (activePlan) {
              void sharePlan(activePlan);
            }
          }}
        />
        <PlanActionRow
          icon="albums-outline"
          label="管理全部计划"
          onPress={() => {
            setActionsVisible(false);
            setManageVisible(true);
          }}
        />
      </AppModalSheet>

      <AppModalSheet
        contentStyle={styles.libraryContent}
        onClose={() => setSchemeLibraryVisible(false)}
        subtitle="系统方案只是模板，点击使用后才会复制为我的计划。"
        title="计划库"
        visible={isSchemeLibraryVisible}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {availableSchemes.map((scheme) => (
              <SchemeCard
                key={scheme.id}
                onPreview={() => setPreviewScheme(scheme)}
                onUse={() => openUseScheme(scheme)}
                scheme={scheme}
              />
            ))}
            {upcomingSchemes.length > 0 ? (
              <AppCard style={styles.upcomingCard} tone="soft">
                <View style={styles.planRow}>
                  <View style={styles.schemeIconMuted}>
                    <Ionicons color={colors.textMuted} name="layers-outline" size={20} />
                  </View>
                  <View style={styles.planRowText}>
                    <AppText variant="subtitle">更多方案开发中</AppText>
                    <AppText tone="muted" variant="caption">
                      {upcomingSchemes
                        .slice(0, 4)
                        .map((scheme) => scheme.title)
                        .join('、')}
                      {upcomingSchemes.length > 4 ? ` 等 ${upcomingSchemes.length} 个` : ''}
                    </AppText>
                  </View>
                  <Tag label="收起展示" tone="neutral" />
                </View>
              </AppCard>
            ) : null}
          </View>
        </ScrollView>
      </AppModalSheet>

      <AppModalSheet
        contentStyle={styles.manageContent}
        onClose={() => {
          setManageVisible(false);
          setMoreMenuInlineOpen(false);
        }}
        title="管理计划"
        visible={isManageVisible}
      >
        <ScrollView contentContainerStyle={styles.manageScrollContent} showsVerticalScrollIndicator={false} nestedScrollEnabled>
          {/* 我的计划区域 */}
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <AppText variant="subtitle" weight="900">
                我的计划
              </AppText>
              <AppText tone="muted" variant="caption">
                {sortedUserPlans.length} 个
              </AppText>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setMoreMenuInlineOpen((prev) => !prev)}
              style={({ pressed }) => [styles.moreButtonSmall, pressed && styles.pressed]}
            >
              <Ionicons color={colors.textMuted} name="ellipsis-vertical" size={16} />
            </Pressable>
          </View>

          {/* 内联展开的更多操作（新建 / 导入） */}
          {moreMenuInlineOpen ? (
            <View style={styles.inlineMoreActions}>
              <AppButton
                onPress={() => {
                  setMoreMenuInlineOpen(false);
                  setManageVisible(false);
                  if (guardFeature('create_plan', { userPlanCount: userPlans.length })) {
                    router.push('/plan/create' as never);
                  }
                }}
                size="sm"
                variant="secondary"
                icon="add-circle-outline"
              >
                新建空白计划
              </AppButton>
              <AppButton
                onPress={() => {
                  setMoreMenuInlineOpen(false);
                  setManageVisible(false);
                  void importPlan();
                }}
                size="sm"
                variant="secondary"
                icon="download-outline"
              >
                导入计划
              </AppButton>
              {emptyPlanIds.size > 0 ? (
                <AppButton
                  disabled={isWorking}
                  onPress={() => {
                    setMoreMenuInlineOpen(false);
                    void cleanupEmptyPlans();
                  }}
                  size="sm"
                  variant="danger"
                  icon="trash-outline"
                >
                  清理空计划（{emptyPlanIds.size}）
                </AppButton>
              ) : null}
            </View>
          ) : null}

          {sortedUserPlans.length === 0 ? (
            <AppCard style={styles.emptyManageCard} tone="soft">
              <Ionicons color={colors.textMuted} name="clipboard-outline" size={32} />
              <AppText variant="bodySmall" weight="900">
                还没有我的计划
              </AppText>
              <AppText tone="muted" variant="caption">
                点击右上角更多操作新建或导入，或从下方系统方案开始
              </AppText>
            </AppCard>
          ) : (
            <View style={styles.list}>
              {sortedUserPlans.map((plan) => {
                const isActive = plan.id === group?.activePlanId;
                const canDelete = !isActive && sortedUserPlans.length > 1 && plan.source !== 'system';
                return (
                  <AppCard key={plan.id} style={[styles.managePlanCard, isActive && styles.activePlanCard]}>
                    <View style={styles.planRow}>
                      <View style={styles.planRowText}>
                        <View style={styles.planTitleRow}>
                          {isActive ? (
                            <Ionicons color={colors.primary} name="star" size={14} />
                          ) : null}
                          <AppText variant="bodySmall" weight="900">
                            {plan.name}
                          </AppText>
                          {isActive ? (
                            <View style={styles.currentBadge}>
                              <AppText tone="brand" variant="caption" weight="900">
                                当前
                              </AppText>
                            </View>
                          ) : null}
                          {emptyPlanIds.has(plan.id) ? (
                            <View style={[styles.currentBadge, { backgroundColor: colors.dangerSoft ?? colors.surfaceMuted }]}>
                              <AppText tone="danger" variant="caption" weight="900">
                                空计划
                              </AppText>
                            </View>
                          ) : null}
                        </View>
                        <AppText tone="muted" variant="caption">
                          {plan.durationWeeks} 周 · 每周 {plan.frequencyPerWeek} 练
                        </AppText>
                      </View>
                    </View>
                    <View style={styles.inlineActions}>
                      {!isActive && (
                        <AppButton
                          disabled={isSettingActive === plan.id}
                          onPress={() => void setCurrentPlan(plan)}
                          size="sm"
                          icon={isSettingActive === plan.id ? undefined : 'checkmark-outline'}
                        >
                          {isSettingActive === plan.id ? '切换中...' : '设为当前'}
                        </AppButton>
                      )}
                      <AppButton
                        onPress={() => {
                          setManageVisible(false);
                          if (plan.source === 'system') {
                            router.push({ pathname: '/plan/[planId]', params: { planId: plan.id } } as never);
                          } else {
                            router.push({ pathname: '/plan/edit/[planId]', params: { planId: plan.id } } as never);
                          }
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        {plan.source === 'system' ? '查看' : '编辑'}
                      </AppButton>
                      <AppButton
                        onPress={() => void sharePlan(plan)}
                        size="sm"
                        variant="secondary"
                        icon="share-outline"
                      >
                        分享
                      </AppButton>
                      <AppButton
                        disabled={!canDelete}
                        onPress={() => setDeletePromptPlan(plan)}
                        size="sm"
                        variant="danger"
                        icon="trash-outline"
                      >
                        删除
                      </AppButton>
                    </View>
                  </AppCard>
                );
              })}
            </View>
          )}

          {/* 系统内置方案 - 探索更多 */}
          {availableSchemes.length > 0 ? (
            <View style={styles.systemSchemeSection}>
              <SectionHeader
                subtitle="系统内置训练方案，点击使用可复制为我的计划。"
                title={`探索更多 (${availableSchemes.length} 个方案)`}
              />
              <View style={styles.list}>
                {availableSchemes.slice(0, 3).map((scheme) => (
                  <SchemeCard
                    key={scheme.id}
                    onPreview={() => setPreviewScheme(scheme)}
                    onUse={() => openUseScheme(scheme)}
                    scheme={scheme}
                  />
                ))}
                {availableSchemes.length > 3 && (
                  <AppButton
                    onPress={() => {
                      setManageVisible(false);
                      setSchemeLibraryVisible(true);
                    }}
                    variant="secondary"
                    size="sm"
                    icon="chevron-forward-outline"
                  >
                    查看全部 {availableSchemes.length} 个方案 →
                  </AppButton>
                )}
              </View>
            </View>
          ) : null}
        </ScrollView>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setDeletePromptPlan(null)}
        position="center"
        subtitle="只删除这份用户计划，不会删除历史训练记录。"
        title="删除这个计划？"
        visible={Boolean(deletePromptPlan)}
      >
        {deletePromptPlan ? (
          <AppCard style={styles.compactPreview} tone="soft">
            <AppText variant="bodySmall" weight="900">
              {deletePromptPlan.name}
            </AppText>
            <AppText tone="muted" variant="caption">
              {describePlanSource(deletePromptPlan.source)} · {deletePromptPlan.durationWeeks} 周
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setDeletePromptPlan(null)} variant="secondary">
            取消
          </AppButton>
          <AppButton disabled={isWorking} onPress={() => void deletePlan()} variant="danger">
            删除计划
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setSelectedScheme(null)}
        subtitle="系统会复制一份到“我的计划”，复制后你可以编辑自己的版本。"
        title="使用此方案？"
        visible={Boolean(selectedScheme)}
      >
        {selectedScheme ? (
          <AppCard style={styles.compactPreview} tone="soft">
            <View style={styles.tagRow}>
              <Tag label={describeSchemeGoal(selectedScheme.goal)} tone="brand" />
              <Tag label={describeSchemeLevel(selectedScheme.level)} tone="accent" />
              <Tag label={`每周 ${selectedScheme.frequencyPerWeek} 天`} tone="neutral" />
            </View>
            <AppText variant="bodySmall" weight="900">
              {selectedScheme.title}
            </AppText>
            <AppText tone="muted" variant="caption">
              {selectedScheme.subtitle}
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setSelectedScheme(null)} variant="secondary">
            取消
          </AppButton>
          <AppButton disabled={isWorking} onPress={() => void confirmUseSelectedScheme()}>
            复制到我的计划
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setPreviewScheme(null)}
        subtitle={previewScheme?.subtitle}
        title={previewScheme?.title ?? '方案预览'}
        visible={Boolean(previewScheme)}
      >
        {previewScheme ? (
          <>
            <View style={styles.tagRow}>
              <Tag label={describeSchemeGoal(previewScheme.goal)} tone="brand" />
              <Tag label={describeSchemeLevel(previewScheme.level)} tone="accent" />
              <Tag label={`每周 ${previewScheme.frequencyPerWeek} 天`} tone="neutral" />
              <Tag label={`${previewScheme.durationWeeks} 周`} tone="neutral" />
            </View>
            <AppCard style={styles.compactPreview} tone="soft">
              <AppText tone="muted" variant="caption">
                训练日结构
              </AppText>
              <AppText variant="bodySmall" weight="900">
                {previewScheme.dayStructure}
              </AppText>
              <AppText tone="muted" variant="bodySmall">
                {previewScheme.description}
              </AppText>
            </AppCard>
            <View style={styles.modalButtons}>
              <AppButton onPress={() => setPreviewScheme(null)} variant="secondary">
                关闭
              </AppButton>
              <AppButton
                onPress={() => {
                  setPreviewScheme(null);
                  openUseScheme(previewScheme);
                }}
              >
                使用此方案
              </AppButton>
            </View>
          </>
        ) : null}
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setActivationPrompt(null)}
        subtitle={activationPrompt?.message}
        title={activationPrompt?.title ?? '计划已准备好'}
        visible={Boolean(activationPrompt)}
      >
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setActivationPrompt(null)} variant="secondary">
            稍后
          </AppButton>
          <AppButton
            disabled={isWorking}
            onPress={() => {
              const plan = activationPrompt?.plan;
              setActivationPrompt(null);
              if (plan) {
                void setCurrentPlan(plan);
              }
            }}
          >
            设为当前
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setSharePrompt(null)}
        subtitle={sharePrompt?.message}
        title={sharePrompt?.title ?? '计划内容已生成'}
        visible={Boolean(sharePrompt)}
      >
        <View style={styles.modalButtons}>
          <AppButton disabled={isWorking} onPress={() => void copyShareContent()}>
            复制内容
          </AppButton>
          <AppButton onPress={() => setSharePrompt(null)} variant="secondary">
            知道了
          </AppButton>
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

function StatTile({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.statTile, wide && styles.statTileWide]}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function PlanActionRow({
  disabled,
  icon,
  label,
  onPress,
}: {
  disabled?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.planActionRow, pressed && styles.pressed, disabled && styles.disabledActionRow]}
    >
      <View style={styles.planActionIcon}>
        <Ionicons color={disabled ? colors.textSubtle : colors.primary} name={icon} size={20} />
      </View>
      <AppText tone={disabled ? 'muted' : 'default'} variant="bodySmall" weight="900">
        {label}
      </AppText>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function SchemeCard({
  onPreview,
  onUse,
  scheme,
}: {
  onPreview: () => void;
  onUse: () => void;
  scheme: SystemTrainingScheme;
}) {
  return (
    <AppCard style={styles.schemeCard}>
      <View style={styles.planRow}>
        <View style={styles.schemeIcon}>
          <Ionicons color={colors.primary} name="barbell-outline" size={20} />
        </View>
        <View style={styles.planRowText}>
          <AppText variant="subtitle">{scheme.title}</AppText>
          <AppText tone="muted" variant="caption">
            {scheme.subtitle}
          </AppText>
        </View>
        <Tag label="可复制模板" tone="success" />
      </View>
      <View style={styles.tagRow}>
        <Tag label={describeSchemeGoal(scheme.goal)} tone="brand" />
        <Tag label={describeSchemeLevel(scheme.level)} tone="accent" />
        <Tag label={`每周 ${scheme.frequencyPerWeek} 练`} tone="neutral" />
        <Tag label={`${scheme.durationWeeks} 周`} tone="neutral" />
      </View>
      <AppText tone="muted" variant="bodySmall">
        {scheme.dayStructure}
      </AppText>
      <View style={styles.inlineActions}>
        <AppButton onPress={onPreview} size="sm" variant="secondary">
          预览
        </AppButton>
        <AppButton onPress={onUse} size="sm">
          使用此方案
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  button: {
    flex: 1,
  },
  compactPreview: {
    gap: spacing.md,
    padding: spacing.md,
  },
  cycleCard: {
    gap: spacing.md,
  },
  cycleHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  cycleIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  cycleNotice: {
    gap: spacing.md,
  },
  cycleNoticeHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cycleStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dashboardCard: {
    gap: spacing.md,
  },
  dashboardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  dayBadge: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  dayCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dayList: {
    gap: spacing.sm,
  },
  dayText: {
    flex: 1,
    gap: 2,
  },
  emptyPlanCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  emptyManageCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
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
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  list: {
    gap: spacing.sm,
  },
  libraryContent: {
    maxHeight: 560,
  },
  loadingOverlay: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  manageContent: {
    maxHeight: 560,
  },
  manageScrollContent: {
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  inlineMoreActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  managePlanCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  activePlanCard: {
    borderColor: colors.primary,
    borderWidth: 1.5,
  },
  planTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  currentBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  noGroupCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  planRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  planRowText: {
    flex: 1,
    gap: 2,
  },
  planActionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  planActionRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 58,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },
  disabledActionRow: {
    opacity: 0.45,
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: '100%',
  },
  progressTrackDark: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  schemeCard: {
    gap: spacing.md,
  },
  systemSchemeSection: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  schemeIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  schemeIconMuted: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statGrid: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  statTile: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flex: 1,
    gap: 1,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  statTileWide: {
    flex: 1.5,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  upcomingCard: {
    gap: spacing.md,
  },
  moreButtonSmall: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
});
