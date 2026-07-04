import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { ChartTooltip } from '@/components/history/ChartTooltip';
import { ExerciseTrendFilterSheet, type ExerciseTrendOption } from '@/components/history/ExerciseTrendFilterSheet';
import { HistoryBarChart, type HistoryBarPoint } from '@/components/history/HistoryBarChart';
import { HistoryFilterBar } from '@/components/history/HistoryFilterBar';
import { HistoryLineChart, type HistoryLinePoint } from '@/components/history/HistoryLineChart';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Equipment, Exercise, ExerciseCategory } from '@/domain/exercise/exercise.types';
import { getHistoryChartMode, type HistoryChartMode } from '@/domain/history/history-chart-mode';
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
  isSingleDay: boolean;
  label: string;
  toDate: string;
};

type ExerciseFilterOption = ExerciseTrendOption;

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
  metricLabel?: string;
  setCount: number;
  sessionId?: string;
  topSetLabel?: string;
  value: number;
  volume: number;
};

type HistoryState = {
  currentMember: GroupMember | null;
  exerciseOptions: ExerciseFilterOption[];
  groupName: string;
  membersById: Record<string, GroupMember>;
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

const exerciseCategoryLabels: Record<ExerciseCategory | 'other', string> = {
  arms: '手臂',
  back: '背',
  calves: '小腿',
  chest: '胸',
  core: '核心',
  full_body: '全身',
  legs: '腿',
  other: '其他',
  shoulder: '肩',
};

const equipmentLabels: Record<Equipment | 'other', string> = {
  barbell: '杠铃',
  bodyweight: '自重',
  cable: '绳索',
  dumbbell: '哑铃',
  machine: '固定器械',
  other: '其他',
  smith: '史密斯',
};

function createEmptyHistory(currentMember: GroupMember | null = null): HistoryState {
  return {
    currentMember,
    exerciseOptions: [],
    groupEntries: [],
    groupName: '默认训练小组',
    groupSessions: [],
    membersById: {},
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
      isSingleDay: true,
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
      isSingleDay: false,
      label: '本月',
      toDate: getLocalDateString(end),
    };
  }

  const dayCount = rangeKey === '7d' ? 7 : 30;
  return {
    fromDate: getLocalDateString(addDays(today, -(dayCount - 1))),
    isSingleDay: false,
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

function buildExerciseOptions(exercises: Exercise[], entries: HistorySetEntry[]): ExerciseFilterOption[] {
  const statsByExercise = new Map<string, { lastTrainingDate?: string; recordCount: number }>();

  entries
    .filter((entry) => entry.completed)
    .forEach((entry) => {
      const current = statsByExercise.get(entry.exerciseId) ?? { recordCount: 0 };
      current.recordCount += 1;
      current.lastTrainingDate =
        !current.lastTrainingDate || entry.date > current.lastTrainingDate ? entry.date : current.lastTrainingDate;
      statsByExercise.set(entry.exerciseId, current);
    });

  const recentCutoff = [...statsByExercise.values()]
    .map((stats) => stats.lastTrainingDate)
    .filter((date): date is string => Boolean(date))
    .sort()
    .at(-5);

  return exercises
    .map((exercise) => {
      const stats = statsByExercise.get(exercise.id) ?? { recordCount: 0 };
      return {
        category: exercise.category,
        equipment: exercise.equipment,
        equipmentLabel: equipmentLabels[exercise.equipment],
        id: exercise.id,
        isRecent: Boolean(stats.lastTrainingDate && (!recentCutoff || stats.lastTrainingDate >= recentCutoff)),
        lastTrainingDate: stats.lastTrainingDate,
        name: exercise.name,
        recordCount: stats.recordCount,
        targetMuscle: exercise.targetMuscle || exerciseCategoryLabels[exercise.category],
      };
    })
    .filter((option) => option.recordCount > 0)
    .sort((left, right) => {
      if (left.isRecent !== right.isRecent) return left.isRecent ? -1 : 1;
      return right.recordCount - left.recordCount || left.name.localeCompare(right.name);
    });
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
        setId: set.id,
        setNumber: set.setNumber,
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
      setId: set.id,
      setNumber: set.setNumber,
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
      metricLabel: '训练量',
      sessionId: summary.id,
      setCount: summary.setCount,
      value: summary.volume,
      volume: summary.volume,
    }));
}

