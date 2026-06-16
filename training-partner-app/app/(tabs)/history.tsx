import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import {
  estimateOneRM,
  getGroupHistoryAnalysis,
  getPersonalHistoryAnalysis,
  type GroupHistoryAnalysis,
  type PersonalHistoryAnalysis,
  type WeeklyHistoryBucket,
} from '@/domain/history/history-analysis';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSession, WorkoutSessionDetail } from '@/domain/workout/workout.types';
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

type HistoryState = {
  currentMember: GroupMember | null;
  groupAnalysis: GroupHistoryAnalysis | null;
  monthlyTrainingDates: Set<string>;
  personalAnalysis: PersonalHistoryAnalysis | null;
  recentSessions: SessionSummary[];
};

function createEmptyHistory(currentMember: GroupMember | null = null): HistoryState {
  return {
    currentMember,
    groupAnalysis: null,
    monthlyTrainingDates: new Set<string>(),
    personalAnalysis: null,
    recentSessions: [],
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

function formatSignedPercent(value?: number): string {
  if (value === undefined || Math.abs(value) < 3) {
    return '持平';
  }

  return `${value > 0 ? '+' : ''}${value}%`;
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

function summarizeSession(
  detail: WorkoutSessionDetail,
  memberId: string,
  exerciseNamesById: Record<string, string> = {},
): SessionSummary {
  const memberSets = detail.sets.filter((set) => set.memberId === memberId && set.completed);
  const completedRecordIds = new Set(memberSets.map((set) => set.exerciseRecordId));
  const exerciseIds = new Set(
    memberSets.map((set) => detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId)?.exerciseId ?? set.exerciseRecordId),
  );
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

function collectExerciseIds(details: WorkoutSessionDetail[]): string[] {
  return Array.from(new Set(details.flatMap((detail) => detail.exercises.map((exercise) => exercise.exerciseId))));
}

export default function HistoryRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [monthCursor, setMonthCursor] = useState(new Date());
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

      const today = getLocalDateString();
      const analysisStart = getLocalDateString(addDays(new Date(), -55));
      const monthStart = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 12));
      const monthEnd = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 12));
      const [analysisSessions, monthSessions] = await Promise.all([
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          memberId: currentMember.id,
          fromDate: analysisStart,
          toDate: today,
          limit: 400,
        }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          memberId: currentMember.id,
          fromDate: monthStart,
          toDate: monthEnd,
          limit: 200,
        }),
      ]);

      const analysisDetails = await Promise.all(analysisSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
      const exerciseIds = collectExerciseIds(analysisDetails);
      const exercises = await repositories.exerciseRepository.listExercisesByIds(exerciseIds);
      const exerciseNamesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise.name]));
      const personalAnalysis = getPersonalHistoryAnalysis(analysisDetails, currentMember.id, exerciseNamesById, 4);
      const recentSummaries = analysisDetails
        .map((detail) => summarizeSession(detail, currentMember.id, exerciseNamesById))
        .filter((summary) => summary.setCount > 0)
        .sort((left, right) => `${right.session.date} ${right.session.updatedAt}`.localeCompare(`${left.session.date} ${left.session.updatedAt}`));

      setHistory({
        currentMember,
        groupAnalysis: getGroupHistoryAnalysis(group.id, 4),
        monthlyTrainingDates: new Set(monthSessions.map((session) => session.date)),
        personalAnalysis,
        recentSessions: recentSummaries,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '历史记录加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [monthCursor, repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const monthDates = useMemo(() => getMonthDates(monthCursor), [monthCursor]);

  return (
    <Screen
      headerRight={
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/history/manual', params: { date: selectedDate } } as never)}
          style={styles.iconButton}
        >
          <Ionicons color={colors.text} name="add-outline" size={22} />
        </Pressable>
      }
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="历史记录暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <ScopeSegment
            dataScope={dataScope}
            memberName={history.currentMember?.displayName ?? '暂无成员'}
            setDataScope={setDataScope}
          />

          {dataScope === 'personal' ? (
            <PersonalHistoryPanel
              history={history}
              monthCursor={monthCursor}
              monthDates={monthDates}
              selectedDate={selectedDate}
              setMonthCursor={setMonthCursor}
              setSelectedDate={setSelectedDate}
            />
          ) : (
            <GroupReservedPanel analysis={history.groupAnalysis} />
          )}
        </>
      ) : null}
    </Screen>
  );
}

