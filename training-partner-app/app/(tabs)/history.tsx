import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import {
  analyzeExerciseHistory,
  estimateOneRM,
  selectLargestExerciseSeries,
  type HistoryAnalysis,
  type HistorySetEntry,
} from '@/domain/history/history-analysis';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSession, WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, shadows, spacing } from '@/theme';

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
  date: string;
  volume: number;
};

type HistoryState = {
  analysis: HistoryAnalysis | null;
  currentMember: GroupMember | null;
  exercise: Exercise | null;
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
        rir: set.rir,
        rpe: set.rpe,
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

function buildWeeklyTrend(startDate: Date, summaries: SessionSummary[]): WeekTrendPoint[] {
  const byDate = new Map<string, number>();
  summaries.forEach((summary) => {
    byDate.set(summary.session.date, (byDate.get(summary.session.date) ?? 0) + summary.volume);
  });

  return Array.from({ length: 7 }, (_, index) => {
    const date = getLocalDateString(addDays(startDate, index));
    return {
      date,
      volume: byDate.get(date) ?? 0,
    };
  });
}

export default function HistoryRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [isMonthVisible, setMonthVisible] = useState(false);
  const [dataScope, setDataScope] = useState<DataScope>('personal');
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
      const group = await repositories.groupRepository.getDefaultGroup();
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }

      const members = await repositories.memberRepository.listMembers(group.id);
      const currentMember = members[0] ?? null;
      if (!currentMember) {
        setHistory(createEmptyHistory());
        return;
      }

      const monthStart = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 12));
      const monthEnd = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 12));
      const sevenDaysAgo = addDays(new Date(), -6);
      const weekStart = getLocalDateString(sevenDaysAgo);
      const [recentSessions, selectedSessions, monthSessions, weekSessions] = await Promise.all([
        repositories.workoutRepository.listSessions({ groupId: group.id, memberId: currentMember.id, limit: 10 }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          memberId: currentMember.id,
          fromDate: selectedDate,
          toDate: selectedDate,
          limit: 30,
        }),
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
          toDate: getLocalDateString(),
          limit: 200,
        }),
      ]);
      const [recentDetails, selectedDetails, weekDetails] = await Promise.all([
        Promise.all(recentSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
        Promise.all(selectedSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
        Promise.all(weekSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
      ]);
      const recentEntries = recentDetails.flatMap((detail) => getMemberEntries(detail, currentMember.id));
      const series = selectLargestExerciseSeries(recentEntries);
      const analysis = series ? analyzeExerciseHistory(series.entries) : null;
      const exercise = series
        ? (await repositories.exerciseRepository.listExercisesByIds([series.exerciseId]))[0] ?? null
        : null;
      const summaryExerciseIds = Array.from(
        new Set(
          [...recentDetails, ...selectedDetails, ...weekDetails].flatMap((detail) =>
            detail.exercises.map((exerciseRecord) => exerciseRecord.exerciseId),
          ),
        ),
      );
      const summaryExercises = await repositories.exerciseRepository.listExercisesByIds(summaryExerciseIds);
      const exerciseNamesById = Object.fromEntries(summaryExercises.map((exerciseItem) => [exerciseItem.id, exerciseItem.name]));
      const weeklySummaries = weekDetails.map((detail) => summarizeSession(detail, currentMember.id, exerciseNamesById));

      setHistory({
        analysis,
        currentMember,
        exercise,
        monthlyTrainingDates: new Set(monthSessions.map((session) => session.date)),
        recentSessions: recentDetails.map((detail) => summarizeSession(detail, currentMember.id, exerciseNamesById)),
        selectedDateSessions: selectedDetails.map((detail) => summarizeSession(detail, currentMember.id, exerciseNamesById)),
        weeklyCompletedSets: weeklySummaries.reduce((sum, summary) => sum + summary.setCount, 0),
        weeklySessionCount: weeklySummaries.filter((summary) => summary.setCount > 0).length,
        weeklyTrend: buildWeeklyTrend(sevenDaysAgo, weeklySummaries),
        weeklyVolume: weeklySummaries.reduce((sum, summary) => sum + summary.volume, 0),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '历史记录加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [authMode, monthCursor, repositories, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthDates = useMemo(() => getMonthDates(monthCursor), [monthCursor]);

  const openRecentForEdit = useCallback(() => {
    if (!guardFeature('manual_history')) {
      return;
    }

    const latest = history.recentSessions[0]?.session;
    if (!latest) {
      Alert.alert('暂无训练', '完成或补录一次训练后，就可以编辑最近训练。');
      return;
    }

    router.push({ pathname: '/history/[sessionId]', params: { sessionId: latest.id } } as never);
  }, [guardFeature, history.recentSessions]);

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
                <MiniStat icon="time-outline" label="最近训练" value={history.recentSessions[0] ? formatShortDate(history.recentSessions[0].session.date) : '暂无'} />
              </View>

              <TrendChart analysis={history.analysis} exerciseName={history.exercise?.name} trend={history.weeklyTrend} />

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
                title={`${formatShortDate(selectedDate)} 训练`}
              />
              {history.selectedDateSessions.length === 0 ? (
                <AppCard style={styles.emptyDayCard} tone="soft">
                  <Ionicons color={colors.textSubtle} name="calendar-clear-outline" size={20} />
                  <View style={styles.emptyDayText}>
                    <AppText variant="bodySmall" weight="900">
                      当天暂无训练
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      点击「补录」添加已完成的训练
                    </AppText>
                  </View>
                </AppCard>
              ) : (
                <View style={styles.sessionList}>
                  {history.selectedDateSessions.map((summary) => (
                    <CompactSessionCard key={summary.session.id} summary={summary} />
                  ))}
                </View>
              )}

              <SectionHeader
                actionLabel="全部"
                onActionPress={() => {
                  if (guardFeature('manual_history')) router.push('/history/manual' as never);
                }}
                subtitle={`${history.recentSessions.length} 条`}
                title="最近训练"
              />
              {history.recentSessions.length === 0 ? (
                <EmptyState
                  actionLabel="去训练"
                  description="完成一次训练后，这里会显示训练摘要和趋势。"
                  onActionPress={() => {
                    if (guardFeature('start_workout')) router.push('/(tabs)/today');
                  }}
                  title="还没有训练记录"
                />
              ) : (
                <View style={styles.sessionList}>
                  {history.recentSessions.slice(0, 8).map((summary) => (
                    <CompactSessionCard key={summary.session.id} summary={summary} />
                  ))}
                </View>
              )}
            </>
          ) : (
            <AppCard style={styles.groupPendingCard} tone="soft">
              <Tag label="开发中" tone="warning" />
              <AppText variant="subtitle">小组汇总功能开发中</AppText>
              <AppText tone="muted" variant="bodySmall">
                当前版本仅统计本机当前成员数据，不会把个人数据和小组数据混在一起。
              </AppText>
            </AppCard>
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
          <Ionicons color={colors.accent} name="create-outline" size={16} />
        </View>
        <AppText variant="bodySmall" weight="900">
          编辑最近
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

function TrendChart({
  analysis,
  exerciseName,
  trend,
}: {
  analysis: HistoryAnalysis | null;
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
        {analysis ? <Tag label="有趋势" tone="success" /> : <Tag label="积累中" tone="neutral" />}
      </View>

      <View style={styles.barChart}>
        {trend.map((point) => {
          const barHeight = point.volume > 0 ? 20 + Math.round((point.volume / maxVolume) * 60) : 6;
          return (
            <View key={point.date} style={styles.barCol}>
              <View style={styles.barWrap}>
                <View style={[styles.bar, point.volume === 0 && styles.barEmpty, { height: barHeight }]} />
              </View>
              <AppText tone="muted" variant="caption">
                {formatShortDate(point.date).slice(3)}
              </AppText>
            </View>
          );
        })}
      </View>

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

function CompactSessionCard({ summary }: { summary: SessionSummary }) {
  const session = summary.session;
  const detailRoute = { pathname: '/history/[sessionId]', params: { sessionId: session.id } } as never;
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
  barChart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
    height: 100,
  },
  barCol: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  barWrap: {
    width: '100%',
    alignItems: 'center',
  },
  bar: {
    backgroundColor: colors.primary,
    borderRadius: radius.xs,
    width: '70%',
  },
  barEmpty: {
    backgroundColor: colors.border,
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

  groupPendingCard: {
    gap: spacing.sm,
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
