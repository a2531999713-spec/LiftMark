import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, MiniLineChart, MultiLineTrendChart, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import {
  analyzeExerciseHistory,
  estimateOneRM,
  getGroupHistoryAnalysis,
  selectLargestExerciseSeries,
  type GroupHistoryAnalysis,
  type HistoryAnalysis,
  type HistorySetEntry,
} from '@/domain/history/history-analysis';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { WorkoutSession, WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type DataScope = 'personal' | 'group';

type SessionSummary = {
  bestEstimatedOneRM?: number;
  durationMinutes?: number;
  exerciseCount: number;
  mainExerciseNames: string[];
  session: WorkoutSession;
  setCount: number;
  topSetLabel?: string;
  volume: number;
};

type WeekTrendPoint = {
  date?: string;
  label: string;
  volume: number;
};

type ExerciseFilterOption = {
  id: string;
  name: string;
};

type HistoryState = {
  analysis: HistoryAnalysis | null;
  currentMember: GroupMember | null;
  exercise: Exercise | null;
  exerciseEntries: HistorySetEntry[];
  exerciseOptions: ExerciseFilterOption[];
  groupAnalysis: GroupHistoryAnalysis | null;
  groupName: string;
  memberProfilesById: Record<string, MemberProfile | null>;
  monthlyTrainingDates: Set<string>;
  recentSessions: SessionSummary[];
  selectedDateSessions: SessionSummary[];
  weeklyCompletedSets: number;
  weeklySessionCount: number;
  weeklyTrend: WeekTrendPoint[];
  weeklyVolume: number;
};

function createEmptyHistory(currentMember: GroupMember | null = null): HistoryState {
  return {
    analysis: null,
    currentMember,
    exercise: null,
    exerciseEntries: [],
    exerciseOptions: [],
    groupAnalysis: null,
    groupName: '默认训练小组',
    memberProfilesById: {},
    monthlyTrainingDates: new Set<string>(),
    recentSessions: [],
    selectedDateSessions: [],
    weeklyCompletedSets: 0,
    weeklySessionCount: 0,
    weeklyTrend: [],
    weeklyVolume: 0,
  };
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function addMonths(date: Date, count: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

function getWeekDates(centerDate: string) {
  const center = new Date(`${centerDate}T12:00:00`);
  return Array.from({ length: 7 }, (_, index) => addDays(center, index - 3));
}

function getMonthDates(monthCursor: Date) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 12);
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1, 12));
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatTrend(value: string): string {
  if (value === 'up') {
    return '上升';
  }

  if (value === 'down') {
    return '下降';
  }

  if (value === 'stable') {
    return '稳定';
  }

  return '样本不足';
}

function getDurationMinutes(session: WorkoutSession): number | undefined {
  if (!session.startedAt || !session.finishedAt) {
    return undefined;
  }

  const startedAt = new Date(session.startedAt).getTime();
  const finishedAt = new Date(session.finishedAt).getTime();
  if (!Number.isFinite(startedAt) || !Number.isFinite(finishedAt) || finishedAt <= startedAt) {
    return undefined;
  }

  return Math.round((finishedAt - startedAt) / 60000);
}

function getMemberEntries(detail: WorkoutSessionDetail, memberId: string): HistorySetEntry[] {
  return detail.sets
    .filter((set) => set.memberId === memberId)
    .map((set) => {
      const record = detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId);

      return {
        completed: set.completed,
        date: detail.session.date,
        exerciseId: record?.exerciseId ?? set.exerciseRecordId,
        memberId: set.memberId,
        reps: set.actualReps,
        sessionId: detail.session.id,
        weight: set.actualWeight,
      };
    });
}

function summarizeSession(
  detail: WorkoutSessionDetail,
  memberId: string,
  exerciseNamesById: Record<string, string> = {},
): SessionSummary {
  const memberSets = detail.sets.filter((set) => set.memberId === memberId && set.completed);
  const exerciseIds = new Set(
    memberSets.map((set) => detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId)?.exerciseId ?? set.exerciseRecordId),
  );
  const completedRecordIds = new Set(memberSets.map((set) => set.exerciseRecordId));
  const mainExerciseNames = detail.exercises
    .filter((exercise) => completedRecordIds.has(exercise.id))
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((exercise) => exerciseNamesById[exercise.exerciseId] ?? '未知动作')
    .filter((name, index, names) => names.indexOf(name) === index);
  const topSet = memberSets
    .map((set) => ({
      estimatedOneRM: estimateOneRM(set.actualWeight ?? set.plannedWeight ?? 0, set.actualReps ?? set.plannedReps ?? 0),
      reps: set.actualReps ?? set.plannedReps ?? 0,
      weight: set.actualWeight ?? set.plannedWeight ?? 0,
    }))
    .filter((set) => set.weight > 0 && set.reps > 0)
    .sort((left, right) => right.estimatedOneRM - left.estimatedOneRM)[0];

  return {
    bestEstimatedOneRM: topSet?.estimatedOneRM,
    durationMinutes: getDurationMinutes(detail.session),
    exerciseCount: exerciseIds.size,
    mainExerciseNames,
    session: detail.session,
    setCount: memberSets.length,
    topSetLabel: topSet ? `${topSet.weight}kg x ${topSet.reps}` : undefined,
    volume: memberSets.reduce(
      (sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
      0,
    ),
  };
}

function buildWeeklyTrend(summaries: SessionSummary[]): WeekTrendPoint[] {
  return summaries
    .filter((summary) => summary.setCount > 0 || summary.volume > 0)
    .sort((left, right) => `${left.session.date} ${left.session.updatedAt}`.localeCompare(`${right.session.date} ${right.session.updatedAt}`))
    .slice(-7)
    .map((summary) => ({
      date: summary.session.date,
      label: formatShortDate(summary.session.date),
      volume: summary.volume,
    }));
}

function buildExerciseTrend(entries: HistorySetEntry[]): WeekTrendPoint[] {
  const bySession = new Map<string, WeekTrendPoint>();
  entries
    .filter((entry) => entry.completed && (entry.weight ?? 0) > 0 && (entry.reps ?? 0) > 0)
    .forEach((entry) => {
      const current = bySession.get(entry.sessionId) ?? {
        date: entry.date,
        label: formatShortDate(entry.date),
        volume: 0,
      };
      current.volume += (entry.weight ?? 0) * (entry.reps ?? 0);
      bySession.set(entry.sessionId, current);
    });

  return [...bySession.values()]
    .sort((left, right) => (left.date ?? '').localeCompare(right.date ?? ''))
    .slice(-7);
}

