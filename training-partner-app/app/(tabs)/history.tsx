import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, MiniLineChart, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import { estimateOneRM, type HistorySetEntry } from '@/domain/history/history-analysis';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSession, WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type DataScope = 'personal' | 'group';
type RangeKey = '7d' | '30d' | 'month';

type DateRange = {
  fromDate: string;
  label: string;
  toDate: string;
};

type ExerciseFilterOption = {
  id: string;
  name: string;
};

type SessionSummary = {
  date: string;
  durationMinutes?: number;
  exerciseCount: number;
  id: string;
  mainExerciseNames: string[];
  participantCount?: number;
  session: WorkoutSession;
  setCount: number;
  title: string;
  topSetLabel?: string;
  volume: number;
};

type TrendPoint = {
  date?: string;
  exerciseCount: number;
  label: string;
  setCount: number;
  sessionId?: string;
  volume: number;
};

type HistoryState = {
  currentMember: GroupMember | null;
  exerciseOptions: ExerciseFilterOption[];
  groupName: string;
  groupEntries: HistorySetEntry[];
  groupSessions: SessionSummary[];
  monthlyTrainingDates: Set<string>;
  personalEntries: HistorySetEntry[];
  personalSessions: SessionSummary[];
};

type SelectedRecordAction = {
  scope: DataScope;
  summary: SessionSummary;
} | null;

type SelectedTrendPoint = {
  changeLabel: string;
  date?: string;
  exerciseCount: number;
  index: number;
  label: string;
  setCount: number;
  value: number;
} | null;

const rangeOptions: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '近 7 天' },
  { key: '30d', label: '近 30 天' },
  { key: 'month', label: '本月' },
];

function createEmptyHistory(currentMember: GroupMember | null = null): HistoryState {
  return {
    currentMember,
    exerciseOptions: [],
    groupEntries: [],
    groupName: '默认训练小组',
    groupSessions: [],
    monthlyTrainingDates: new Set<string>(),
    personalEntries: [],
    personalSessions: [],
  };
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function addMonths(date: Date, count: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + count);
  return next;
}

function formatMonthLabel(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function formatCompactKg(value: number): string {
  if (value >= 1000) {
    return `${Math.round(value / 100) / 10}k`;
  }

  return `${Math.round(value)}kg`;
}

function getDateRange(rangeKey: RangeKey, selectedDate: string | null): DateRange {
  if (selectedDate) {
    return {
      fromDate: selectedDate,
      label: formatShortDate(selectedDate),
      toDate: selectedDate,
    };
  }

  const today = new Date();
  if (rangeKey === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1, 12);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 12);
    return {
      fromDate: getLocalDateString(start),
      label: '本月',
      toDate: getLocalDateString(end),
    };
  }

  const dayCount = rangeKey === '7d' ? 7 : 30;
  return {
    fromDate: getLocalDateString(addDays(today, -(dayCount - 1))),
    label: `近 ${dayCount} 天`,
    toDate: getLocalDateString(today),
  };
}

function getMonthDates(monthCursor: Date) {
  const first = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 12);
  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, index) => new Date(first.getFullYear(), first.getMonth(), index + 1, 12));
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

function getExerciseNameMap(exercises: Exercise[]): Record<string, string> {
  return Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise.name]));
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

