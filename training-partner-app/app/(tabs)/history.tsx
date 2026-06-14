import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import {
  analyzeExerciseHistory,
  selectLargestExerciseSeries,
  type HistoryAnalysis,
  type HistorySetEntry,
} from '@/domain/history/history-analysis';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSession, WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

type DataScope = 'personal' | 'group';

type SessionSummary = {
  durationMinutes?: number;
  exerciseCount: number;
  session: WorkoutSession;
  setCount: number;
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

function summarizeSession(detail: WorkoutSessionDetail, memberId: string): SessionSummary {
  const memberSets = detail.sets.filter((set) => set.memberId === memberId && set.completed);
  const exerciseIds = new Set(
    memberSets.map((set) => detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId)?.exerciseId ?? set.exerciseRecordId),
  );

  return {
    durationMinutes: getDurationMinutes(detail.session),
    exerciseCount: exerciseIds.size,
    session: detail.session,
    setCount: memberSets.length,
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
      const weeklySummaries = weekDetails.map((detail) => summarizeSession(detail, currentMember.id));

      setHistory({
        analysis,
        currentMember,
        exercise,
        monthlyTrainingDates: new Set(monthSessions.map((session) => session.date)),
        recentSessions: recentDetails.map((detail) => summarizeSession(detail, currentMember.id)),
        selectedDateSessions: selectedDetails.map((detail) => summarizeSession(detail, currentMember.id)),
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
  }, [monthCursor, repositories, selectedDate]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthDates = useMemo(() => getMonthDates(monthCursor), [monthCursor]);

  const openRecentForEdit = useCallback(() => {
    const latest = history.recentSessions[0]?.session;
    if (!latest) {
      Alert.alert('暂无训练', '完成或补录一次训练后，就可以编辑最近训练。');
      return;
    }

    router.push({ pathname: '/history/[sessionId]', params: { sessionId: latest.id } } as never);
  }, [history.recentSessions]);

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => setMonthVisible(true)} style={styles.iconButton}>
          <Ionicons color={colors.text} name="calendar-outline" size={22} />
        </Pressable>
      }
      subtitle={
        history.currentMember
          ? `当前成员：${history.currentMember.displayName} · 默认显示个人数据`
          : '默认统计当前本地成员个人数据'
      }
      title="记录"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="历史记录暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <ScopeStrip dataScope={dataScope} memberName={history.currentMember?.displayName ?? '暂无成员'} setDataScope={setDataScope} />

          {dataScope === 'personal' ? (
            <>
              <OverviewPanel history={history} onEditRecent={openRecentForEdit} />

              <View style={styles.statGrid}>
                <StatTile label="我的本周训练次数" value={`${history.weeklySessionCount} 次`} />
                <StatTile label="我的本周完成组数" value={`${history.weeklyCompletedSets} 组`} />
                <StatTile label="最近一次训练" value={history.recentSessions[0]?.session.date ?? '暂无'} />
                <StatTile label="本周训练口径" value="当前成员" />
              </View>

              <AnalysisPanel analysis={history.analysis} exerciseName={history.exercise?.name} trend={history.weeklyTrend} />

              <AppCard style={styles.calendarCard}>
                <View style={styles.calendarHeader}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setSelectedDate(getLocalDateString(addDays(new Date(`${selectedDate}T12:00:00`), -7)))}
                    style={styles.smallIconButton}
                  >
                    <Ionicons color={colors.text} name="chevron-back-outline" size={18} />
                  </Pressable>
                  <View style={styles.calendarTitle}>
                    <AppText variant="subtitle">{formatMonthLabel(new Date(`${selectedDate}T12:00:00`))}</AppText>
                    <AppText tone="muted" variant="caption">
                      点击日期查看当天我的训练记录
                    </AppText>
                  </View>
                  <Pressable accessibilityRole="button" onPress={() => setMonthVisible(true)} style={styles.smallIconButton}>
                    <Ionicons color={colors.text} name="options-outline" size={18} />
                  </Pressable>
                </View>
                <View style={styles.weekRow}>
                  {weekDates.map((date) => {
                    const key = getLocalDateString(date);
                    const active = key === selectedDate;
                    const hasTraining =
                      history.monthlyTrainingDates.has(key) || history.recentSessions.some((summary) => summary.session.date === key);
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={key}
                        onPress={() => setSelectedDate(key)}
                        style={[styles.dateCell, active && styles.dateCellActive]}
                      >
                        <AppText tone={active ? 'inverse' : 'muted'} variant="caption">
                          {'日一二三四五六'[date.getDay()]}
                        </AppText>
                        <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                          {date.getDate()}
                        </AppText>
                        <View style={[styles.dot, hasTraining && styles.dotActive, active && styles.dotActiveInverse]} />
                      </Pressable>
                    );
                  })}
                </View>
              </AppCard>

              <SectionHeader
                actionLabel="补录"
                onActionPress={() => router.push({ pathname: '/history/manual', params: { date: selectedDate } } as never)}
                title={`${selectedDate} 我的训练`}
              />
              {history.selectedDateSessions.length === 0 ? (
                <AppCard style={styles.emptyCard} tone="soft">
                  <Ionicons color={colors.textMuted} name="calendar-clear-outline" size={24} />
                  <View style={styles.emptyText}>
                    <AppText variant="bodySmall" weight="900">
                      这一天暂无训练记录
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      可以补录过去完成的训练，休息时间允许留空。
                    </AppText>
                  </View>
                </AppCard>
              ) : (
                <View style={styles.sessionList}>
                  {history.selectedDateSessions.map((summary) => (
                    <SessionCard key={summary.session.id} memberName={history.currentMember?.displayName ?? '成员'} summary={summary} />
                  ))}
                </View>
              )}

              {history.recentSessions.length > 0 ? (
                <>
                  <SectionHeader actionLabel="月视图" onActionPress={() => setMonthVisible(true)} title="最近训练记录" />
                  <View style={styles.sessionList}>
                    {history.recentSessions.slice(0, 6).map((summary) => (
                      <SessionCard key={summary.session.id} memberName={history.currentMember?.displayName ?? '成员'} summary={summary} />
                    ))}
                  </View>
                </>
              ) : null}
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
      ) : null}

      <Modal animationType="slide" transparent visible={isMonthVisible} onRequestClose={() => setMonthVisible(false)}>
        <View style={styles.modalBackdrop}>
          <AppCard style={styles.monthPanel}>
            <View style={styles.calendarHeader}>
              <Pressable accessibilityRole="button" onPress={() => setMonthCursor((current) => addMonths(current, -1))} style={styles.smallIconButton}>
                <Ionicons color={colors.text} name="chevron-back-outline" size={20} />
              </Pressable>
              <AppText variant="subtitle">{formatMonthLabel(monthCursor)}</AppText>
              <Pressable accessibilityRole="button" onPress={() => setMonthCursor((current) => addMonths(current, 1))} style={styles.smallIconButton}>
                <Ionicons color={colors.text} name="chevron-forward-outline" size={20} />
              </Pressable>
            </View>
            <View style={styles.monthGrid}>
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
                    style={[styles.monthDay, active && styles.dateCellActive]}
                  >
                    <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                      {date.getDate()}
                    </AppText>
                    <View style={[styles.dot, hasTraining && styles.dotActive, active && styles.dotActiveInverse]} />
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
    </Screen>
  );
}