export default function HistoryRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [isMonthVisible, setMonthVisible] = useState(false);
  const [dataScope, setDataScope] = useState<DataScope>('personal');
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryState>(createEmptyHistory());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (authMode === 'guest_preview') {
        setHistory(createEmptyHistory());
        return;
      }

      await initializeLocalDatabase();
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }
      if (group.id !== selectedGroupId) {
        setSelectedGroupId(group.id);
      }

      const members = await repositories.memberRepository.listMembers(group.id);
      const currentMember = members[0] ?? null;
      if (!currentMember) {
        setHistory(createEmptyHistory());
        return;
      }
      const memberProfiles = await Promise.all(
        members.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ] as const),
      );

      const monthStart = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 12));
      const monthEnd = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 12));
      const sevenDaysAgo = addDays(new Date(), -6);
      const weekStart = getLocalDateString(sevenDaysAgo);
      const today = getLocalDateString();
      const [personalSessions, monthSessions, weekSessions, groupRecentSessions, groupWeekSessions] = await Promise.all([
        repositories.workoutRepository.listSessions({ groupId: group.id, memberId: currentMember.id, limit: 200 }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          memberId: currentMember.id,
          fromDate: monthStart,
          toDate: monthEnd,
          limit: 200,
        }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          memberId: currentMember.id,
          fromDate: weekStart,
          toDate: today,
          limit: 200,
        }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          limit: 10,
        }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          fromDate: weekStart,
          toDate: today,
          limit: 200,
        }),
      ]);
      const [personalDetails, weekDetails] = await Promise.all([
        Promise.all(personalSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
        Promise.all(weekSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
      ]);
      const groupSessionIds = Array.from(new Set([...groupRecentSessions, ...groupWeekSessions].map((session) => session.id)));
      const groupDetails = await Promise.all(groupSessionIds.map((sessionId) => repositories.workoutRepository.getSessionDetail(sessionId)));
      const groupDetailsById = new Map(groupDetails.map((detail) => [detail.session.id, detail]));
      const groupWeekDetails = groupWeekSessions
        .map((session) => groupDetailsById.get(session.id))
        .filter((detail): detail is WorkoutSessionDetail => Boolean(detail));
      const groupRecentDetails = groupRecentSessions
        .map((session) => groupDetailsById.get(session.id))
        .filter((detail): detail is WorkoutSessionDetail => Boolean(detail));
      const recentEntries = personalDetails.flatMap((detail) => getMemberEntries(detail, currentMember.id));
      const series = selectLargestExerciseSeries(recentEntries);
      const analysis = series ? analyzeExerciseHistory(series.entries) : null;
      const exercise = series
        ? (await repositories.exerciseRepository.listExercisesByIds([series.exerciseId]))[0] ?? null
        : null;
      const summaryExerciseIds = Array.from(
        new Set(
          [...personalDetails, ...weekDetails, ...groupDetails].flatMap((detail) =>
            detail.exercises.map((exerciseRecord) => exerciseRecord.exerciseId),
          ),
        ),
      );
      const summaryExercises = await repositories.exerciseRepository.listExercisesByIds(summaryExerciseIds);
      const exerciseNamesById = Object.fromEntries(summaryExercises.map((exerciseItem) => [exerciseItem.id, exerciseItem.name]));
      const weeklySummaries = weekDetails.map((detail) => summarizeSession(detail, currentMember.id, exerciseNamesById));
      const personalSummaries = personalDetails.map((detail) => summarizeSession(detail, currentMember.id, exerciseNamesById));

      setHistory({
        analysis,
        currentMember,
        exercise,
        exerciseEntries: recentEntries,
        exerciseOptions: Array.from(new Set(recentEntries.map((entry) => entry.exerciseId))).map((exerciseId) => ({
          id: exerciseId,
          name: exerciseNamesById[exerciseId] ?? '训练动作',
        })),
        monthlyTrainingDates: new Set(monthSessions.map((session) => session.date)),
        memberProfilesById: Object.fromEntries(memberProfiles),
        recentSessions: personalSummaries,
        selectedDateSessions: [],
        groupAnalysis: getGroupHistoryAnalysis({
          details: groupWeekDetails,
          groupId: group.id,
          groupName: group.name,
          members,
          exerciseNamesById,
          recentDetails: groupRecentDetails,
          rangeDays: 7,
        }),
        groupName: group.name,
        weeklyCompletedSets: weeklySummaries.reduce((sum, summary) => sum + summary.setCount, 0),
        weeklySessionCount: weeklySummaries.filter((summary) => summary.setCount > 0).length,
        weeklyTrend: buildWeeklyTrend(weeklySummaries),
        weeklyVolume: weeklySummaries.reduce((sum, summary) => sum + summary.volume, 0),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '历史记录加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [authMode, monthCursor, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthDates = useMemo(() => getMonthDates(monthCursor), [monthCursor]);
  const effectiveSelectedExerciseId =
    selectedExerciseId && history.exerciseOptions.some((option) => option.id === selectedExerciseId)
      ? selectedExerciseId
      : null;
  const selectedExerciseOption = useMemo(
    () => history.exerciseOptions.find((option) => option.id === effectiveSelectedExerciseId) ?? null,
    [effectiveSelectedExerciseId, history.exerciseOptions],
  );
  const selectedExerciseEntries = useMemo(
    () =>
      effectiveSelectedExerciseId
        ? history.exerciseEntries.filter((entry) => entry.exerciseId === effectiveSelectedExerciseId)
        : history.exerciseEntries,
    [effectiveSelectedExerciseId, history.exerciseEntries],
  );
  const selectedExerciseAnalysis = useMemo(() => {
    if (effectiveSelectedExerciseId) {
      return selectedExerciseEntries.length > 0 ? analyzeExerciseHistory(selectedExerciseEntries) : null;
    }
    return null;
  }, [effectiveSelectedExerciseId, selectedExerciseEntries]);
  const selectedExerciseTrend = useMemo(
    () => (effectiveSelectedExerciseId ? buildExerciseTrend(selectedExerciseEntries) : history.weeklyTrend),
    [effectiveSelectedExerciseId, history.weeklyTrend, selectedExerciseEntries],
  );
  const querySessions = useMemo(() => {
    if (!effectiveSelectedExerciseId) {
      return history.recentSessions;
    }
    const sessionIds = new Set(selectedExerciseEntries.map((entry) => entry.sessionId));
    return history.recentSessions.filter((summary) => sessionIds.has(summary.session.id));
  }, [effectiveSelectedExerciseId, history.recentSessions, selectedExerciseEntries]);
  const selectedDateSessions = useMemo(
    () => querySessions.filter((summary) => summary.session.date === selectedDate),
    [querySessions, selectedDate],
  );

  const openRecentForEdit = useCallback(() => {
    if (!guardFeature('manual_history')) {
      return;
    }

    const latest = history.recentSessions[0]?.session;
    if (!latest) {
      Alert.alert('暂无训练', '完成或补录一次训练后，就可以查看训练详情。');
      return;
    }

    router.push({
      pathname: '/history/[sessionId]',
      params: {
        memberId: history.currentMember?.id,
        scope: 'personal',
        sessionId: latest.id,
      },
    } as never);
  }, [guardFeature, history.currentMember?.id, history.recentSessions]);

  const isGuestPreview = authMode === 'guest_preview';

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => setMonthVisible(true)} style={styles.headerCalBtn}>
          <Ionicons color={colors.text} name="calendar-outline" size={20} />
        </Pressable>
      }
      subtitle={
        history.currentMember
          ? `当前成员：${history.currentMember.displayName}`
          : '默认统计当前本地成员个人数据'
      }

    >
      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? <EmptyState title="历史记录暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          {isGuestPreview ? (
            <EmptyState
              actionLabel="登录 / 注册"
              description="登录后可以查看真实训练历史、补录训练、编辑记录和生成训练分析。"
              onActionPress={() => guardFeature('view_real_history')}
              title="登录后查看训练历史"
            />
          ) : (
            <>
          <ScopeToggle
            dataScope={dataScope}
            memberName={history.currentMember?.displayName ?? '暂无成员'}
            setDataScope={(scope) => {
              if (scope === 'group' && !guardFeature('group_analytics')) {
                return;
              }
              setDataScope(scope);
            }}
          />

          {dataScope === 'personal' ? (
            <>
              <PersonalOverview history={history} />

              <QuickActions
                onAdd={() => {
                  if (guardFeature('manual_history')) router.push('/history/manual' as never);
                }}
                onEdit={openRecentForEdit}
                onAnalytics={() => {
                  if (guardFeature('advanced_history')) router.push('/history/analytics' as never);
                }}
              />

              <View style={styles.statGrid}>
                <MiniStat icon="barbell-outline" label="本周训练" value={`${history.weeklySessionCount} 次`} accent={history.weeklySessionCount > 0} />
                <MiniStat icon="layers-outline" label="完成组数" value={`${history.weeklyCompletedSets} 组`} accent={history.weeklyCompletedSets > 0} />
                <MiniStat icon="flame-outline" label="本周容量" value={formatKg(history.weeklyVolume)} accent={history.weeklyVolume > 0} />
                <MiniStat icon="search-outline" label="训练查询" value={`${querySessions.length} 条`} />
              </View>

              <ExerciseFilterBar
                onSelect={setSelectedExerciseId}
                options={history.exerciseOptions}
                selectedExerciseId={effectiveSelectedExerciseId}
              />

              <TrendChart
                analysis={selectedExerciseAnalysis}
                exerciseId={effectiveSelectedExerciseId ?? undefined}
                exerciseName={selectedExerciseOption?.name ?? '总训练量'}
                trend={selectedExerciseTrend}
              />

              <CalendarWeek
                monthCursor={monthCursor}
                onOpenMonth={() => setMonthVisible(true)}
                onSelectDate={setSelectedDate}
                selectedDate={selectedDate}
                trainingDates={history.monthlyTrainingDates}
                weekDates={weekDates}
              />

              <SectionHeader
                actionLabel="补录"
                onActionPress={() => {
                  if (guardFeature('manual_history')) {
                    router.push({ pathname: '/history/manual', params: { date: selectedDate } } as never);
                  }
                }}
                title={`${formatShortDate(selectedDate)} 当天记录`}
              />
              {selectedDateSessions.length === 0 ? (
                <AppCard style={styles.emptyDayCard} tone="soft">
                  <Ionicons color={colors.textSubtle} name="calendar-clear-outline" size={20} />
                  <View style={styles.emptyDayText}>
                    <AppText variant="bodySmall" weight="900">
                      当天暂无匹配训练
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      可切换动作筛选，或点击「补录」添加已完成训练
                    </AppText>
                  </View>
                </AppCard>
              ) : (
                <View style={styles.sessionList}>
                  {selectedDateSessions.map((summary) => (
                    <CompactSessionCard key={summary.session.id} memberId={history.currentMember?.id} summary={summary} />
                  ))}
                </View>
              )}

              <SectionHeader
                actionLabel="补录"
                onActionPress={() => {
                  if (guardFeature('manual_history')) router.push('/history/manual' as never);
                }}
                subtitle={`${querySessions.length} 条`}
                title="训练查询"
              />
              {querySessions.length === 0 ? (
                <EmptyState
                  actionLabel="去训练"
                  description="完成一次匹配训练后，这里会显示可查询的训练摘要。"
                  onActionPress={() => {
                    if (guardFeature('start_workout')) router.push('/(tabs)/today');
                  }}
                  title="没有匹配训练记录"
                />
              ) : (
                <View style={styles.sessionList}>
                  {querySessions.slice(0, 12).map((summary) => (
                    <CompactSessionCard key={summary.session.id} memberId={history.currentMember?.id} summary={summary} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <GroupHistoryView analysis={history.groupAnalysis} memberProfilesById={history.memberProfilesById} />
          )}
            </>
          )}
        </>
      ) : null}

      <Modal animationType="slide" transparent visible={isMonthVisible} onRequestClose={() => setMonthVisible(false)}>
        <View style={styles.modalBackdrop}>
          <AppCard style={styles.monthPanel}>
            <View style={styles.modalHeader}>
              <Pressable accessibilityRole="button" onPress={() => setMonthCursor((current) => addMonths(current, -1))} style={styles.modalNavBtn}>
                <Ionicons color={colors.text} name="chevron-back-outline" size={20} />
              </Pressable>
              <AppText variant="subtitle">{formatMonthLabel(monthCursor)}</AppText>
              <Pressable accessibilityRole="button" onPress={() => setMonthCursor((current) => addMonths(current, 1))} style={styles.modalNavBtn}>
                <Ionicons color={colors.text} name="chevron-forward-outline" size={20} />
              </Pressable>
            </View>
            <View style={styles.monthGrid}>
              {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
                <AppText key={d} style={styles.weekdayLabel} variant="caption">
                  {d}
                </AppText>
              ))}
              {Array.from({ length: new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay() }).map((_, i) => (
                <View key={`pad-${i}`} style={styles.monthDay} />
              ))}
              {monthDates.map((date) => {
                const key = getLocalDateString(date);
                const active = key === selectedDate;
                const hasTraining = history.monthlyTrainingDates.has(key);
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={key}
                    onPress={() => {
                      setSelectedDate(key);
                      setMonthVisible(false);
                    }}
                    style={[styles.monthDay, active && styles.monthDayActive]}
                  >
                    <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                      {date.getDate()}
                    </AppText>
                    {hasTraining ? <View style={[styles.calDot, active && styles.calDotInverse]} /> : null}
                  </Pressable>
                );
              })}
            </View>
            <AppButton onPress={() => setMonthVisible(false)} variant="secondary">
              关闭
            </AppButton>
          </AppCard>
        </View>
      </Modal>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function ScopeToggle({
  dataScope,
  memberName,
  setDataScope,
}: {
  dataScope: DataScope;
  memberName: string;
  setDataScope: (scope: DataScope) => void;
}) {
  return (
    <AppCard padded={false} style={styles.scopeBar}>
      <View style={styles.scopeInfo}>
        <AppText variant="bodySmall" weight="900">
          当前成员：{memberName}
        </AppText>
      </View>
      <View style={styles.scopePill}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setDataScope('personal')}
          style={[styles.scopePillBtn, dataScope === 'personal' && styles.scopePillBtnActive]}
        >
          <AppText tone={dataScope === 'personal' ? 'inverse' : 'muted'} variant="caption" weight="900">
            个人
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setDataScope('group')}
          style={[styles.scopePillBtn, dataScope === 'group' && styles.scopePillBtnActive]}
        >
          <AppText tone={dataScope === 'group' ? 'inverse' : 'muted'} variant="caption" weight="900">
            小组
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