function getGroupEntries(detail: WorkoutSessionDetail): HistorySetEntry[] {
  return detail.sets.map((set) => {
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
  exerciseNamesById: Record<string, string>,
  memberId?: string,
): SessionSummary {
  const scopedSets = memberId ? detail.sets.filter((set) => set.memberId === memberId) : detail.sets;
  const completedSets = scopedSets.filter((set) => set.completed);
  const completedRecordIds = new Set(completedSets.map((set) => set.exerciseRecordId));
  const exerciseIds = new Set(
    completedSets.map((set) => detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId)?.exerciseId ?? set.exerciseRecordId),
  );
  const mainExerciseNames = detail.exercises
    .filter((exercise) => completedRecordIds.has(exercise.id))
    .slice()
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((exercise) => exerciseNamesById[exercise.exerciseId] ?? '训练动作')
    .filter((name, index, names) => names.indexOf(name) === index);
  const topSet = completedSets
    .map((set) => ({
      estimatedOneRM: estimateOneRM(set.actualWeight ?? set.plannedWeight ?? 0, set.actualReps ?? set.plannedReps ?? 0),
      reps: set.actualReps ?? set.plannedReps ?? 0,
      weight: set.actualWeight ?? set.plannedWeight ?? 0,
    }))
    .filter((set) => set.weight > 0 && set.reps > 0)
    .sort((left, right) => right.estimatedOneRM - left.estimatedOneRM)[0];

  return {
    date: detail.session.date,
    durationMinutes: getDurationMinutes(detail.session),
    exerciseCount: exerciseIds.size,
    id: detail.session.id,
    mainExerciseNames,
    participantCount: memberId ? undefined : new Set(completedSets.map((set) => set.memberId)).size,
    session: detail.session,
    setCount: completedSets.length,
    title: detail.session.title,
    topSetLabel: topSet ? `${topSet.weight}kg x ${topSet.reps}` : undefined,
    volume: completedSets.reduce(
      (sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
      0,
    ),
  };
}

function buildSessionTrend(summaries: SessionSummary[]): TrendPoint[] {
  return summaries
    .filter((summary) => summary.setCount > 0 || summary.volume > 0)
    .slice()
    .sort((left, right) => `${left.date} ${left.session.updatedAt}`.localeCompare(`${right.date} ${right.session.updatedAt}`))
    .slice(-12)
    .map((summary) => ({
      date: summary.date,
      exerciseCount: summary.exerciseCount,
      label: formatShortDate(summary.date),
      sessionId: summary.id,
      setCount: summary.setCount,
      volume: summary.volume,
    }));
}

function buildExerciseTrend(entries: HistorySetEntry[]): TrendPoint[] {
  const bySession = new Map<string, TrendPoint>();
  entries
    .filter((entry) => entry.completed && (entry.weight ?? 0) > 0 && (entry.reps ?? 0) > 0)
    .forEach((entry) => {
      const current = bySession.get(entry.sessionId) ?? {
        date: entry.date,
        exerciseCount: 1,
        label: formatShortDate(entry.date),
        sessionId: entry.sessionId,
        setCount: 0,
        volume: 0,
      };
      current.setCount += 1;
      current.volume += (entry.weight ?? 0) * (entry.reps ?? 0);
      bySession.set(entry.sessionId, current);
    });

  return [...bySession.values()]
    .sort((left, right) => (left.date ?? '').localeCompare(right.date ?? ''))
    .slice(-12);
}

function getKeyPointIndexes(values: number[], selectedIndex?: number): number[] {
  const indexes = new Set<number>();
  const active = values
    .map((value, index) => ({ index, value }))
    .filter((point) => point.value > 0);

  if (active.length === 0) {
    return [];
  }

  indexes.add(active.at(-1)!.index);
  indexes.add(active.reduce((max, point) => (point.value > max.value ? point : max), active[0]).index);
  indexes.add(active.reduce((min, point) => (point.value < min.value ? point : min), active[0]).index);
  if (selectedIndex !== undefined) {
    indexes.add(selectedIndex);
  }

  for (let index = 1; index < values.length; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    if (previous > 0 && Math.abs(current - previous) / previous > 0.3) {
      indexes.add(index);
    }
  }

  return [...indexes]
    .sort((left, right) => {
      const priority = (index: number) => {
        if (index === active.at(-1)!.index) return 0;
        if (index === active.reduce((max, point) => (point.value > max.value ? point : max), active[0]).index) return 1;
        if (index === selectedIndex) return 2;
        return 3;
      };
      return priority(left) - priority(right);
    })
    .slice(0, values.length > 8 ? 4 : 5);
}

function getTrendLabel(values: number[]): string {
  const active = values.filter((value) => value > 0);
  if (active.length < 2) {
    return '样本不足';
  }

  const first = active[0];
  const latest = active.at(-1)!;
  if (latest >= first * 1.05) {
    return '上升';
  }
  if (latest <= first * 0.95) {
    return '下降';
  }
  return '稳定';
}

function getChangeLabel(values: number[], index: number): string {
  if (index <= 0) {
    return '首次记录';
  }

  const previous = values[index - 1];
  const current = values[index];
  if (previous <= 0) {
    return current > 0 ? '新增数据' : '无变化';
  }

  const change = Math.round(((current - previous) / previous) * 100);
  if (Math.abs(change) < 3) {
    return '基本持平';
  }
  return `${change > 0 ? '+' : ''}${change}%`;
}

export default function HistoryRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [dataScope, setDataScope] = useState<DataScope>('personal');
  const [rangeKey, setRangeKey] = useState<RangeKey>('30d');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [monthCursor, setMonthCursor] = useState(new Date());
  const [isDateSheetVisible, setDateSheetVisible] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(null);
  const [recordAction, setRecordAction] = useState<SelectedRecordAction>(null);
  const [history, setHistory] = useState<HistoryState>(createEmptyHistory());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const dateRange = useMemo(() => getDateRange(rangeKey, selectedDate), [rangeKey, selectedDate]);

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

      const monthStart = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1, 12));
      const monthEnd = getLocalDateString(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 12));
      const [personalSessions, groupSessions, monthSessions] = await Promise.all([
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          memberId: currentMember.id,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
          limit: 200,
        }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          fromDate: dateRange.fromDate,
          toDate: dateRange.toDate,
          limit: 200,
        }),
        repositories.workoutRepository.listSessions({
          groupId: group.id,
          fromDate: monthStart,
          toDate: monthEnd,
          limit: 300,
        }),
      ]);

      const detailIds = Array.from(new Set([...personalSessions, ...groupSessions].map((session) => session.id)));
      const details = await Promise.all(detailIds.map((sessionId) => repositories.workoutRepository.getSessionDetail(sessionId)));
      const detailsById = new Map(details.map((detail) => [detail.session.id, detail]));
      const personalDetails = personalSessions
        .map((session) => detailsById.get(session.id))
        .filter((detail): detail is WorkoutSessionDetail => Boolean(detail));
      const groupDetails = groupSessions
        .map((session) => detailsById.get(session.id))
        .filter((detail): detail is WorkoutSessionDetail => Boolean(detail));
      const exerciseIds = Array.from(
        new Set(details.flatMap((detail) => detail.exercises.map((exerciseRecord) => exerciseRecord.exerciseId))),
      );
      const exercises = exerciseIds.length > 0 ? await repositories.exerciseRepository.listExercisesByIds(exerciseIds) : [];
      const exerciseNamesById = getExerciseNameMap(exercises);
      const personalEntries = personalDetails.flatMap((detail) => getMemberEntries(detail, currentMember.id));
      const groupEntries = groupDetails.flatMap(getGroupEntries);
      const exerciseOptions = Array.from(new Set([...personalEntries, ...groupEntries].map((entry) => entry.exerciseId))).map((exerciseId) => ({
        id: exerciseId,
        name: exerciseNamesById[exerciseId] ?? '训练动作',
      }));

      setHistory({
        currentMember,
        exerciseOptions,
        groupEntries,
        groupName: group.name,
        groupSessions: groupDetails
          .map((detail) => summarizeSession(detail, exerciseNamesById))
          .filter((summary) => summary.setCount > 0),
        monthlyTrainingDates: new Set(monthSessions.map((session) => session.date)),
        personalEntries,
        personalSessions: personalDetails
          .map((detail) => summarizeSession(detail, exerciseNamesById, currentMember.id))
          .filter((summary) => summary.setCount > 0),
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '历史记录加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [authMode, dateRange.fromDate, dateRange.toDate, monthCursor, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory]),
  );

  const effectiveSelectedExerciseId =
    selectedExerciseId && history.exerciseOptions.some((option) => option.id === selectedExerciseId)
      ? selectedExerciseId
      : null;
  const activeEntries = dataScope === 'personal' ? history.personalEntries : history.groupEntries;
  const activeSessions = dataScope === 'personal' ? history.personalSessions : history.groupSessions;
  const filteredSessionIds = effectiveSelectedExerciseId
    ? new Set(activeEntries.filter((entry) => entry.exerciseId === effectiveSelectedExerciseId).map((entry) => entry.sessionId))
    : null;
  const filteredSessions = filteredSessionIds
    ? activeSessions.filter((summary) => filteredSessionIds.has(summary.id))
    : activeSessions;
  const trend = effectiveSelectedExerciseId
    ? buildExerciseTrend(activeEntries.filter((entry) => entry.exerciseId === effectiveSelectedExerciseId))
    : buildSessionTrend(filteredSessions);
  const selectedExerciseName = history.exerciseOptions.find((option) => option.id === effectiveSelectedExerciseId)?.name;
  const isGuestPreview = authMode === 'guest_preview';

  const openDetail = useCallback(
    (summary: SessionSummary, scope: DataScope) => {
      router.push({
        pathname: '/history/[sessionId]',
        params: {
          ...(scope === 'personal' && history.currentMember ? { memberId: history.currentMember.id } : {}),
          scope,
          sessionId: summary.id,
        },
      } as never);
    },
    [history.currentMember],
  );

  const deletePersonalRecord = useCallback(
    (summary: SessionSummary) => {
      if (!history.currentMember || !guardFeature('manual_history')) {
        return;
      }

      Alert.alert('删除我的本次记录？', '只会删除你自己的训练数据，不会影响其他成员。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await repositories.workoutRepository.deleteMemberSetsInSession(summary.id, history.currentMember!.id);
              setRecordAction(null);
              await loadHistory();
            })();
          },
        },
      ]);
    },
    [guardFeature, history.currentMember, loadHistory, repositories],
  );

  const deleteGroupSession = useCallback(
    (summary: SessionSummary) => {
      if (!guardFeature('manual_history')) {
        return;
      }

      Alert.alert('删除整次小组训练？', '会删除本次训练中所有成员的动作和组数据，无法撤销。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await repositories.workoutRepository.deleteSessionCascade(summary.id);
              setRecordAction(null);
              await loadHistory();
            })();
          },
        },
      ]);
    },
    [guardFeature, loadHistory, repositories],
  );

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => setDateSheetVisible(true)} style={styles.headerIconButton}>
          <Ionicons color={colors.text} name="calendar-outline" size={20} />
        </Pressable>
      }
      subtitle={history.currentMember ? `当前成员：${history.currentMember.displayName}` : '看趋势、找记录、编辑或删除记录'}
      title="记录"
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
                groupName={history.groupName}
                memberName={history.currentMember?.displayName ?? '暂无成员'}
                setDataScope={(scope) => {
                  if (scope === 'group' && !guardFeature('group_analytics')) {
                    return;
                  }
                  setDataScope(scope);
                }}
              />

              <DateRangeFilter
                onOpenDatePicker={() => setDateSheetVisible(true)}
                onRangeChange={(nextRange) => {
                  setRangeKey(nextRange);
                  setSelectedDate(null);
                }}
                onResetDate={() => setSelectedDate(null)}
                rangeKey={rangeKey}
                selectedDate={selectedDate}
              />

              <TrainingTrendCard
                exerciseOptions={history.exerciseOptions}
                onSelectExercise={setSelectedExerciseId}
                rangeLabel={dateRange.label}
                selectedExerciseId={effectiveSelectedExerciseId}
                selectedExerciseName={selectedExerciseName}
                trend={trend}
              />

              <HistoryRecordList
                dataScope={dataScope}
                onAdd={() => {
                  if (guardFeature('manual_history')) {
                    router.push({ pathname: '/history/manual', params: { date: selectedDate ?? dateRange.toDate } } as never);
                  }
                }}
                onOpenActions={(summary) => setRecordAction({ scope: dataScope, summary })}
                onOpenDetail={(summary) => openDetail(summary, dataScope)}
                sessions={filteredSessions}
              />
            </>
          )}
        </>
      ) : null}

      <DatePickerSheet
        monthCursor={monthCursor}
        onClear={() => {
          setSelectedDate(null);
          setDateSheetVisible(false);
        }}
        onClose={() => setDateSheetVisible(false)}
        onMonthChange={setMonthCursor}
        onSelectDate={(date) => {
          setSelectedDate(date);
          setDateSheetVisible(false);
        }}
        selectedDate={selectedDate}
        trainingDates={history.monthlyTrainingDates}
        visible={isDateSheetVisible}
      />

      <RecordActionSheet
        action={recordAction}
        currentMemberId={history.currentMember?.id}
        onClose={() => setRecordAction(null)}
        onDeleteGroup={deleteGroupSession}
        onDeletePersonal={deletePersonalRecord}
        onOpenDetail={openDetail}
      />

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function ScopeToggle({
  dataScope,
  groupName,
  memberName,
  setDataScope,
}: {
  dataScope: DataScope;
  groupName: string;
  memberName: string;
  setDataScope: (scope: DataScope) => void;
}) {
  return (
    <AppCard padded={false} style={styles.scopeBar}>
      <View style={styles.scopeLabel}>
        <AppText variant="bodySmall" weight="900">
          {dataScope === 'personal' ? memberName : groupName}
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

function DateRangeFilter({
  onOpenDatePicker,
  onRangeChange,
  onResetDate,
  rangeKey,
  selectedDate,
}: {
  onOpenDatePicker: () => void;
  onRangeChange: (rangeKey: RangeKey) => void;
  onResetDate: () => void;
  rangeKey: RangeKey;
  selectedDate: string | null;
}) {
  return (
    <AppCard style={styles.rangeCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rangeScroll}>
        {rangeOptions.map((option) => (
          <Pressable
            accessibilityRole="button"
            key={option.key}
            onPress={() => onRangeChange(option.key)}
            style={[styles.rangePill, !selectedDate && rangeKey === option.key && styles.rangePillActive]}
          >
            <AppText tone={!selectedDate && rangeKey === option.key ? 'inverse' : 'muted'} variant="caption" weight="900">
              {option.label}
            </AppText>
          </Pressable>
        ))}
        <Pressable
          accessibilityRole="button"
          onPress={onOpenDatePicker}
          style={[styles.rangePill, selectedDate && styles.rangePillActive]}
        >
          <Ionicons color={selectedDate ? colors.surface : colors.textMuted} name="calendar-outline" size={15} />
          <AppText tone={selectedDate ? 'inverse' : 'muted'} variant="caption" weight="900">
            {selectedDate ? formatShortDate(selectedDate) : '日期'}
          </AppText>
        </Pressable>
        {selectedDate ? (
          <Pressable accessibilityRole="button" onPress={onResetDate} style={styles.clearDateButton}>
            <Ionicons color={colors.textMuted} name="close-outline" size={16} />
          </Pressable>
        ) : null}
      </ScrollView>
    </AppCard>
  );
}

function TrainingTrendCard({
  exerciseOptions,
  onSelectExercise,
  rangeLabel,
  selectedExerciseId,
  selectedExerciseName,
  trend,
}: {
  exerciseOptions: ExerciseFilterOption[];
  onSelectExercise: (exerciseId: string | null) => void;
  rangeLabel: string;
  selectedExerciseId: string | null;
  selectedExerciseName?: string;
  trend: TrendPoint[];
}) {
  const [isSelectorOpen, setSelectorOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<SelectedTrendPoint>(null);
  const values = trend.map((point) => point.volume);
  const activeValues = values.filter((value) => value > 0);
  const totalVolume = values.reduce((sum, value) => sum + value, 0);
  const latestVolume = activeValues.at(-1) ?? 0;
  const maxVolume = Math.max(0, ...values);
  const keyPointIndexes = getKeyPointIndexes(values, selectedPoint?.index);
  const normalizedQuery = query.trim().toLowerCase();
  const recentOptions = exerciseOptions.slice(0, 5);
  const filteredOptions = normalizedQuery
    ? exerciseOptions.filter((option) => option.name.toLowerCase().includes(normalizedQuery))
    : exerciseOptions.filter((option) => !recentOptions.some((recent) => recent.id === option.id));

  const chooseExercise = (exerciseId: string | null) => {
    onSelectExercise(exerciseId);
    setSelectedPoint(null);
    setSelectorOpen(false);
    setQuery('');
  };

  return (
    <AppCard style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">训练趋势</AppText>
          <AppText tone="muted" variant="caption">
            {rangeLabel}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={() => setSelectorOpen(true)} style={styles.exerciseButton}>
          <AppText numberOfLines={1} variant="caption" weight="900">
            {selectedExerciseName ?? '全部动作'}
          </AppText>
          <Ionicons color={colors.textMuted} name="chevron-down" size={15} />
        </Pressable>
      </View>

      <MiniLineChart
        chartHeight={116}
        data={values}
        emptyMessage="当前范围还没有训练量"
        formatValue={formatCompactKg}
        highlightIndex={selectedPoint?.index}
        keyPointIndexes={keyPointIndexes}
        labels={trend.map((point) => point.label)}
        minChartHeight={Math.max(100, maxVolume)}
        onPointPress={(point, index) => {
          const trendPoint = trend[index];
          setSelectedPoint({
            changeLabel: getChangeLabel(values, index),
            date: trendPoint?.date,
            exerciseCount: trendPoint?.exerciseCount ?? 0,
            index,
            label: point.label ?? trendPoint?.label ?? '',
            setCount: trendPoint?.setCount ?? 0,
            value: point.value,
          });
        }}
        unitLabel="kg"
        valueLabelStrategy="keyPoints"
      />

      {selectedPoint ? (
        <AppCard style={styles.pointDetailCard} tone="soft">
          <View style={styles.pointDetailHeader}>
            <AppText variant="bodySmall" weight="900">
              {selectedPoint.date ?? selectedPoint.label}
            </AppText>
            <Tag label={selectedPoint.changeLabel} tone={selectedPoint.changeLabel.startsWith('+') ? 'success' : 'neutral'} />
          </View>
          <AppText tone="muted" variant="caption">
            {formatKg(selectedPoint.value)} · {selectedPoint.setCount} 组 · {selectedPoint.exerciseCount} 动作
          </AppText>
        </AppCard>
      ) : null}

      <View style={styles.trendSummaryGrid}>
        <TrendMetric label="范围总量" value={formatKg(totalVolume)} />
        <TrendMetric label="最新一次" value={latestVolume > 0 ? formatKg(latestVolume) : '暂无'} />
        <TrendMetric label="最高点" value={maxVolume > 0 ? formatKg(maxVolume) : '暂无'} />
        <TrendMetric label="趋势" value={getTrendLabel(values)} />
      </View>

      {selectedExerciseId ? (
        <AppButton
          icon="barbell-outline"
          onPress={() => router.push({ pathname: '/history/exercise/[exerciseId]', params: { exerciseId: selectedExerciseId } } as never)}
          variant="secondary"
        >
          动作详情
        </AppButton>
      ) : null}

      <AppModalSheet
        onClose={() => setSelectorOpen(false)}
        subtitle="选择后同一张趋势卡和记录列表会同步更新"
        title="选择动作"
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
            active={!selectedExerciseId}
            meta={`${exerciseOptions.length} 个动作 · 总训练量`}
            name="全部动作"
            onPress={() => chooseExercise(null)}
          />
          {!normalizedQuery && recentOptions.length > 0 ? (
            <SelectorSection
              activeId={selectedExerciseId}
              onSelect={(id) => chooseExercise(id)}
              options={recentOptions}
              title="最近练过"
            />
          ) : null}
          <SelectorSection
            activeId={selectedExerciseId}
            emptyLabel="没有匹配动作"
            onSelect={(id) => chooseExercise(id)}
            options={filteredOptions}
            title={normalizedQuery ? '搜索结果' : '全部动作'}
          />
        </ScrollView>
      </AppModalSheet>
    </AppCard>
  );
}

function TrendMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.trendMetric}>
      <AppText numberOfLines={1} variant="bodySmall" weight="900">
        {value}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
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
            meta="动作趋势与记录"
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

function HistoryRecordList({
  dataScope,
  onAdd,
  onOpenActions,
  onOpenDetail,
  sessions,
}: {
  dataScope: DataScope;
  onAdd: () => void;
  onOpenActions: (summary: SessionSummary) => void;
  onOpenDetail: (summary: SessionSummary) => void;
  sessions: SessionSummary[];
}) {
  return (
    <View style={styles.recordSection}>
      <SectionHeader
        actionLabel={dataScope === 'personal' ? '补录' : undefined}
        onActionPress={dataScope === 'personal' ? onAdd : undefined}
        subtitle={dataScope === 'personal' ? '查看、编辑或删除自己的记录' : '查看、编辑或删除整次小组训练'}
        title={dataScope === 'personal' ? '训练记录' : '小组训练记录'}
      />
      {sessions.length === 0 ? (
        <AppCard style={styles.emptyRecordCard} tone="soft">
          <Ionicons color={colors.textSubtle} name="calendar-clear-outline" size={22} />
          <View style={styles.emptyRecordText}>
            <AppText variant="bodySmall" weight="900">
              当前范围暂无记录
            </AppText>
            <AppText tone="muted" variant="caption">
              调整时间范围或动作筛选后再查看。
            </AppText>
          </View>
        </AppCard>
      ) : (
        <View style={styles.sessionList}>
          {sessions.map((summary) => (
            <HistoryRecordCard
              dataScope={dataScope}
              key={summary.id}
              onOpenActions={() => onOpenActions(summary)}
              onPress={() => onOpenDetail(summary)}
              summary={summary}
            />
          ))}
        </View>
      )}
    </View>
  );
}

function HistoryRecordCard({
  dataScope,
  onOpenActions,
  onPress,
  summary,
}: {
  dataScope: DataScope;
  onOpenActions: () => void;
  onPress: () => void;
  summary: SessionSummary;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.recordCard, pressed && styles.pressed]}>
      <View style={styles.recordDateBox}>
        <AppText variant="caption" weight="900">
          {formatShortDate(summary.date)}
        </AppText>
        <View style={[styles.recordDot, summary.session.status === 'completed' ? styles.recordDotDone : styles.recordDotOpen]} />
      </View>
      <View style={styles.recordMain}>
        <View style={styles.recordTitleRow}>
          <AppText numberOfLines={1} style={styles.recordTitle} variant="bodySmall" weight="900">
            {summary.title}
          </AppText>
          <Pressable accessibilityRole="button" onPress={onOpenActions} style={styles.moreButton}>
            <Ionicons color={colors.textMuted} name="ellipsis-horizontal" size={18} />
          </Pressable>
        </View>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {summary.mainExerciseNames.slice(0, 2).join('、') || '训练记录'}
        </AppText>
        <View style={styles.recordMetaGrid}>
          <RecordMeta label="时长" value={summary.durationMinutes ? `${summary.durationMinutes} 分钟` : '已完成'} />
          <RecordMeta label="动作" value={`${summary.exerciseCount} 个`} />
          <RecordMeta label="组数" value={`${summary.setCount} 组`} />
          <RecordMeta label="训练量" value={formatKg(summary.volume)} />
          {dataScope === 'group' ? <RecordMeta label="成员" value={`${summary.participantCount ?? 0} 人`} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

function RecordMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordMetaItem}>
      <AppText numberOfLines={1} variant="caption" weight="900">
        {value}
      </AppText>
      <AppText numberOfLines={1} tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function DatePickerSheet({
  monthCursor,
  onClear,
  onClose,
  onMonthChange,
  onSelectDate,
  selectedDate,
  trainingDates,
  visible,
}: {
  monthCursor: Date;
  onClear: () => void;
  onClose: () => void;
  onMonthChange: (date: Date) => void;
  onSelectDate: (date: string) => void;
  selectedDate: string | null;
  trainingDates: Set<string>;
  visible: boolean;
}) {
  const monthDates = useMemo(() => getMonthDates(monthCursor), [monthCursor]);

  return (
    <AppModalSheet onClose={onClose} subtitle="按单日筛选记录，清除后恢复当前时间范围" title="日期筛选" visible={visible}>
      <View style={styles.modalHeader}>
        <Pressable accessibilityRole="button" onPress={() => onMonthChange(addMonths(monthCursor, -1))} style={styles.modalNavButton}>
          <Ionicons color={colors.text} name="chevron-back-outline" size={20} />
        </Pressable>
        <AppText variant="subtitle">{formatMonthLabel(monthCursor)}</AppText>
        <Pressable accessibilityRole="button" onPress={() => onMonthChange(addMonths(monthCursor, 1))} style={styles.modalNavButton}>
          <Ionicons color={colors.text} name="chevron-forward-outline" size={20} />
        </Pressable>
      </View>
      <View style={styles.monthGrid}>
        {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
          <AppText key={day} style={styles.weekdayLabel} tone="muted" variant="caption">
            {day}
          </AppText>
        ))}
        {Array.from({ length: new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1).getDay() }).map((_, index) => (
          <View key={`pad-${index}`} style={styles.monthDay} />
        ))}
        {monthDates.map((date) => {
          const key = getLocalDateString(date);
          const active = key === selectedDate;
          const hasTraining = trainingDates.has(key);
          return (
            <Pressable
              accessibilityRole="button"
              key={key}
              onPress={() => onSelectDate(key)}
              style={[styles.monthDay, active && styles.monthDayActive]}
            >
              <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
                {date.getDate()}
              </AppText>
              {hasTraining ? <View style={[styles.monthDot, active && styles.monthDotActive]} /> : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.modalActions}>
        <AppButton onPress={onClear} variant="secondary">
          清除日期筛选
        </AppButton>
        <AppButton onPress={onClose}>完成</AppButton>
      </View>
    </AppModalSheet>
  );
}

function RecordActionSheet({
  action,
  currentMemberId,
  onClose,
  onDeleteGroup,
  onDeletePersonal,
  onOpenDetail,
}: {
  action: SelectedRecordAction;
  currentMemberId?: string;
  onClose: () => void;
  onDeleteGroup: (summary: SessionSummary) => void;
  onDeletePersonal: (summary: SessionSummary) => void;
  onOpenDetail: (summary: SessionSummary, scope: DataScope) => void;
}) {
  if (!action) {
    return null;
  }

  const { scope, summary } = action;
  const isPersonal = scope === 'personal';

  return (
    <AppModalSheet
      onClose={onClose}
      position="center"
      subtitle={isPersonal ? '只处理当前成员的数据' : '这些操作会影响整次小组训练'}
      title="记录操作"
      visible={Boolean(action)}
    >
      <View style={styles.modalActions}>
        <AppButton
          icon="eye-outline"
          onPress={() => {
            onClose();
            onOpenDetail(summary, scope);
          }}
          variant="secondary"
        >
          {isPersonal ? '查看详情' : '查看小组详情'}
        </AppButton>
        <AppButton
          icon="create-outline"
          onPress={() => {
            onClose();
            router.push({
              pathname: '/history/[sessionId]',
              params: {
                ...(isPersonal && currentMemberId ? { memberId: currentMemberId } : {}),
                edit: '1',
                scope,
                sessionId: summary.id,
              },
            } as never);
          }}
        >
          {isPersonal ? '编辑我的记录' : '编辑小组记录'}
        </AppButton>
        <AppButton
          icon="trash-outline"
          onPress={() => (isPersonal ? onDeletePersonal(summary) : onDeleteGroup(summary))}
          variant="danger"
        >
          {isPersonal ? '删除我的本次记录' : '删除整次小组训练'}
        </AppButton>
        <AppButton onPress={onClose} variant="secondary">
          取消
        </AppButton>
      </View>
    </AppModalSheet>
  );
}

const styles = StyleSheet.create({
  headerIconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  loadingWrap: {
    paddingVertical: spacing.lg,
  },
  scopeBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.xs,
  },
  scopeLabel: {
    flex: 1,
    paddingLeft: spacing.md,
  },
  scopePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  scopePillBtn: {
    alignItems: 'center',
    borderRadius: radius.pill,
    minHeight: 36,
    minWidth: 72,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  scopePillBtnActive: {
    backgroundColor: colors.primary,
  },
  rangeCard: {
    padding: spacing.sm,
  },
  rangeScroll: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  rangePill: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  rangePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  clearDateButton: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
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
  exerciseButton: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 150,
    minHeight: 36,
    paddingHorizontal: spacing.md,
  },
  pointDetailCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  pointDetailHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trendSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  trendMetric: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    flexGrow: 1,
    minWidth: '47%',
    gap: 2,
    padding: spacing.md,
  },
  selectorSearch: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  selectorInput: {
    color: colors.text,
    flex: 1,
    minHeight: 42,
  },
  selectorList: {
    maxHeight: 360,
  },
  selectorSection: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  selectorOption: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  selectorOptionActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  selectorOptionText: {
    flex: 1,
    gap: 2,
  },
  recordSection: {
    gap: spacing.md,
  },
  emptyRecordCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  emptyRecordText: {
    flex: 1,
    gap: 2,
  },
  sessionList: {
    gap: spacing.sm,
  },
  recordCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  recordDateBox: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    gap: spacing.xs,
    minWidth: 56,
    padding: spacing.sm,
  },
  recordDot: {
    borderRadius: radius.pill,
    height: 7,
    width: 7,
  },
  recordDotDone: {
    backgroundColor: colors.success,
  },
  recordDotOpen: {
    backgroundColor: colors.warning,
  },
  recordMain: {
    flex: 1,
    gap: spacing.xs,
  },
  recordTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recordTitle: {
    flex: 1,
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  recordMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recordMetaItem: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    minWidth: 70,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  modalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalNavButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  weekdayLabel: {
    textAlign: 'center',
    width: '13.1%',
  },
  monthDay: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: '13.1%',
  },
  monthDayActive: {
    backgroundColor: colors.primary,
  },
  monthDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 4,
    marginTop: 2,
    width: 4,
  },
  monthDotActive: {
    backgroundColor: colors.surface,
  },
  modalActions: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
  },
});