function ScopeSegment({
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
      <View style={styles.scopeCopy}>
        <AppText tone="muted" variant="caption">
          当前成员
        </AppText>
        <AppText variant="subtitle">{memberName}</AppText>
      </View>
      <View style={styles.segment}>
        <SegmentButton active={dataScope === 'personal'} label="个人记录" onPress={() => setDataScope('personal')} />
        <SegmentButton active={dataScope === 'group'} label="小组记录" onPress={() => setDataScope('group')} />
      </View>
    </AppCard>
  );
}

function SegmentButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.segmentButton, active && styles.segmentButtonActive]}>
      <AppText tone={active ? 'inverse' : 'muted'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function PersonalHistoryPanel({
  history,
  monthCursor,
  monthDates,
  selectedDate,
  setMonthCursor,
  setSelectedDate,
}: {
  history: HistoryState;
  monthCursor: Date;
  monthDates: Date[];
  selectedDate: string;
  setMonthCursor: (date: Date | ((current: Date) => Date)) => void;
  setSelectedDate: (date: string) => void;
}) {
  const analysis = history.personalAnalysis;
  const selectedDateSessions = history.recentSessions.filter((summary) => summary.session.date === selectedDate);

  if (!analysis) {
    return (
      <EmptyState
        actionLabel="去训练"
        description="完成一次训练后，这里会显示训练摘要、训练量和进步趋势。"
        onActionPress={() => router.push('/(tabs)/today')}
        title="还没有训练记录"
      />
    );
  }

  return (
    <>
      <WeeklySummaryCard analysis={analysis} memberName={history.currentMember?.displayName ?? '成员'} />
      <TrendOverviewCard analysis={analysis} />
      <MonthCalendar
        monthCursor={monthCursor}
        monthDates={monthDates}
        selectedDate={selectedDate}
        setMonthCursor={setMonthCursor}
        setSelectedDate={setSelectedDate}
        trainingDates={history.monthlyTrainingDates}
      />

      <SectionHeader
        actionLabel="补录"
        onActionPress={() => router.push({ pathname: '/history/manual', params: { date: selectedDate } } as never)}
        title={`${selectedDate} 训练`}
      />
      {selectedDateSessions.length === 0 ? (
        <AppCard style={styles.emptyCard} tone="soft">
          <Ionicons color={colors.textMuted} name="calendar-clear-outline" size={24} />
          <View style={styles.emptyText}>
            <AppText variant="bodySmall" weight="900">
              这一天暂无训练记录
            </AppText>
            <AppText tone="muted" variant="caption">
              点击其他日期查看记录，或补录过去完成的训练。
            </AppText>
          </View>
        </AppCard>
      ) : (
        <View style={styles.sessionList}>
          {selectedDateSessions.map((summary) => (
            <SessionCard key={summary.session.id} memberName={history.currentMember?.displayName ?? '成员'} summary={summary} />
          ))}
        </View>
      )}

      <SectionHeader title="最近训练" />
      {history.recentSessions.length === 0 ? (
        <EmptyState
          actionLabel="去训练"
          description="完成一次训练后，这里会显示训练摘要、训练量和进步趋势。"
          onActionPress={() => router.push('/(tabs)/today')}
          title="还没有训练记录"
        />
      ) : (
        <View style={styles.recentGrid}>
          {history.recentSessions.slice(0, 6).map((summary) => (
            <RecentSessionItem key={summary.session.id} summary={summary} />
          ))}
        </View>
      )}
    </>
  );
}

function WeeklySummaryCard({ analysis, memberName }: { analysis: PersonalHistoryAnalysis; memberName: string }) {
  const week = analysis.currentWeek;

  return (
    <AppCard style={styles.weekCard}>
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">本周数据</AppText>
          <AppText tone="muted" variant="caption">
            当前成员：{memberName}
          </AppText>
        </View>
        <Tag label="个人记录" tone="brand" />
      </View>
      <View style={styles.metricGrid}>
        <MetricBlock label="训练量" value={formatKg(week.volume)} />
        <MetricBlock label="训练次数" value={`${week.sessionCount} 次`} />
        <MetricBlock label="完成组数" value={`${week.completedSets} 组`} />
        <MetricBlock label="完成率" value={formatPercent(week.completionRate)} />
      </View>
    </AppCard>
  );
}

function TrendOverviewCard({ analysis }: { analysis: PersonalHistoryAnalysis }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push('/history/analytics' as never)} style={({ pressed }) => pressed && styles.pressed}>
      <AppCard style={styles.trendCard}>
        <View style={styles.cardHeaderRow}>
          <View>
            <AppText variant="subtitle">最近 4 周趋势</AppText>
            <AppText tone="muted" variant="caption">
              训练频率、训练量、完成率和 PR 动态
            </AppText>
          </View>
          <View style={styles.moreAnalysis}>
            <AppText tone="brand" variant="caption">
              更多分析
            </AppText>
            <Ionicons color={colors.primary} name="chevron-forward" size={18} />
          </View>
        </View>

        <View style={styles.trendStatRow}>
          <TrendStat label="训练量" value={formatSignedPercent(analysis.volumeChangePercent)} tone="brand" />
          <TrendStat label="训练次数" value={analysis.sessionTrendLabel} tone="accent" />
          <TrendStat label="完成率" value={formatSignedPercent(analysis.completionChangePercent)} tone="success" />
          <TrendStat label="PR" value={`${analysis.prCount} 项`} tone="warning" />
        </View>

        <MiniBarChart buckets={analysis.weeklyBuckets} />
        <View style={styles.insightStrip}>
          <Ionicons color={colors.primary} name="sparkles-outline" size={16} />
          <AppText numberOfLines={2} variant="bodySmall" weight="900">
            {analysis.insights[0]}
          </AppText>
        </View>
      </AppCard>
    </Pressable>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricBlock}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="subtitle">
        {value}
      </AppText>
    </View>
  );
}