function buildExerciseTrend(entries: HistorySetEntry[]): TrendPoint[] {
  const bySession = new Map<
    string,
    TrendPoint & {
      bestEstimatedOneRM: number;
      bestWeight: number;
    }
  >();
  entries
    .filter((entry) => entry.completed && (entry.weight ?? 0) > 0 && (entry.reps ?? 0) > 0)
    .forEach((entry) => {
      const current = bySession.get(entry.sessionId) ?? {
        bestEstimatedOneRM: 0,
        bestWeight: 0,
        date: entry.date,
        exerciseCount: 1,
        label: formatShortDate(entry.date),
        metricLabel: '训练量',
        sessionId: entry.sessionId,
        setCount: 0,
        value: 0,
        volume: 0,
      };
      const weight = entry.weight ?? 0;
      const reps = entry.reps ?? 0;
      const previousBestWeight = current.bestWeight;
      current.setCount += 1;
      current.volume += weight * reps;
      current.bestWeight = Math.max(current.bestWeight, weight);
      current.bestEstimatedOneRM = Math.max(current.bestEstimatedOneRM, estimateOneRM(weight, reps));
      if (current.bestEstimatedOneRM > 0) {
        current.value = current.bestEstimatedOneRM;
        current.metricLabel = '估算 1RM';
      } else if (current.bestWeight > 0) {
        current.value = current.bestWeight;
        current.metricLabel = '最高重量';
      } else {
        current.value = current.volume;
        current.metricLabel = '训练量';
      }
      current.topSetLabel = !current.topSetLabel || weight >= previousBestWeight ? `${weight}kg x ${reps}` : current.topSetLabel;
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

function buildExerciseBreakdownBars(entries: HistorySetEntry[], exerciseOptions: ExerciseFilterOption[]): HistoryBarPoint[] {
  const namesById = new Map(exerciseOptions.map((option) => [option.id, option.name]));
  const stats = new Map<string, { setCount: number; value: number }>();

  entries
    .filter((entry) => entry.completed)
    .forEach((entry) => {
      const current = stats.get(entry.exerciseId) ?? { setCount: 0, value: 0 };
      current.setCount += 1;
      current.value += (entry.weight ?? 0) * (entry.reps ?? 0);
      stats.set(entry.exerciseId, current);
    });

  const sorted = [...stats.entries()]
    .map(([exerciseId, stat]) => ({
      id: exerciseId,
      label: namesById.get(exerciseId) ?? '训练动作',
      meta: `${stat.setCount} 组`,
      value: stat.value,
    }))
    .sort((left, right) => right.value - left.value);

  if (sorted.length <= 6) {
    return sorted;
  }

  const top = sorted.slice(0, 6);
  const rest = sorted.slice(6);
  return [
    ...top,
    {
      id: 'other',
      label: '其他',
      meta: `${rest.length} 个动作`,
      value: rest.reduce((sum, item) => sum + item.value, 0),
    },
  ];
}

function buildSetBreakdownBars(entries: HistorySetEntry[]): HistoryBarPoint[] {
  return entries
    .filter((entry) => entry.completed)
    .slice()
    .sort((left, right) => (left.setNumber ?? 0) - (right.setNumber ?? 0))
    .map((entry, index) => ({
      id: entry.setId ?? `${entry.sessionId}-${index}`,
      label: `第 ${entry.setNumber ?? index + 1} 组`,
      meta: `${entry.weight ?? 0} kg x ${entry.reps ?? 0}`,
      value: entry.weight ?? 0,
    }));
}

function buildMemberContributionBars(entries: HistorySetEntry[], membersById: Record<string, GroupMember>): HistoryBarPoint[] {
  const stats = new Map<string, { sessionIds: Set<string>; setCount: number; value: number }>();

  entries
    .filter((entry) => entry.completed)
    .forEach((entry) => {
      const current = stats.get(entry.memberId) ?? { sessionIds: new Set<string>(), setCount: 0, value: 0 };
      current.sessionIds.add(entry.sessionId);
      current.setCount += 1;
      current.value += (entry.weight ?? 0) * (entry.reps ?? 0);
      stats.set(entry.memberId, current);
    });

  return [...stats.entries()]
    .map(([memberId, stat]) => ({
      id: memberId,
      label: membersById[memberId]?.displayName ?? '成员',
      meta: `${stat.setCount} 组 · ${stat.sessionIds.size} 次`,
      value: stat.value,
    }))
    .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label));
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
  const [isExerciseFilterVisible, setExerciseFilterVisible] = useState(false);
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
      const exerciseOptions = buildExerciseOptions(exercises, [...personalEntries, ...groupEntries]);

      setHistory({
        currentMember,
        exerciseOptions,
        groupEntries,
        groupName: group.name,
        groupSessions: groupDetails
          .map((detail) => summarizeSession(detail, exerciseNamesById))
          .filter((summary) => summary.setCount > 0),
        membersById: Object.fromEntries(members.map((member) => [member.id, member])),
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
  const filteredEntries = effectiveSelectedExerciseId
    ? activeEntries.filter((entry) => entry.exerciseId === effectiveSelectedExerciseId)
    : activeEntries;
  const chartMode = getHistoryChartMode({
    dateFilter: dateRange.isSingleDay ? 'single_day' : 'range',
    scope: dataScope,
    selectedExerciseId: effectiveSelectedExerciseId,
    selectedMemberId: history.currentMember?.id,
  });
  const barData =
    chartMode === 'single_day_exercise_breakdown'
      ? buildExerciseBreakdownBars(activeEntries, history.exerciseOptions)
      : chartMode === 'single_day_set_breakdown'
        ? buildSetBreakdownBars(filteredEntries)
        : chartMode === 'group_single_day_contribution'
          ? buildMemberContributionBars(filteredEntries, history.membersById)
          : [];
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
              <HistoryFilterBar
                groupName={history.groupName}
                memberName={history.currentMember?.displayName ?? '暂无成员'}
                onOpenDatePicker={() => setDateSheetVisible(true)}
                onOpenExerciseFilter={() => setExerciseFilterVisible(true)}
                onRangeChange={(nextRange) => {
                  setRangeKey(nextRange);
                  setSelectedDate(null);
                }}
                onResetDate={() => setSelectedDate(null)}
                onScopeChange={(scope) => {
                  if (scope === 'group' && !guardFeature('group_analytics')) {
                    return;
                  }
                  setDataScope(scope);
                }}
                rangeKey={rangeKey}
                scope={dataScope}
                selectedDate={selectedDate}
                selectedExerciseName={selectedExerciseName}
              />

              <TrainingTrendCard
                barData={barData}
                chartMode={chartMode}
                dataScope={dataScope}
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

      <ExerciseTrendFilterSheet
        onClose={() => setExerciseFilterVisible(false)}
        onSelect={setSelectedExerciseId}
        options={history.exerciseOptions}
        selectedExerciseId={effectiveSelectedExerciseId}
        visible={isExerciseFilterVisible}
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

function TrainingTrendCard({
  barData,
  chartMode,
  dataScope,
  rangeLabel,
  selectedExerciseId,
  selectedExerciseName,
  trend,
}: {
  barData: HistoryBarPoint[];
  chartMode: HistoryChartMode;
  dataScope: DataScope;
  rangeLabel: string;
  selectedExerciseId: string | null;
  selectedExerciseName?: string;
  trend: TrendPoint[];
}) {
  const [selectedPoint, setSelectedPoint] = useState<SelectedTrendPoint>(null);
  const [selectedBar, setSelectedBar] = useState<HistoryBarPoint | null>(null);
  const values = trend.map((point) => point.value);
  const volumes = trend.map((point) => point.volume);
  const activeValues = values.filter((value) => value > 0);
  const totalVolume = volumes.reduce((sum, value) => sum + value, 0);
  const latestVolume = activeValues.at(-1) ?? 0;
  const maxVolume = Math.max(0, ...values);
  const keyPointIndexes = getKeyPointIndexes(values, selectedPoint?.index);
  const isBarMode =
    chartMode === 'single_day_exercise_breakdown' ||
    chartMode === 'single_day_set_breakdown' ||
    chartMode === 'group_single_day_contribution';
  const chartCopy = getChartCopy(chartMode, dataScope, selectedExerciseName);
  const barTotal = barData.reduce((sum, point) => sum + point.value, 0);
  const barMax = Math.max(0, ...barData.map((point) => point.value));

  return (
    <AppCard style={styles.trendCard}>
      <View style={styles.trendHeader}>
        <View style={styles.trendTitleBlock}>
          <AppText variant="subtitle">{chartCopy.title}</AppText>
          <AppText tone="muted" variant="caption">
            {rangeLabel} · {chartCopy.subtitle}
          </AppText>
        </View>
        <Tag label={selectedExerciseName ?? '全部动作'} tone={selectedExerciseId ? 'brand' : 'neutral'} />
      </View>

      {isBarMode ? (
        <HistoryBarChart
          emptyMessage="这一天还没有可展示的训练数据"
          formatValue={chartMode === 'single_day_set_breakdown' ? (value) => `${Math.round(value)}kg` : formatCompactKg}
          onBarPress={(point) => {
            setSelectedBar(point);
            setSelectedPoint(null);
          }}
          points={barData}
          selectedId={selectedBar?.id}
        />
      ) : (
        <HistoryLineChart
          emptyMessage="当前范围还没有训练量"
          formatValue={formatCompactKg}
          highlightIndex={selectedPoint?.index}
          keyPointIndexes={keyPointIndexes}
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
            setSelectedBar(null);
          }}
          points={trend.map((point): HistoryLinePoint => ({
            date: point.date,
            label: point.label,
            meta: point.metricLabel,
            value: point.value,
          }))}
        />
      )}

      {selectedPoint ? (
        <ChartTooltip
          metrics={[
            { label: trend[selectedPoint.index]?.metricLabel ?? '指标', value: formatKg(selectedPoint.value) },
            { label: '组数', value: `${selectedPoint.setCount} 组` },
            { label: '动作', value: `${selectedPoint.exerciseCount} 个` },
          ]}
          subtitle={selectedPoint.changeLabel}
          title={selectedPoint.date ?? selectedPoint.label}
          tone={selectedPoint.changeLabel.startsWith('+') ? 'success' : 'neutral'}
        />
      ) : null}

      {selectedBar ? (
        <ChartTooltip
          metrics={[
            {
              label: chartMode === 'single_day_set_breakdown' ? '重量' : '训练量',
              value: chartMode === 'single_day_set_breakdown' ? `${Math.round(selectedBar.value)} kg` : formatKg(selectedBar.value),
            },
          ]}
          subtitle={selectedBar.meta}
          title={selectedBar.label}
        />
      ) : null}

      <View style={styles.trendSummaryGrid}>
        {isBarMode ? (
          <>
            <TrendMetric label={chartMode === 'single_day_set_breakdown' ? '最高重量' : '合计'} value={barMax > 0 ? formatKg(chartMode === 'single_day_set_breakdown' ? barMax : barTotal) : '暂无'} />
            <TrendMetric label="条目" value={`${barData.length} 项`} />
            <TrendMetric label="最高项" value={barData[0]?.label ?? '暂无'} />
            <TrendMetric label="图表" value="条形图" />
          </>
        ) : (
          <>
            <TrendMetric label="范围总量" value={formatKg(totalVolume)} />
            <TrendMetric label={selectedExerciseId ? '最新指标' : '最新一次'} value={latestVolume > 0 ? formatKg(latestVolume) : '暂无'} />
            <TrendMetric label="最高点" value={maxVolume > 0 ? formatKg(maxVolume) : '暂无'} />
            <TrendMetric label="趋势" value={getTrendLabel(values)} />
          </>
        )}
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
    </AppCard>
  );
}

function getChartCopy(mode: HistoryChartMode, scope: DataScope, selectedExerciseName?: string) {
  if (mode === 'range_exercise_trend') {
    return {
      subtitle: `${selectedExerciseName ?? '动作'} · 估算 1RM / 最高重量优先`,
      title: '动作趋势',
    };
  }

  if (mode === 'single_day_exercise_breakdown') {
    return {
      subtitle: '按动作训练量排序',
      title: '当天动作构成',
    };
  }

  if (mode === 'single_day_set_breakdown') {
    return {
      subtitle: `${selectedExerciseName ?? '动作'} · 每组重量`,
      title: '当天组表现',
    };
  }

  if (mode === 'group_range_trend') {
    return {
      subtitle: selectedExerciseName ? `${selectedExerciseName} · 小组总量` : '成员 sets 汇总',
      title: '小组训练趋势',
    };
  }

  if (mode === 'group_single_day_contribution') {
    return {
      subtitle: selectedExerciseName ? `${selectedExerciseName} · 成员对比` : '成员训练量贡献',
      title: '成员贡献',
    };
  }

  return {
    subtitle: scope === 'personal' ? '总训练量' : '小组总训练量',
    title: '整体趋势',
  };
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
  onClose,
  onMonthChange,
  onSelectDate,
  selectedDate,
  trainingDates,
  visible,
}: {
  monthCursor: Date;
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