function PersonalOverview({ history }: { history: HistoryState }) {
  const sessionCount = history.weeklySessionCount;
  const completedSets = history.weeklyCompletedSets;
  return (
    <AppCard style={styles.overviewCard} tone="dark">
      <View style={styles.overviewRow}>
        <View style={styles.overviewMain}>
          <AppText style={styles.overviewLabel} variant="caption">
            本周训练量
          </AppText>
          <AppText tone="inverse" variant="headline">
            {formatKg(history.weeklyVolume)}
          </AppText>
        </View>
        <View style={styles.overviewSide}>
          <View style={styles.overviewMetric}>
            <AppText tone="inverse" variant="subtitle" weight="900">
              {sessionCount}
            </AppText>
            <AppText style={styles.overviewLabel} variant="caption">
              训练
            </AppText>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewMetric}>
            <AppText tone="inverse" variant="subtitle" weight="900">
              {completedSets}
            </AppText>
            <AppText style={styles.overviewLabel} variant="caption">
              组数
            </AppText>
          </View>
        </View>
      </View>
    </AppCard>
  );
}

function QuickActions({ onAdd, onEdit, onAnalytics }: { onAdd: () => void; onEdit: () => void; onAnalytics: () => void }) {
  return (
    <View style={styles.quickActions}>
      <Pressable accessibilityRole="button" onPress={onAdd} style={styles.quickBtn}>
        <View style={[styles.quickBtnIcon, { backgroundColor: colors.primarySoft }]}>
          <Ionicons color={colors.primary} name="add-outline" size={16} />
        </View>
        <AppText variant="bodySmall" weight="900">
          补录训练
        </AppText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onEdit} style={styles.quickBtn}>
        <View style={[styles.quickBtnIcon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons color={colors.accent} name="eye-outline" size={16} />
        </View>
        <AppText variant="bodySmall" weight="900">
          训练详情
        </AppText>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onAnalytics} style={styles.quickBtn}>
        <View style={[styles.quickBtnIcon, { backgroundColor: colors.successSoft }]}>
          <Ionicons color={colors.success} name="bar-chart-outline" size={16} />
        </View>
        <AppText variant="bodySmall" weight="900">
          训练分析
        </AppText>
      </Pressable>
    </View>
  );
}