function ScopeStrip({
  dataScope,
  memberName,
  setDataScope,
}: {
  dataScope: DataScope;
  memberName: string;
  setDataScope: (scope: DataScope) => void;
}) {
  return (
    <AppCard style={styles.scopeCard}>
      <View style={styles.scopeText}>
        <AppText variant="bodySmall" weight="900">
          当前成员：{memberName}
        </AppText>
        <AppText tone="muted" variant="caption">
          记录页默认展示当前成员个人数据
        </AppText>
      </View>
      <View style={styles.scopeSwitch}>
        <ScopeButton active={dataScope === 'personal'} label="我的数据" onPress={() => setDataScope('personal')} />
        <ScopeButton active={dataScope === 'group'} label="小组汇总" onPress={() => setDataScope('group')} />
      </View>
    </AppCard>
  );
}

function ScopeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.scopeButton, active && styles.scopeButtonActive]}>
      <AppText tone={active ? 'inverse' : 'muted'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function OverviewPanel({ history, onEditRecent }: { history: HistoryState; onEditRecent: () => void }) {
  return (
    <AppCard style={styles.overviewCard} tone="dark">
      <View style={styles.overviewTop}>
        <View style={styles.overviewMain}>
          <AppText style={styles.darkMutedText} variant="bodySmall">
            我的本周训练量
          </AppText>
          <AppText tone="inverse" variant="headline">
            {formatKg(history.weeklyVolume)}
          </AppText>
          <AppText style={styles.darkMutedText} variant="caption">
            当前成员：{history.currentMember?.displayName ?? '暂无成员'}
          </AppText>
        </View>
        <View style={styles.overviewSide}>
          <DarkStat label="训练" value={`${history.weeklySessionCount} 次`} />
          <DarkStat label="完成" value={`${history.weeklyCompletedSets} 组`} />
        </View>
      </View>
      <View style={styles.overviewActions}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/history/manual' as never)} style={styles.darkAction}>
          <Ionicons color={colors.surface} name="add-outline" size={16} />
          <AppText tone="inverse" variant="caption">
            补录训练
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onEditRecent} style={styles.darkAction}>
          <Ionicons color={colors.surface} name="create-outline" size={16} />
          <AppText tone="inverse" variant="caption">
            编辑最近
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

function DarkStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkStat}>
      <AppText tone="inverse" variant="subtitle">
        {value}
      </AppText>
      <AppText style={styles.darkMutedText} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <AppCard style={styles.statTile}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="subtitle">{value}</AppText>
    </AppCard>
  );
}