function TrendStat({
  label,
  tone,
  value,
}: {
  label: string;
  tone: 'brand' | 'accent' | 'success' | 'warning';
  value: string;
}) {
  const toneStyle = {
    accent: styles.accentTrendStat,
    brand: styles.brandTrendStat,
    success: styles.successTrendStat,
    warning: styles.warningTrendStat,
  }[tone];

  return (
    <View style={[styles.trendStat, toneStyle]}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function MiniBarChart({ buckets }: { buckets: WeeklyHistoryBucket[] }) {
  const maxVolume = Math.max(1, ...buckets.map((bucket) => bucket.volume));

  return (
    <View style={styles.miniChart}>
      {buckets.map((bucket) => (
        <View key={bucket.label} style={styles.barColumn}>
          <View style={styles.barTrack}>
            <View style={[styles.volumeBar, { height: 12 + Math.round((bucket.volume / maxVolume) * 54) }]} />
          </View>
          <AppText tone="muted" variant="caption">
            {bucket.label}
          </AppText>
          <AppText variant="caption" weight="900">
            {bucket.sessionCount} 次
          </AppText>
        </View>
      ))}
    </View>
  );
}

function MonthCalendar({
  monthCursor,
  monthDates,
  selectedDate,
  setMonthCursor,
  setSelectedDate,
  trainingDates,
}: {
  monthCursor: Date;
  monthDates: Date[];
  selectedDate: string;
  setMonthCursor: (date: Date | ((current: Date) => Date)) => void;
  setSelectedDate: (date: string) => void;
  trainingDates: Set<string>;
}) {
  return (
    <AppCard style={styles.calendarCard}>
      <View style={styles.cardHeaderRow}>
        <Pressable accessibilityRole="button" onPress={() => setMonthCursor((current) => addMonths(current, -1))} style={styles.smallIconButton}>
          <Ionicons color={colors.text} name="chevron-back-outline" size={18} />
        </Pressable>
        <View style={styles.calendarTitle}>
          <AppText variant="subtitle">本月日历</AppText>
          <AppText tone="muted" variant="caption">
            {formatMonthLabel(monthCursor)} · 小哑铃表示有训练
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setMonthCursor((current) => addMonths(current, 1))} style={styles.smallIconButton}>
          <Ionicons color={colors.text} name="chevron-forward-outline" size={18} />
        </Pressable>
      </View>
      <View style={styles.weekdayRow}>
        {['日', '一', '二', '三', '四', '五', '六'].map((label) => (
          <AppText key={label} style={styles.weekdayText} tone="muted" variant="caption">
            {label}
          </AppText>
        ))}
      </View>
      <View style={styles.monthGrid}>
        {Array.from({ length: monthDates[0]?.getDay() ?? 0 }, (_, index) => (
          <View key={`blank-${index}`} style={styles.monthDayBlank} />
        ))}
        {monthDates.map((date) => {
          const key = getLocalDateString(date);
          const active = key === selectedDate;
          const hasTraining = trainingDates.has(key);
          return (
            <Pressable
              accessibilityRole="button"
              key={key}
              onPress={() => setSelectedDate(key)}
              style={[styles.monthDay, active && styles.monthDayActive]}
            >
              <AppText tone={active ? 'inverse' : 'default'} variant="caption" weight="900">
                {date.getDate()}
              </AppText>
              <View style={styles.trainingMarkSlot}>
                {hasTraining ? (
                  <Ionicons
                    color={active ? colors.surface : colors.primary}
                    name={active ? 'barbell' : 'barbell-outline'}
                    size={10}
                  />
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </AppCard>
  );
}

function RecentSessionItem({ summary }: { summary: SessionSummary }) {
  const session = summary.session;
  const durationLabel = summary.durationMinutes ? `${summary.durationMinutes}分钟` : '';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/history/[sessionId]', params: { sessionId: session.id } } as never)}
      style={({ pressed }) => [styles.recentItem, pressed && styles.pressed]}
    >
      <View style={styles.recentItemHeader}>
        <AppText variant="caption" weight="600">{formatShortDate(session.date)}</AppText>
        {durationLabel ? <AppText tone="muted" variant="caption">{durationLabel}</AppText> : null}
      </View>
      <AppText numberOfLines={1} variant="bodySmall" weight="600">{session.title}</AppText>
      <View style={styles.recentItemMetrics}>
        <AppText tone="muted" variant="caption">{summary.exerciseCount}动作</AppText>
        <AppText tone="muted" variant="caption">·</AppText>
        <AppText tone="muted" variant="caption">{summary.setCount}组</AppText>
        <AppText tone="muted" variant="caption">·</AppText>
        <AppText tone="muted" variant="caption">{formatKg(summary.volume)}</AppText>
      </View>
    </Pressable>
  );
}

function SessionCard({ memberName, summary }: { memberName: string; summary: SessionSummary }) {
  const session = summary.session;
  const durationLabel = summary.durationMinutes ? `${summary.durationMinutes} 分钟` : '时长待补充';
  const trendLabel =
    summary.bestEstimatedOneRM && summary.bestEstimatedOneRM > 0
      ? `估算 1RM ${summary.bestEstimatedOneRM}kg`
      : '趋势样本积累中';
  const visibleExercises = summary.mainExerciseNames.slice(0, 2);
  const extraExerciseCount = Math.max(0, summary.mainExerciseNames.length - visibleExercises.length);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/history/[sessionId]', params: { sessionId: session.id } } as never)}
      style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
    >
      <View style={styles.sessionDateBadge}>
        <AppText tone="inverse" variant="caption" weight="900">
          {formatShortDate(session.date)}
        </AppText>
      </View>
      <View style={styles.sessionBody}>
        <View style={styles.sessionTop}>
          <View style={styles.sessionTitleBlock}>
            <AppText numberOfLines={1} variant="bodySmall" weight="900">
              {session.title}
            </AppText>
            <AppText tone="muted" variant="caption">
              {session.date} · {durationLabel}
            </AppText>
          </View>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={20} />
        </View>

        <View style={styles.sessionMetricRow}>
          <SessionMetric label="动作" value={`${summary.exerciseCount}`} />
          <SessionMetric label="组数" value={`${summary.setCount}`} />
          <SessionMetric label="训练量" value={formatKg(summary.volume)} wide />
        </View>

        {visibleExercises.length > 0 ? (
          <View style={styles.sessionExerciseRow}>
            {visibleExercises.map((name) => (
              <Tag key={name} label={name} tone="neutral" />
            ))}
            {extraExerciseCount > 0 ? <Tag label={`+${extraExerciseCount}`} tone="accent" /> : null}
          </View>
        ) : null}

        <View style={styles.sessionTags}>
          <Tag label={memberName} tone="neutral" />
          <Tag label={trendLabel} tone="accent" />
          {summary.topSetLabel ? <Tag label={`PR 参考 ${summary.topSetLabel}`} tone="brand" /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function SessionMetric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.sessionMetric, wide && styles.sessionMetricWide]}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function GroupReservedPanel({ analysis }: { analysis: GroupHistoryAnalysis | null }) {
  const futureMetrics = analysis?.futureMetrics ?? ['小组本周训练次数', '小组总训练量', '成员完成率排行', '成员 PR 动态', '小组训练日历'];

  return (
    <AppCard style={styles.groupPanel} tone="soft">
      <View style={styles.groupIcon}>
        <Ionicons color={colors.primary} name="people-outline" size={24} />
      </View>
      <View style={styles.groupCopy}>
        <Tag label="接口预留" tone="warning" />
        <AppText variant="subtitle">小组记录</AppText>
        <AppText tone="muted" variant="bodySmall">
          本地小组汇总正在开发中。
        </AppText>
      </View>
      <View style={styles.futureList}>
        {futureMetrics.map((item) => (
          <View key={item} style={styles.futureRow}>
            <View style={styles.futureDot} />
            <AppText tone="muted" variant="bodySmall">
              {item}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
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
  scopeCopy: {
    flex: 1,
    gap: 2,
  },
  segment: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: 'row',
    padding: 3,
    width: 166,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 32,
  },
  segmentButtonActive: {
    backgroundColor: colors.primary,
  },
  weekCard: {
    gap: spacing.md,
  },
  cardHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricBlock: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: 2,
    minHeight: 72,
    padding: spacing.md,
  },
  trendCard: {
    gap: spacing.md,
  },
  moreAnalysis: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  trendStatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trendStat: {
    borderRadius: radius.sm,
    flexBasis: '22%',
    flexGrow: 1,
    gap: 2,
    minHeight: 58,
    padding: spacing.sm,
  },
  brandTrendStat: {
    backgroundColor: colors.primarySoft,
  },
  accentTrendStat: {
    backgroundColor: colors.accentSoft,
  },
  successTrendStat: {
    backgroundColor: colors.successSoft,
  },
  warningTrendStat: {
    backgroundColor: colors.warningSoft,
  },
  miniChart: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 104,
  },
  barColumn: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  barTrack: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 74,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 18,
  },
  volumeBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    width: 18,
  },
  insightStrip: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  calendarCard: {
    gap: spacing.md,
  },
  calendarTitle: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayText: {
    flex: 1,
    textAlign: 'center',
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 0,
  },
  monthDayBlank: {
    aspectRatio: 1,
    width: `${100 / 7}%`,
  },
  monthDay: {
    alignItems: 'center',
    aspectRatio: 1,
    borderRadius: radius.pill,
    gap: 2,
    justifyContent: 'center',
    width: `${100 / 7}%`,
  },
  monthDayActive: {
    backgroundColor: colors.primary,
  },
  trainingMarkSlot: {
    alignItems: 'center',
    height: 12,
    justifyContent: 'center',
    width: 18,
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
    gap: spacing.md,
  },
  recentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recentItem: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.xs,
    padding: spacing.md,
    width: '48%',
  },
  recentItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  recentItemMetrics: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sessionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    overflow: 'hidden',
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.78,
  },
  sessionDateBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  sessionBody: {
    flex: 1,
    gap: spacing.sm,
  },
  sessionTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  sessionTitleBlock: {
    flex: 1,
    gap: 2,
  },
  sessionMetricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sessionMetric: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    minWidth: 58,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  sessionMetricWide: {
    flex: 1,
  },
  sessionExerciseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  sessionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  groupPanel: {
    alignItems: 'center',
    gap: spacing.md,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  groupCopy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  futureList: {
    alignSelf: 'stretch',
    gap: spacing.sm,
  },
  futureRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  futureDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
});