function MiniStat({
  accent,
  icon,
  label,
  value,
}: {
  accent?: boolean;
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={[styles.miniStat, accent && styles.miniStatAccent]}>
      <Ionicons color={accent ? colors.primary : colors.textSubtle} name={icon as any} size={18} />
      <AppText numberOfLines={1} variant="bodySmall" weight="900">
        {value}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function ExerciseFilterBar({
  onSelect,
  options,
  selectedExerciseId,
}: {
  onSelect: (exerciseId: string | null) => void;
  options: ExerciseFilterOption[];
  selectedExerciseId: string | null;
}) {
  const [isOpen, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedOption = options.find((option) => option.id === selectedExerciseId) ?? null;
  const recentOptions = options.slice(0, 4);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) => option.name.toLowerCase().includes(normalizedQuery));
  const otherOptions = normalizedQuery
    ? filteredOptions
    : options.filter((option) => !recentOptions.some((recent) => recent.id === option.id));

  const chooseExercise = (exerciseId: string | null) => {
    onSelect(exerciseId);
    setOpen(false);
    setQuery('');
  };

  return (
    <AppCard style={styles.exerciseFilterCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">动作表现</AppText>
          <AppText tone="muted" variant="caption">
            按真实训练动作筛选趋势和记录
          </AppText>
        </View>
        <Tag label={selectedExerciseId ? '已筛选' : '总览'} tone={selectedExerciseId ? 'brand' : 'neutral'} />
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.actionSelector, pressed && styles.pressed]}
      >
        <View style={styles.trendTitleBlock}>
          <AppText variant="bodySmall" weight="900">
            {selectedOption?.name ?? '全部动作'}
          </AppText>
          <AppText tone="muted" variant="caption">
            默认查看总训练量，选择动作后收敛记录和趋势
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
      </Pressable>

      <AppModalSheet
        onClose={() => setOpen(false)}
        subtitle="搜索或选择真实练过的动作"
        title="选择动作"
        visible={isOpen}
      >
        <View style={styles.selectorSearch}>
          <Ionicons color={colors.textMuted} name="search-outline" size={16} />
          <TextInput
            onChangeText={setQuery}
            placeholder="搜索动作"
            placeholderTextColor={colors.textSubtle}
            style={styles.selectorInput}
            value={query}
          />
        </View>
        <ScrollView style={styles.selectorList} keyboardShouldPersistTaps="handled">
          <SelectorOption
            active={!selectedExerciseId}
            meta={`${options.length} 个动作 · 总训练量趋势`}
            name="全部动作"
            onPress={() => chooseExercise(null)}
          />
          {!normalizedQuery && recentOptions.length > 0 ? (
            <SelectorSection
              activeId={selectedExerciseId}
              onSelect={(id) => chooseExercise(id)}
              options={recentOptions}
              title="最近动作"
            />
          ) : null}
          <SelectorSection
            activeId={selectedExerciseId}
            emptyLabel="没有匹配动作"
            onSelect={(id) => chooseExercise(id)}
            options={otherOptions}
            title={normalizedQuery ? '搜索结果' : '全部动作'}
          />
        </ScrollView>
      </AppModalSheet>
    </AppCard>
  );
}