function AnalysisPanel({
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
    <AppCard style={styles.analysisCard}>
      <View style={styles.analysisHeader}>
        <View>
          <AppText variant="subtitle">训练趋势</AppText>
          <AppText tone="muted" variant="caption">
            近 7 天总量 · {exerciseName ?? '暂无重点动作'}
          </AppText>
        </View>
        <Tag label="基础规则建议" tone="warning" />
      </View>
      <View style={styles.analysisBody}>
        <View style={styles.trendBars}>
          {trend.length === 0
            ? Array.from({ length: 7 }, (_, index) => <View key={index} style={styles.emptyBar} />)
            : trend.map((point) => (
                <View key={point.date} style={styles.barColumn}>
                  <View style={[styles.trendBar, { height: 24 + Math.round((point.volume / maxVolume) * 68) }]} />
                  <AppText tone="muted" variant="caption">
                    {formatShortDate(point.date).slice(3)}
                  </AppText>
                </View>
              ))}
        </View>
        <View style={styles.analysisSummary}>
          <AppText variant="bodySmall" weight="900">
            {primarySuggestion}
          </AppText>
          <AppText tone="muted" variant="caption">
            明确标注：这是基础规则建议，不是 AI 预测。
          </AppText>
        </View>
      </View>
      {analysis ? (
        <View style={styles.trendRows}>
          <TrendRow label="重量趋势" value={formatTrend(analysis.weightTrend)} />
          <TrendRow label="完成率" value={formatPercent(analysis.completionRate)} />
          <TrendRow label="疲劳提示" value={analysis.fatigueFlags.length > 0 ? analysis.fatigueFlags.join('、') : '暂无明显疲劳提示'} />
        </View>
      ) : null}
    </AppCard>
  );
}

