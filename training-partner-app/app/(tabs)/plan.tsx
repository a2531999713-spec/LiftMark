import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, MiniLineChart, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { AuthGateSheets } from '@/components/auth';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import { DEFAULT_CYCLE_WEEK_COUNT } from '@/domain/plan/defaultCycle';
import type { PhaseType, PlanDay, PlanTemplate } from '@/domain/plan/plan.types';
import {
  describeSchemeGoal,
  describeSchemeLevel,
  listSystemTrainingSchemes,
  type SystemTrainingScheme,
} from '@/domain/plan/systemSchemes';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { pickImportedPlanDocument } from '@/services/planDocumentService';
import { createCurrentPlanFile, PlanFileError, serializePlanFile } from '@/services/planFileService';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing } from '@/theme';

type PlanNotice = {
  message: string;
  title: string;
};

type ExportPrompt = {
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
  lastFourWeeks: number[];
  lastFourWeekLabels: string[];
  recentSessionDate?: string;
  weeklyCompletedSets: number;
  weeklySessionCount: number;
  weeklyVolume: number;
};

const emptyStats: PlanDashboardStats = {
  lastFourWeeks: [0, 0, 0, 0],
  lastFourWeekLabels: ['', '', '', ''],
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

function clampPlanWeek(week: number, plan: PlanTemplate | null) {
  const maxWeek = plan?.durationWeeks ?? DEFAULT_CYCLE_WEEK_COUNT;
  return Math.min(maxWeek, Math.max(1, Math.round(week)));
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

function formatDateRange(start: Date, end: Date): string {
  return `${formatMonthDay(start)}-${formatMonthDay(end)}`;
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

function buildLastFourWeeks(details: WorkoutSessionDetail[]): Pick<PlanDashboardStats, 'lastFourWeeks' | 'lastFourWeekLabels'> {
  const now = new Date();
  const buckets = [21, 14, 7, 0].map((offset) => {
    const startDate = addDays(now, -offset - 6);
    const endDate = addDays(now, -offset);
    const start = getLocalDateString(startDate);
    const end = getLocalDateString(endDate);
    return { start, end, count: 0, label: formatDateRange(startDate, endDate) };
  });

  details.forEach((detail) => {
    const bucket = buckets.find((item) => detail.session.date >= item.start && detail.session.date <= item.end);
    if (bucket && detail.sets.some((set) => set.completed)) {
      bucket.count += 1;
    }
  });

  return {
    lastFourWeekLabels: buckets.map((bucket) => bucket.label),
    lastFourWeeks: buckets.map((bucket) => bucket.count),
  };
}

export default function PlanRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const systemSchemes = useMemo(() => listSystemTrainingSchemes(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [group, setGroup] = useState<Group | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [daySummaries, setDaySummaries] = useState<DaySummary[]>([]);
  const [stats, setStats] = useState<PlanDashboardStats>(emptyStats);
  const [selectedScheme, setSelectedScheme] = useState<SystemTrainingScheme | null>(null);
  const [previewScheme, setPreviewScheme] = useState<SystemTrainingScheme | null>(null);
  const [activationPrompt, setActivationPrompt] = useState<ActivationPrompt | null>(null);
  const [exportPrompt, setExportPrompt] = useState<ExportPrompt | null>(null);
  const [notice, setNotice] = useState<PlanNotice | null>(null);
  const [isManageVisible, setManageVisible] = useState(false);
  const [isActionsVisible, setActionsVisible] = useState(false);
  const [isSchemeLibraryVisible, setSchemeLibraryVisible] = useState(false);
  const [deletePromptPlan, setDeletePromptPlan] = useState<PlanTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableSchemes = useMemo(() => systemSchemes.filter((scheme) => scheme.isAvailable), [systemSchemes]);
  const upcomingSchemes = useMemo(() => systemSchemes.filter((scheme) => !scheme.isAvailable), [systemSchemes]);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const [nextActivePlan, nextUserPlans] = await Promise.all([
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
        repositories.planRepository.listUserPlans(),
      ]);

      let nextDaySummaries: DaySummary[] = [];
      let nextStats = emptyStats;

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
            fromDate: getLocalDateString(addDays(new Date(), -27)),
            toDate: today,
            limit: 120,
          })
        ).filter((session) => session.planId === nextActivePlan.id);
        const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
        const weeklyDetails = details.filter((detail) => detail.session.date >= weekStart && detail.session.date <= today);
        const weeklySummary = summarizeWorkoutDetails(weeklyDetails);
        const lastFourWeekStats = buildLastFourWeeks(details);

        nextStats = {
          ...weeklySummary,
          ...lastFourWeekStats,
          recentSessionDate: sessions[0]?.date,
          weeklySessionCount: weeklyDetails.filter((detail) => detail.sets.some((set) => set.completed)).length,
        };
      }

      setGroup(nextGroup);
      setActivePlan(nextActivePlan);
      setUserPlans(nextUserPlans);
      setDaySummaries(nextDaySummaries);
      setStats(nextStats);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadPlans();
    }, [loadPlans]),
  );

  const resolvePhaseTypeForWeek = useCallback(
    async (planId: string, week: number): Promise<PhaseType> => {
      const phases = await repositories.planRepository.listPlanPhases(planId);
      return phases.find((phase) => week >= phase.startWeek && week <= phase.endWeek)?.type ?? phases[0]?.type ?? 'custom';
    },
    [repositories],
  );

  const saveWeek = useCallback(
    async (week: number) => {
      if (!group) {
        return;
      }

      if (!guardFeature('edit_plan')) {
        return;
      }

      const currentWeek = clampPlanWeek(week, activePlan);
      const updated = await repositories.groupRepository.updateGroup(group.id, {
        currentPhaseType: await resolvePhaseTypeForWeek(group.activePlanId, currentWeek),
        currentWeek,
      });
      setGroup(updated);
      await loadPlans();
    },
    [activePlan, group, guardFeature, loadPlans, repositories, resolvePhaseTypeForWeek],
  );

  const setCurrentPlan = useCallback(
    async (plan: PlanTemplate, showNotice = true) => {
      if (!group) {
        return;
      }

      if (!guardFeature('edit_plan')) {
        return;
      }

      setIsWorking(true);
      try {
        const updated = await repositories.groupRepository.updateGroup(group.id, {
          activePlanId: plan.id,
          currentPhaseType: await resolvePhaseTypeForWeek(plan.id, 1),
          currentWeek: 1,
        });
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
        setIsWorking(false);
      }
    },
    [group, guardFeature, loadPlans, repositories, resolvePhaseTypeForWeek],
  );

  const exportPlan = useCallback(
    async (plan: PlanTemplate) => {
      if (!guardFeature('share_plan')) {
        return;
      }

      setIsWorking(true);
      try {
        const planFile = await createCurrentPlanFile(repositories, plan.id);
        const json = serializePlanFile(planFile);
        setExportPrompt({
          content: json,
          title: '计划内容已生成',
          message: `当前版本暂未保存到文件。你可以复制 .liftmark.json 内容，后续版本会接入保存和分享。大小约 ${Math.ceil(
            json.length / 1024,
          )} KB。`,
        });
      } catch (exportError) {
        setNotice({
          title: '导出失败',
          message: exportError instanceof Error ? exportError.message : '导出计划失败。',
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

    setIsWorking(true);
    try {
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
      await loadPlans();

      setActivationPrompt({
        plan: importedPlan,
        title: '计划已导入',
        message: `“${importedPlan.name}”已成为我的计划。是否设为当前训练计划？`,
      });
    } catch (importError) {
      if (importError instanceof PlanFileError) {
        setNotice({
          title: '计划文件格式不兼容',
          message: '这个文件不是练刻 LiftMark 支持的计划文件。',
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
  }, [guardFeature, loadPlans, repositories]);

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
      const plan = await repositories.planRepository.copySystemSchemeToUserPlan({
        scheme: selectedScheme,
        name: selectedScheme.title.replace('方案', '计划'),
      });
      await loadPlans();
      setSelectedScheme(null);
      setActivationPrompt({
        plan,
        title: '已复制到我的计划',
        message: `“${plan.name}”已经是可编辑的用户计划。是否设为当前训练计划？`,
      });
    } catch (copyError) {
      setNotice({
        title: '复制失败',
        message: copyError instanceof Error ? copyError.message : '使用系统方案失败。',
      });
    } finally {
      setIsWorking(false);
    }
  }, [guardFeature, loadPlans, repositories, selectedScheme, userPlans.length]);

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

  const copyExportContent = useCallback(async () => {
    if (!exportPrompt) {
      return;
    }

    await Clipboard.setStringAsync(exportPrompt.content);
    setExportPrompt(null);
    setNotice({
      title: '已复制内容',
      message: '计划 JSON 内容已复制到剪贴板。当前版本还不会自动保存文件。',
    });
  }, [exportPrompt]);

  const activePlanWeeks = activePlan?.durationWeeks ?? DEFAULT_CYCLE_WEEK_COUNT;
  const activePlanProgress = Math.min(100, Math.round(((group?.currentWeek ?? 1) / activePlanWeeks) * 100));
  return (
    <Screen
      headerRight={
        <View style={styles.headerActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (guardFeature('create_plan', { userPlanCount: userPlans.length })) {
                router.push('/plan/create' as never);
              }
            }}
            style={styles.iconButton}
          >
            <Ionicons color={colors.text} name="add-outline" size={21} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setActionsVisible(true)} style={styles.iconButton}>
            <Ionicons color={colors.text} name="ellipsis-horizontal" size={21} />
          </Pressable>
        </View>
      }

    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="计划暂时无法加载" description={error} /> : null}

      {!isLoading && !error && group ? (
        <>
          <VisualHeroCard
            eyebrow="当前计划"
            icon="clipboard-outline"
            imageSource={liftmarkImages.planHero}
            minHeight={188}
            subtitle={`第 ${group.currentWeek}/${activePlanWeeks} 周 · ${describePlanSource(activePlan?.source ?? 'blank_created')}`}
            title={activePlan?.name ?? '还没有当前计划'}
          >
            <View style={styles.planMetaRow}>
              <Tag label={`${activePlan?.frequencyPerWeek ?? 0} 天/周`} tone="dark" />
              <Tag label={`${activePlanWeeks} 周周期`} tone="dark" />
              <Tag label={`${activePlanProgress}%`} tone="dark" />
            </View>
            <View style={styles.progressTrackDark}>
              <View style={[styles.progressFill, { width: `${activePlanProgress}%` }]} />
            </View>
            <View style={styles.inlineActions}>
              <AppButton onPress={() => router.push('/(tabs)/today')} size="sm">
                去训练页
              </AppButton>
            </View>
          </VisualHeroCard>

          <View style={styles.weekControls}>
            <AppButton disabled={group.currentWeek <= 1} onPress={() => void saveWeek(group.currentWeek - 1)} size="sm" variant="secondary">
              上一周
            </AppButton>
            <AppButton disabled={group.currentWeek >= activePlanWeeks} onPress={() => void saveWeek(group.currentWeek + 1)} size="sm">
              下一周
            </AppButton>
          </View>

          <AppCard style={styles.dashboardCard}>
            <View style={styles.dashboardHeader}>
              <View>
                <AppText variant="subtitle">本周执行</AppText>
                <AppText tone="muted" variant="caption">
                  当前计划下的训练记录
                </AppText>
              </View>
              <Tag label={stats.recentSessionDate ? `最近 ${stats.recentSessionDate}` : '暂无训练'} tone={stats.recentSessionDate ? 'success' : 'neutral'} />
            </View>
            <View style={styles.statGrid}>
              <StatTile label="完成训练" value={`${stats.weeklySessionCount} 次`} />
              <StatTile label="完成组数" value={`${stats.weeklyCompletedSets} 组`} />
              <StatTile label="训练量" value={formatKg(stats.weeklyVolume)} wide />
            </View>
            <MiniLineChart
              chartHeight={92}
              data={stats.lastFourWeeks}
              emptyMessage="最近 4 周还没有当前计划训练记录"
              labels={stats.lastFourWeekLabels}
              minChartHeight={Math.max(1, ...stats.lastFourWeeks)}
              showValues
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

      <AppModalSheet
        onClose={() => setActionsVisible(false)}
        subtitle="页面只展示关键计划状态，低频操作收在这里。"
        title="计划操作"
        visible={isActionsVisible}
      >
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
          label="导出当前计划"
          onPress={() => {
            setActionsVisible(false);
            if (activePlan) {
              void exportPlan(activePlan);
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
        onClose={() => setManageVisible(false)}
        subtitle="只能删除我的计划；系统方案、当前计划和最后一个我的计划不会被删除。"
        title="管理我的计划"
        visible={isManageVisible}
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.list}>
            {userPlans.map((plan) => {
              const isActive = plan.id === group?.activePlanId;
              const canDelete = !isActive && userPlans.length > 1 && plan.source !== 'system';
              return (
                <AppCard key={plan.id} style={styles.managePlanCard}>
                  <View style={styles.planRow}>
                    <View style={styles.planRowText}>
                      <AppText variant="bodySmall" weight="900">
                        {plan.name}
                      </AppText>
                      <AppText tone="muted" variant="caption">
                        {plan.durationWeeks} 周 · 每周 {plan.frequencyPerWeek} 练
                      </AppText>
                    </View>
                    <Tag label={isActive ? '当前计划' : '我的计划'} tone={isActive ? 'success' : 'neutral'} />
                  </View>
                  <View style={styles.inlineActions}>
                    <AppButton onPress={() => router.push({ pathname: '/plan/[planId]', params: { planId: plan.id } })} size="sm" variant="secondary">
                      查看
                    </AppButton>
                    <AppButton disabled={isActive} onPress={() => void setCurrentPlan(plan)} size="sm">
                      设为当前
                    </AppButton>
                    <AppButton disabled={!canDelete} onPress={() => setDeletePromptPlan(plan)} size="sm" variant="danger">
                      删除
                    </AppButton>
                  </View>
                </AppCard>
              );
            })}
          </View>
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
        onClose={() => setExportPrompt(null)}
        subtitle={exportPrompt?.message}
        title={exportPrompt?.title ?? '计划内容已生成'}
        visible={Boolean(exportPrompt)}
      >
        <View style={styles.modalButtons}>
          <AppButton disabled={isWorking} onPress={() => void copyExportContent()}>
            复制内容
          </AppButton>
          <AppButton onPress={() => setExportPrompt(null)} variant="secondary">
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
  compactPreview: {
    gap: spacing.md,
    padding: spacing.md,
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
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  libraryContent: {
    maxHeight: 560,
  },
  manageContent: {
    maxHeight: 520,
  },
  managePlanCard: {
    gap: spacing.md,
    padding: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
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
  statGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flex: 1,
    gap: 2,
    minHeight: 56,
    padding: spacing.sm,
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
  weekControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