function SelectorSection({
  activeId,
  emptyLabel = '暂无动作',
  onSelect,
  options,
  title,
}: {
  activeId: string | null;
  emptyLabel?: string;
  onSelect: (exerciseId: string) => void;
  options: ExerciseFilterOption[];
  title: string;
}) {
  return (
    <View style={styles.selectorSection}>
      <AppText tone="muted" variant="caption" weight="900">
        {title}
      </AppText>
      {options.length === 0 ? (
        <AppText tone="muted" variant="bodySmall">
          {emptyLabel}
        </AppText>
      ) : (
        options.map((option) => (
          <SelectorOption
            active={activeId === option.id}
            key={option.id}
            meta="动作趋势与训练查询"
            name={option.name}
            onPress={() => onSelect(option.id)}
          />
        ))
      )}
    </View>
  );
}

function SelectorOption({
  active,
  meta,
  name,
  onPress,
}: {
  active: boolean;
  meta: string;
  name: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.selectorOption, active && styles.selectorOptionActive, pressed && styles.pressed]}
    >
      <View style={styles.selectorOptionText}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {name}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {meta}
        </AppText>
      </View>
      {active ? <Ionicons color={colors.primary} name="checkmark-circle" size={18} /> : null}
    </Pressable>
  );
}

function TrendChart({
  analysis,
  exerciseId,
  exerciseName,
  trend,
}: {
  analysis: HistoryAnalysis | null;
  exerciseId?: string;
  exerciseName?: string;
  trend: WeekTrendPoint[];
}) {
  const maxVolume = Math.max(1, ...trend.map((point) => point.volume));
  const primarySuggestion = analysis?.suggestions[0] ?? '完成更多训练后生成基础规则建议';

  return (
    <AppCard style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">训练趋势</AppText>
          <AppText tone="muted" variant="caption">
            近 7 天 · {exerciseName ?? '暂无重点动作'}
          </AppText>
        </View>
        {exerciseId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/history/exercise/[exerciseId]', params: { exerciseId } } as never)}
          >
            <Tag label="动作详情" tone="brand" />
          </Pressable>
        ) : analysis ? <Tag label="有趋势" tone="success" /> : <Tag label="积累中" tone="neutral" />}
      </View>

      <MiniLineChart
        chartHeight={96}
        data={trend.map((point) => point.volume)}
        emptyMessage="近 7 天还没有训练量"
        formatValue={(value) => `${Math.round(value / 1000)}k`}
        labels={trend.map((point) => point.label)}
        minChartHeight={maxVolume}
        unitLabel="kg"
      />

      <View style={styles.suggestionBox}>
        <AppText variant="bodySmall" weight="900">
          {primarySuggestion}
        </AppText>
      </View>

      {analysis ? (
        <View style={styles.trendDetailRow}>
          <View style={styles.trendDetailItem}>
            <AppText tone="muted" variant="caption">
              重量趋势
            </AppText>
            <AppText variant="caption" weight="900">
              {formatTrend(analysis.weightTrend)}
            </AppText>
          </View>
          <View style={styles.trendDetailItem}>
            <AppText tone="muted" variant="caption">
              完成率
            </AppText>
            <AppText variant="caption" weight="900">
              {formatPercent(analysis.completionRate)}
            </AppText>
          </View>
          <View style={styles.trendDetailItem}>
            <AppText tone="muted" variant="caption">
              疲劳
            </AppText>
            <AppText numberOfLines={1} variant="caption" weight="900">
              {analysis.fatigueFlags.length > 0 ? analysis.fatigueFlags.join('、') : '暂无'}
            </AppText>
          </View>
        </View>
      ) : null}
    </AppCard>
  );
}

function GroupHistoryView({
  analysis,
  memberProfilesById,
}: {
  analysis: GroupHistoryAnalysis | null;
  memberProfilesById: Record<string, MemberProfile | null>;
}) {
  if (!analysis) {
    return <EmptyState title="暂无小组训练数据" description="完成一次本地小组训练后，这里会显示小组汇总。" />;
  }

  return (
    <>
      <GroupOverviewCard analysis={analysis} />
      <GroupContributionCard analysis={analysis} memberProfilesById={memberProfilesById} />
      <GroupExercisePerformanceCard analysis={analysis} memberProfilesById={memberProfilesById} />
      <GroupTrendCard analysis={analysis} />
      <GroupRecentSessionsCard analysis={analysis} />
      <GroupInsightsCard analysis={analysis} />
    </>
  );
}