function SessionCard({ memberName, summary }: { memberName: string; summary: SessionSummary }) {
  const session = summary.session;
  const detailRoute = { pathname: '/history/[sessionId]', params: { sessionId: session.id } } as never;
  return (
    <AppCard style={styles.sessionCard}>
      <View style={styles.sessionDatePill}>
        <AppText tone="inverse" variant="caption">
          {formatShortDate(session.date)}
        </AppText>
      </View>
      <View style={styles.sessionBody}>
        <View style={styles.sessionTop}>
          <View style={styles.sessionTitleBlock}>
            <AppText variant="bodySmall" weight="900">
              {session.title}
            </AppText>
            <AppText tone="muted" variant="caption">
              {memberName} · {summary.exerciseCount} 动作 · {summary.setCount} 组
            </AppText>
          </View>
          <Tag label={session.status === 'completed' ? '已完成' : '进行中'} tone={session.status === 'completed' ? 'success' : 'warning'} />
        </View>
        <View style={styles.sessionMetaRow}>
          <AppText tone="muted" variant="caption">
            {formatKg(summary.volume)}
          </AppText>
          {summary.durationMinutes ? (
            <AppText tone="muted" variant="caption">
              {summary.durationMinutes} 分钟
            </AppText>
          ) : null}
        </View>
        <View style={styles.sessionActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push(detailRoute)} style={styles.sessionActionButton}>
            <AppText variant="caption" weight="900">
              查看
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push(detailRoute)} style={styles.sessionActionButton}>
            <AppText variant="caption" weight="900">
              编辑
            </AppText>
          </Pressable>
        </View>
      </View>
    </AppCard>
  );
}

function TrendRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.trendRow}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="caption" weight="900">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
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
  smallIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  scopeCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  scopeText: {
    flex: 1,
    gap: 2,
  },
  scopeSwitch: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: 'row',
    padding: 3,
    width: 160,
  },
  scopeButton: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  scopeButtonActive: {
    backgroundColor: colors.primary,
  },
  overviewCard: {
    gap: spacing.lg,
  },
  overviewTop: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  overviewMain: {
    flex: 1,
    gap: spacing.xs,
  },
  overviewSide: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  darkMutedText: {
    color: colors.darkMuted,
  },
  darkStat: {
    alignItems: 'center',
    gap: 2,
    minWidth: 66,
  },
  overviewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  darkAction: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  statTile: {
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    minHeight: 86,
    padding: spacing.md,
  },
  analysisCard: {
    gap: spacing.md,
  },
  analysisHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  analysisBody: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  trendBars: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 104,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  trendBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    width: '72%',
  },
  emptyBar: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    flex: 1,
    height: 32,
  },
  analysisSummary: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'center',
  },
  trendRows: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  trendRow: {
    flex: 1,
    gap: 2,
  },
  calendarCard: {
    gap: spacing.md,
  },
  calendarHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  calendarTitle: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  weekRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'space-between',
  },
  dateCell: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    gap: 2,
    minHeight: 62,
    paddingVertical: spacing.sm,
  },
  dateCellActive: {
    backgroundColor: colors.primary,
  },
  dot: {
    backgroundColor: colors.transparent,
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  dotActiveInverse: {
    backgroundColor: colors.surface,
  },
  emptyCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  emptyText: {
    flex: 1,
    gap: 2,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionCard: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  sessionDatePill: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.md,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 56,
    paddingHorizontal: spacing.sm,
  },
  sessionBody: {
    flex: 1,
    gap: spacing.sm,
  },
  sessionTop: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sessionTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sessionMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  sessionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sessionActionButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  monthDay: {
    alignItems: 'center',
    borderRadius: radius.md,
    gap: spacing.xs,
    minHeight: 48,
    paddingVertical: spacing.sm,
    width: '13.4%',
  },
});