function GroupOverviewCard({ analysis }: { analysis: GroupHistoryAnalysis }) {
  return (
    <AppCard style={styles.groupOverviewCard} tone="dark">
      <View style={styles.groupOverviewHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText style={styles.overviewLabel} variant="caption">
            {analysis.groupName}
          </AppText>
          <AppText tone="inverse" variant="headline">
            {formatKg(analysis.totalVolume)}
          </AppText>
          <AppText style={styles.overviewLabel} variant="caption">
            近 {analysis.rangeDays} 天本机小组训练量
          </AppText>
        </View>
        <Tag label={`${analysis.activeMemberCount}/${analysis.memberCount} 成员`} tone="dark" />
      </View>

      <View style={styles.groupMetricRow}>
        <DarkMetric label="训练次数" value={`${analysis.sessionCount} 次`} />
        <View style={styles.overviewDivider} />
        <DarkMetric label="完成组数" value={`${analysis.completedSets} 组`} />
        <View style={styles.overviewDivider} />
        <DarkMetric label="完成率" value={formatPercent(analysis.completionRate)} />
      </View>
    </AppCard>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkMetric}>
      <AppText tone="inverse" variant="subtitle" weight="900">
        {value}
      </AppText>
      <AppText style={styles.overviewLabel} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function GroupContributionCard({
  analysis,
  memberProfilesById,
}: {
  analysis: GroupHistoryAnalysis;
  memberProfilesById: Record<string, MemberProfile | null>;
}) {
  return (
    <AppCard style={styles.groupCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">成员贡献</AppText>
          <AppText tone="muted" variant="caption">
            按近 7 天训练量排序
          </AppText>
        </View>
        <Tag label="本机数据" tone="neutral" />
      </View>

      <View style={styles.memberAvatarRow}>
        {analysis.memberContributions.slice(0, 4).map((member) => (
          <View key={member.memberId} style={styles.memberAvatarItem}>
            <View style={[styles.memberAvatarCircle, member.rank === 1 && styles.memberAvatarCircleTop]}>
              <Avatar
                avatarLocalUri={memberProfilesById[member.memberId]?.avatarLocalUri}
                avatarThumbUrl={memberProfilesById[member.memberId]?.avatarThumbUrl}
                avatarUrl={memberProfilesById[member.memberId]?.avatarUrl}
                name={member.memberName}
                size={46}
              />
            </View>
            <AppText numberOfLines={1} variant="caption" weight="900">
              {member.memberName}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.contributionList}>
        {analysis.memberContributions.map((member) => (
          <View key={member.memberId} style={styles.contributionRow}>
            <View style={[styles.rankBadge, member.rank === 1 && styles.rankBadgeTop]}>
              <AppText tone={member.rank === 1 ? 'inverse' : 'muted'} variant="caption" weight="900">
                {member.rank}
              </AppText>
            </View>
            <View style={styles.contributionName}>
              <AppText numberOfLines={1} variant="bodySmall" weight="900">
                {member.memberName}
              </AppText>
              <AppText tone="muted" variant="caption">
                {member.sessionCount} 次 · {member.completedSets}/{member.totalSets} 组 · {member.mostTrainedExerciseName ?? '待积累'}
              </AppText>
              <AppText numberOfLines={1} tone="muted" variant="caption">
                最佳动作 {member.bestExerciseName ?? '暂无'} · 最近 {member.lastTrainingDate ? formatShortDate(member.lastTrainingDate) : '暂无'}
              </AppText>
            </View>
            <View style={styles.contributionValue}>
              <AppText variant="bodySmall" weight="900">
                {formatKg(member.volume)}
              </AppText>
              <Tag
                label={member.statusLabel}
                tone={member.statusLabel === '优秀' ? 'success' : member.statusLabel === '良好' ? 'accent' : member.statusLabel === '一般' ? 'warning' : 'neutral'}
              />
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function GroupExercisePerformanceCard({
  analysis,
  memberProfilesById,
}: {
  analysis: GroupHistoryAnalysis;
  memberProfilesById: Record<string, MemberProfile | null>;
}) {
  const sortedAnalyses = analysis.exerciseAnalyses
    .slice()
    .sort(
      (left, right) =>
        right.sessionCount - left.sessionCount ||
        right.completedSets - left.completedSets ||
        right.members.reduce((sum, member) => sum + member.latestVolume, 0) -
          left.members.reduce((sum, member) => sum + member.latestVolume, 0),
    );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isSelectorOpen, setSelectorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const primary = sortedAnalyses.find((item) => item.key === selectedKey) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredAnalyses = sortedAnalyses.filter((item) => item.exerciseName.toLowerCase().includes(normalizedQuery));

  if (analysis.exerciseAnalyses.length === 0) {
    return (
      <AppCard style={styles.groupCard}>
        <View style={styles.trendHeader}>
          <View style={styles.trendTitleBlock}>
            <AppText variant="subtitle">动作表现</AppText>
            <AppText tone="muted" variant="caption">
              从真实训练动作中选择后查看多人对比
            </AppText>
          </View>
          <Tag label="待积累" tone="neutral" />
        </View>
        <View style={styles.inlineEmpty}>
          <Ionicons color={colors.textMuted} name="barbell-outline" size={20} />
          <AppText tone="muted" variant="bodySmall">
            完成主项训练后，这里会显示成员最好重量、最近容量和趋势。
          </AppText>
        </View>
      </AppCard>
    );
  }

  const chartIndexes = primary
    ? primary.labels
    .map((_, index) => index)
    .filter((index) => primary.trendSeries.some((series) => (series.values[index] ?? 0) > 0))
    .slice(-7)
    : [];
  const chartLabels = chartIndexes.map((sourceIndex, index) => primary?.labels[sourceIndex] ?? `第${index + 1}次`);
  const chartSeries = primary?.trendSeries.map((series) => ({
    label: series.memberName,
    values: chartIndexes.map((index) => series.values[index] ?? 0),
  })) ?? [];

  return (
    <AppCard style={styles.groupCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">{primary ? `${primary.exerciseName}训练容量趋势` : '动作表现'}</AppText>
          <AppText tone="muted" variant="caption">
            默认保留小组总览，选择动作后查看成员容量趋势
          </AppText>
        </View>
        <Tag label={primary ? `${primary.members.length} 名成员` : `${sortedAnalyses.length} 个动作`} tone={primary ? 'brand' : 'neutral'} />
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => setSelectorOpen(true)}
        style={({ pressed }) => [styles.actionSelector, pressed && styles.pressed]}
      >
        <View style={styles.trendTitleBlock}>
          <AppText variant="bodySmall" weight="900">
            {primary?.exerciseName ?? '全部动作'}
          </AppText>
          <AppText tone="muted" variant="caption">
            点击选择分析动作
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name="chevron-down" size={18} />
      </Pressable>

      <AppModalSheet
        onClose={() => setSelectorOpen(false)}
        subtitle="选择一个真实练过的动作查看多人对比"
        title="小组动作选择"
        visible={isSelectorOpen}
      >
        <View style={styles.selectorSearch}>
          <Ionicons color={colors.textMuted} name="search-outline" size={16} />
          <TextInput
            onChangeText={setQuery}
            placeholder="搜索动作"
            placeholderTextColor={colors.textSubtle}
            style={styles.selectorInput}
            value={query}
          />
        </View>
        <ScrollView style={styles.selectorList} keyboardShouldPersistTaps="handled">
          <SelectorOption
            active={!primary}
            meta={`${sortedAnalyses.length} 个动作 · 小组总览`}
            name="全部动作"
            onPress={() => {
              setSelectedKey(null);
              setSelectorOpen(false);
              setQuery('');
            }}
          />
          <View style={styles.selectorSection}>
            <AppText tone="muted" variant="caption" weight="900">
              {normalizedQuery ? '搜索结果' : '真实训练动作'}
            </AppText>
            {filteredAnalyses.length === 0 ? (
              <AppText tone="muted" variant="bodySmall">
                没有匹配动作
              </AppText>
            ) : (
              filteredAnalyses.map((item) => {
                const bestWeight = Math.max(0, ...item.members.map((member) => member.bestWeight ?? 0));
                return (
                  <SelectorOption
                    active={item.key === primary?.key}
                    key={item.key}
                    meta={`${item.sessionCount} 次 · ${item.members.length} 人 · ${
                      bestWeight > 0 ? `${bestWeight} kg` : '暂无重量'
                    }`}
                    name={item.exerciseName}
                    onPress={() => {
                      setSelectedKey(item.key);
                      setSelectorOpen(false);
                      setQuery('');
                    }}
                  />
                );
              })
            )}
          </View>
        </ScrollView>
      </AppModalSheet>

      {!primary ? (
        <View style={styles.inlineEmpty}>
          <Ionicons color={colors.textMuted} name="analytics-outline" size={20} />
          <AppText tone="muted" variant="bodySmall">
            当前默认展示小组总览。需要查看某个动作时，从上方选择器进入成员对比。
          </AppText>
        </View>
      ) : (
        <>
          <MultiLineTrendChart
            chartHeight={116}
            emptyMessage="近 7 天暂无动作容量"
            formatValue={(value) => `${Math.round(value / 1000)}k`}
            labels={chartLabels}
            series={chartSeries}
            unitLabel="kg"
          />

          <View style={styles.performanceList}>
            {primary.members.map((member) => (
          <Pressable
            accessibilityRole="button"
            key={member.memberId}
            onPress={() =>
              router.push({
                pathname: '/history/group-exercise/[exerciseId]',
                params: { exerciseId: primary.key },
              } as never)
            }
            style={({ pressed }) => [styles.performanceRow, pressed && styles.pressed]}
          >
            <Avatar
              avatarLocalUri={memberProfilesById[member.memberId]?.avatarLocalUri}
              avatarThumbUrl={memberProfilesById[member.memberId]?.avatarThumbUrl}
              avatarUrl={memberProfilesById[member.memberId]?.avatarUrl}
              name={member.memberName}
              size={36}
            />
            <View style={styles.performanceMain}>
              <AppText numberOfLines={1} variant="bodySmall" weight="900">
                {member.memberName}
              </AppText>
              <AppText numberOfLines={1} tone="muted" variant="caption">
                最近 {member.latestLabel ?? '暂无有效组'}
              </AppText>
            </View>
            <View style={styles.performanceMetrics}>
              <View style={styles.metricPill}>
                <AppText variant="caption" weight="900">
                  {member.bestWeight ? `${member.bestWeight} kg` : '暂无'}
                </AppText>
                <AppText tone="muted" variant="caption">
                  最好
                </AppText>
              </View>
              <View style={styles.metricPill}>
                <AppText variant="caption" weight="900">
                  {formatKg(member.latestVolume)}
                </AppText>
                <AppText tone="muted" variant="caption">
                  最近容量
                </AppText>
              </View>
              <Tag
                label={formatTrend(member.trend)}
                tone={member.trend === 'up' ? 'success' : member.trend === 'down' ? 'warning' : member.trend === 'stable' ? 'accent' : 'neutral'}
              />
            </View>
            <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
          </Pressable>
            ))}
          </View>
        </>
      )}
    </AppCard>
  );
}

function GroupTrendCard({ analysis }: { analysis: GroupHistoryAnalysis }) {
  const activeTrend = analysis.trend
    .filter((point) => point.volume > 0 || point.completedSets > 0)
    .slice(-7)
    .map((point, index) => ({ ...point, label: `第${index + 1}次` }));
  const maxVolume = Math.max(1, ...activeTrend.map((point) => point.volume));
  return (
    <AppCard style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">小组趋势</AppText>
          <AppText tone="muted" variant="caption">
            近 7 天训练量折线
          </AppText>
        </View>
        <Tag label={analysis.sessionCount > 0 ? '训练量' : '暂无训练'} tone={analysis.sessionCount > 0 ? 'brand' : 'neutral'} />
      </View>
      <MiniLineChart
        chartHeight={112}
        data={activeTrend.map((point) => point.volume)}
        emptyMessage="近 7 天还没有小组训练量"
        formatValue={(value) => `${Math.round(value / 1000)}k`}
        labels={activeTrend.map((point) => point.label)}
        minChartHeight={maxVolume}
        showValues
        unitLabel="kg"
      />
    </AppCard>
  );
}

function GroupRecentSessionsCard({ analysis }: { analysis: GroupHistoryAnalysis }) {
  return (
    <AppCard style={styles.groupCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">最近小组训练记录</AppText>
          <AppText tone="muted" variant="caption">
            按本机训练时间排序
          </AppText>
        </View>
        <Tag label={`${analysis.recentSessions.length} 条`} tone="neutral" />
      </View>

      {analysis.recentSessions.length === 0 ? (
        <View style={styles.inlineEmpty}>
          <Ionicons color={colors.textMuted} name="calendar-clear-outline" size={20} />
          <AppText tone="muted" variant="bodySmall">
            暂无小组训练记录
          </AppText>
        </View>
      ) : (
        <View style={styles.sessionList}>
          {analysis.recentSessions.map((session) => (
            <Pressable
              accessibilityRole="button"
              key={session.sessionId}
              onPress={() =>
                router.push({
                  pathname: '/history/[sessionId]',
                  params: { scope: 'group', sessionId: session.sessionId },
                } as never)
              }
              style={({ pressed }) => [styles.groupSessionRow, pressed && styles.pressed]}
            >
              <View style={styles.sessionIcon}>
                <Ionicons color={colors.primary} name="barbell-outline" size={18} />
              </View>
              <View style={styles.groupSessionText}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">
                  {session.title}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {formatShortDate(session.date)} · {session.exerciseCount} 动作 · {session.completedMembers}/{session.totalMembers} 完成
                </AppText>
              </View>
              <View style={styles.groupSessionRight}>
                <AppText variant="bodySmall" weight="900">
                  {formatKg(session.volume)}
                </AppText>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
              </View>
            </Pressable>
          ))}
        </View>
      )}
    </AppCard>
  );
}

function GroupInsightsCard({ analysis }: { analysis: GroupHistoryAnalysis }) {
  return (
    <AppCard style={styles.groupInsightsCard} tone="brand">
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">小组洞察</AppText>
          <AppText tone="muted" variant="caption">
            基于本机小组训练记录
          </AppText>
        </View>
        <Ionicons color={colors.primary} name="analytics-outline" size={22} />
      </View>
      <View style={styles.insightList}>
        {analysis.insights.map((insight) => (
          <View key={insight} style={styles.insightRow}>
            <View style={styles.insightDot} />
            <AppText variant="bodySmall" weight="900">
              {insight}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function CalendarWeek({
  monthCursor,
  onOpenMonth,
  onSelectDate,
  selectedDate,
  trainingDates,
  weekDates,
}: {
  monthCursor: Date;
  onOpenMonth: () => void;
  onSelectDate: (date: string) => void;
  selectedDate: string;
  trainingDates: Set<string>;
  weekDates: Date[];
}) {
  return (
    <AppCard style={styles.calCard}>
      <View style={styles.calHeader}>
        <AppText variant="subtitle">{formatMonthLabel(new Date(`${selectedDate}T12:00:00`))}</AppText>
        <Pressable accessibilityRole="button" onPress={onOpenMonth} style={styles.calMonthBtn}>
          <AppText variant="caption" weight="900">
            月视图
          </AppText>
          <Ionicons color={colors.primary} name="chevron-forward-outline" size={14} />
        </Pressable>
      </View>
      <View style={styles.calWeekRow}>
        {weekDates.map((date) => {
          const key = getLocalDateString(date);
          const active = key === selectedDate;
          const hasTraining = trainingDates.has(key);
          return (
            <Pressable
              accessibilityRole="button"
              key={key}
              onPress={() => onSelectDate(key)}
              style={[styles.calDay, active && styles.calDayActive]}
            >
              <AppText tone={active ? 'inverse' : 'muted'} variant="caption">
                {'日一二三四五六'[date.getDay()]}
              </AppText>
              <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                {date.getDate()}
              </AppText>
              <View style={[styles.calDot, hasTraining && !active && styles.calDotTrained, active && styles.calDotInverse]} />
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

function CompactSessionCard({ memberId, summary }: { memberId?: string; summary: SessionSummary }) {
  const session = summary.session;
  const detailRoute = {
    pathname: '/history/[sessionId]',
    params: {
      ...(memberId ? { memberId, scope: 'personal' } : { scope: 'group' }),
      sessionId: session.id,
    },
  } as never;
  const completed = session.status === 'completed';

  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(detailRoute)} style={({ pressed }) => [styles.compactCard, pressed && styles.pressed]}>
      <View style={styles.compactLeft}>
        <AppText variant="caption" weight="900">
          {formatShortDate(session.date)}
        </AppText>
        <View style={[styles.compactStatusDot, completed ? styles.compactStatusDone : styles.compactStatusOngoing]} />
      </View>
      <View style={styles.compactCenter}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {summary.exerciseCount} 个动作 · {summary.setCount} 组
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {summary.mainExerciseNames.slice(0, 2).join('、') || '训练记录'}
        </AppText>
      </View>
      <View style={styles.compactRight}>
        <AppText variant="bodySmall" weight="900">
          {formatKg(summary.volume)}
        </AppText>
        <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionSelector: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  exerciseFilterCard: {
    gap: spacing.md,
  },
  exerciseFilterChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: '48%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exerciseFilterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  exerciseFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exerciseFilterText: {
    color: colors.textMuted,
  },
  exerciseFilterTextActive: {
    color: colors.surface,
  },
  selectorInput: {
    color: colors.textStrong,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    minHeight: 42,
  },
  selectorList: {
    maxHeight: 360,
  },
  selectorOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  selectorOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectorOptionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  selectorSearch: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  selectorSection: {
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  headerCalBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },

  scopeBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  scopeInfo: {
    flex: 1,
  },
  scopePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    padding: 2,
  },
  scopePillBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  scopePillBtnActive: {
    backgroundColor: colors.primary,
  },

  overviewCard: {
    gap: spacing.lg,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    justifyContent: 'space-between',
  },
  overviewMain: {
    flex: 1,
    gap: spacing.xs,
  },
  overviewLabel: {
    color: colors.darkMuted,
  },
  overviewSide: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  overviewMetric: {
    alignItems: 'center',
    gap: 2,
  },
  overviewDivider: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    height: 28,
    width: 1,
  },
  groupOverviewCard: {
    gap: spacing.lg,
  },
  groupOverviewHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  groupMetricRow: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingTop: spacing.md,
  },
  darkMetric: {
    flex: 1,
    gap: 2,
  },

  quickActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  quickBtnIcon: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },

  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  miniStat: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  miniStatAccent: {
    borderColor: colors.primarySoft,
  },

  trendCard: {
    gap: spacing.md,
  },
  trendHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  trendTitleBlock: {
    flex: 1,
    gap: 2,
  },
  suggestionBox: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
  trendDetailRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  trendDetailItem: {
    flex: 1,
    gap: 2,
  },

  calCard: {
    gap: spacing.md,
  },
  calHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  calMonthBtn: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  calWeekRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  calDay: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    gap: 2,
    minHeight: 58,
    paddingVertical: spacing.sm,
  },
  calDayActive: {
    backgroundColor: colors.primary,
  },
  calDot: {
    borderRadius: radius.pill,
    height: 5,
    width: 5,
  },
  calDotTrained: {
    backgroundColor: colors.primary,
  },
  calDotInverse: {
    backgroundColor: colors.surface,
  },

  emptyDayCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyDayText: {
    flex: 1,
    gap: 2,
  },

  sessionList: {
    gap: spacing.sm,
  },
  compactCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  compactLeft: {
    alignItems: 'center',
    gap: spacing.xs,
    width: 40,
  },
  compactStatusDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  compactStatusDone: {
    backgroundColor: colors.success,
  },
  compactStatusOngoing: {
    backgroundColor: colors.warning,
  },
  compactCenter: {
    flex: 1,
    gap: 2,
  },
  compactRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  groupCard: {
    gap: spacing.md,
  },
  memberAvatarRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-around',
  },
  memberAvatarItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  memberAvatarCircle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  memberAvatarCircleTop: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  contributionList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  contributionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  rankBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  rankBadgeTop: {
    backgroundColor: colors.primary,
  },
  contributionName: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  contributionValue: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  exerciseSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exerciseSummaryChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  exerciseSummaryChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  performanceList: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
  },
  performanceRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  performanceMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  performanceMetrics: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
    maxWidth: '62%',
  },
  metricPill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    gap: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  sessionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  groupSessionRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  groupSessionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  groupSessionRight: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  groupInsightsCard: {
    gap: spacing.md,
  },
  insightList: {
    gap: spacing.sm,
  },
  insightRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  insightDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  modalBackdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  monthPanel: {
    gap: spacing.lg,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  modalNavBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  weekdayLabel: {
    textAlign: 'center',
    width: '12.5%',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  monthDay: {
    alignItems: 'center',
    borderRadius: radius.sm,
    gap: spacing.xs,
    minHeight: 44,
    paddingVertical: spacing.sm,
    width: '12.5%',
  },
  monthDayActive: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
});
