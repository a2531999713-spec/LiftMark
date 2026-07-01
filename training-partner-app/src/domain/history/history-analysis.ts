import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import type { GroupMember } from '@/domain/member/member.types';

export type HistorySetEntry = {
  sessionId: string;
  exerciseId: string;
  memberId: string;
  date: string;
  weight?: number;
  reps?: number;
  completed: boolean;
};

export type HistoryTrendDirection = 'up' | 'down' | 'stable' | 'unknown';

export type HistoryAnalysis = {
  sampleSize: number;
  recentEntries: HistorySetEntry[];
  estimatedOneRMs: number[];
  bestEstimatedOneRM?: number;
  latestEstimatedOneRM?: number;
  isNearPr: boolean;
  completionRate: number;
  weightTrend: HistoryTrendDirection;
  estimatedOneRmTrend: HistoryTrendDirection;
  fatigueFlags: string[];
  suggestions: string[];
};

export type HistorySeries = {
  memberId: string;
  exerciseId: string;
  entries: HistorySetEntry[];
};

export type HistoryRangeWeeks = 4 | 8 | 12;

export type HistoryAnalysisRangeOption = {
  label: string;
  weeks: HistoryRangeWeeks;
};

export const historyAnalysisRangeOptions: HistoryAnalysisRangeOption[] = [
  { label: '最近 4 周', weeks: 4 },
  { label: '最近 8 周', weeks: 8 },
  { label: '最近 12 周', weeks: 12 },
];

export function getAvailableHistoryAnalysisRanges(): HistoryAnalysisRangeOption[] {
  return historyAnalysisRangeOptions;
}

export type WeeklyHistoryBucket = {
  label: string;
  startDate: string;
  endDate: string;
  volume: number;
  sessionCount: number;
  completedSets: number;
  totalSets: number;
  completionRate: number;
  prCount: number;
};

export type CoreLiftTrend = {
  key: 'bench' | 'squat' | 'deadlift' | 'press';
  name: string;
  currentEstimatedOneRM?: number;
  change?: number;
  direction: HistoryTrendDirection;
  points: {
    label: string;
    estimatedOneRM?: number;
  }[];
};

export type PrTimelineItem = {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  estimatedOneRM: number;
  tag: '新 PR' | '接近 PR' | '稳定';
};

export type PersonalHistoryAnalysis = {
  memberId: string;
  rangeWeeks: HistoryRangeWeeks;
  totalVolume: number;
  sessionCount: number;
  completedSets: number;
  totalSets: number;
  completionRate: number;
  volumeChangePercent?: number;
  completionChangePercent?: number;
  sessionTrendLabel: string;
  prCount: number;
  weeklyBuckets: WeeklyHistoryBucket[];
  currentWeek: WeeklyHistoryBucket;
  coreLifts: CoreLiftTrend[];
  prTimeline: PrTimelineItem[];
  insights: string[];
};

export type GroupHistoryTrendPoint = {
  date: string;
  label: string;
  volume: number;
  sessionCount: number;
  completedSets: number;
  totalSets: number;
  completionRate: number;
};

export type GroupExerciseKey = CoreLiftTrend['key'] | 'row' | 'pullup' | 'other';

export type GroupMemberContribution = {
  memberId: string;
  memberName: string;
  rank: number;
  volume: number;
  sessionCount: number;
  completedSets: number;
  totalSets: number;
  completionRate: number;
  lastTrainingDate?: string;
  mostTrainedExerciseName?: string;
  bestExerciseName?: string;
  statusLabel: '优秀' | '良好' | '一般' | '待开始';
};

export type GroupExerciseMemberPerformance = {
  memberId: string;
  memberName: string;
  bestWeight?: number;
  bestEstimatedOneRM?: number;
  latestVolume: number;
  latestLabel?: string;
  trend: HistoryTrendDirection;
};

export type GroupMemberTrendSeries = {
  memberId: string;
  memberName: string;
  values: number[];
};

export type GroupExerciseAnalysis = {
  key: string;
  exerciseId: string;
  exerciseName: string;
  metric: 'weight' | 'volume' | 'estimated_1rm';
  labels: string[];
  members: GroupExerciseMemberPerformance[];
  completedSets: number;
  sessionCount: number;
  trendSeries: GroupMemberTrendSeries[];
};

export type GroupRecentSession = {
  sessionId: string;
  date: string;
  title: string;
  volume: number;
  exerciseCount: number;
  completedMembers: number;
  totalMembers: number;
  completionRate: number;
};

export type GroupHistoryAnalysis = {
  groupId: string;
  groupName: string;
  rangeDays: number;
  memberCount: number;
  totalVolume: number;
  sessionCount: number;
  completedSets: number;
  totalSets: number;
  completionRate: number;
  activeMemberCount: number;
  memberContributions: GroupMemberContribution[];
  exerciseAnalyses: GroupExerciseAnalysis[];
  trend: GroupHistoryTrendPoint[];
  recentSessions: GroupRecentSession[];
  insights: string[];
};

export function estimateOneRM(weight: number, reps: number): number {
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps < 1 || reps > 12) {
    return 0;
  }

  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function parseLocalDate(date: string): Date {
  return new Date(`${date}T12:00:00`);
}

function toLocalDateString(date: Date): string {
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

function formatMonthDay(date: Date): string {
  return `${date.getMonth() + 1}/${`${date.getDate()}`.padStart(2, '0')}`;
}

function getChangePercent(current: number, previous: number): number | undefined {
  if (previous <= 0) {
    return current > 0 ? 100 : undefined;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function formatChangeLabel(current: number, previous: number): string {
  const change = getChangePercent(current, previous);
  if (change === undefined || Math.abs(change) < 3) {
    return '持平';
  }

  return `${change > 0 ? '+' : ''}${change}%`;
}

function getDirectionFromValues(values: number[]): HistoryTrendDirection {
  const active = values.filter((value) => value > 0);
  if (active.length < 2) {
    return 'unknown';
  }

  return getTrend([active[0], active.at(-1)!], 0.03);
}

function normalizeExerciseName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '');
}

export function getCoreLiftKey(name: string): CoreLiftTrend['key'] | null {
  const normalized = normalizeExerciseName(name);

  if (normalized.includes('卧推') || normalized.includes('benchpress')) {
    return 'bench';
  }

  if (normalized.includes('深蹲') || normalized.includes('squat')) {
    return 'squat';
  }

  if (normalized.includes('硬拉') || normalized.includes('deadlift')) {
    return 'deadlift';
  }

  if (normalized.includes('肩推') || normalized.includes('推举') || normalized.includes('overheadpress')) {
    return 'press';
  }

  return null;
}

export function getCoreLiftName(key: CoreLiftTrend['key']): string {
  const names: Record<CoreLiftTrend['key'], string> = {
    bench: '卧推',
    squat: '深蹲',
    deadlift: '硬拉',
    press: '肩推',
  };

  return names[key];
}

function getBucketIndex(date: string, rangeStart: Date, rangeWeeks: HistoryRangeWeeks): number {
  const diffDays = Math.floor((parseLocalDate(date).getTime() - rangeStart.getTime()) / 86400000);
  const index = Math.floor(diffDays / 7);
  if (index < 0 || index >= rangeWeeks) {
    return -1;
  }

  return index;
}

function getSessionSortValue(detail: WorkoutSessionDetail): string {
  return `${detail.session.date} ${detail.session.updatedAt}`;
}

type SetPerformance = {
  id: string;
  bucketIndex: number;
  date: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  estimatedOneRM: number;
};

export function getPersonalHistoryAnalysis(
  details: WorkoutSessionDetail[],
  memberId: string,
  exerciseNamesById: Record<string, string> = {},
  rangeWeeks: HistoryRangeWeeks = 4,
  today = new Date(),
): PersonalHistoryAnalysis {
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const rangeStart = addDays(endDate, -(rangeWeeks * 7 - 1));
  const buckets: WeeklyHistoryBucket[] = Array.from({ length: rangeWeeks }, (_, index) => {
    const start = addDays(rangeStart, index * 7);
    const end = addDays(start, 6);
    return {
      label: formatMonthDay(start),
      startDate: toLocalDateString(start),
      endDate: toLocalDateString(end),
      volume: 0,
      sessionCount: 0,
      completedSets: 0,
      totalSets: 0,
      completionRate: 0,
      prCount: 0,
    };
  });

  const sessionIdsByBucket = new Map<number, Set<string>>();
  const performances: SetPerformance[] = [];

  const chronologicalDetails = [...details].sort((left, right) => getSessionSortValue(left).localeCompare(getSessionSortValue(right)));

  for (const detail of chronologicalDetails) {
    const bucketIndex = getBucketIndex(detail.session.date, rangeStart, rangeWeeks);
    if (bucketIndex < 0) {
      continue;
    }

    const memberSets = detail.sets.filter((set) => set.memberId === memberId);
    if (memberSets.length === 0) {
      continue;
    }

    if (!sessionIdsByBucket.has(bucketIndex)) {
      sessionIdsByBucket.set(bucketIndex, new Set());
    }
    sessionIdsByBucket.get(bucketIndex)!.add(detail.session.id);

    for (const set of memberSets) {
      const record = detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId);
      const exerciseId = record?.exerciseId ?? set.exerciseRecordId;
      const exerciseName = exerciseNamesById[exerciseId] ?? '未知动作';
      const weight = set.actualWeight ?? set.plannedWeight ?? 0;
      const reps = set.actualReps ?? set.plannedReps ?? 0;
      buckets[bucketIndex].totalSets += 1;

      if (!set.completed) {
        continue;
      }

      buckets[bucketIndex].completedSets += 1;
      buckets[bucketIndex].volume += weight * reps;

      const estimatedOneRM = estimateOneRM(weight, reps);
      if (estimatedOneRM > 0) {
        performances.push({
          id: `${detail.session.id}:${set.id}`,
          bucketIndex,
          date: detail.session.date,
          exerciseId,
          exerciseName,
          weight,
          reps,
          estimatedOneRM,
        });
      }
    }
  }

  buckets.forEach((bucket, index) => {
    bucket.sessionCount = sessionIdsByBucket.get(index)?.size ?? 0;
    bucket.completionRate = bucket.totalSets > 0 ? bucket.completedSets / bucket.totalSets : 0;
  });

  const bestByExercise = new Map<string, number>();
  const timeline: PrTimelineItem[] = [];
  for (const performance of performances) {
    const previousBest = bestByExercise.get(performance.exerciseId) ?? 0;
    let tag: PrTimelineItem['tag'] = '稳定';
    if (performance.estimatedOneRM > previousBest + 0.1) {
      tag = '新 PR';
      bestByExercise.set(performance.exerciseId, performance.estimatedOneRM);
    } else if (previousBest > 0 && performance.estimatedOneRM >= previousBest * 0.97) {
      tag = '接近 PR';
    }

    if (tag !== '稳定') {
      timeline.push({ ...performance, tag });
    }
  }

  const prTimeline = timeline.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 12);
  const prCountByBucket = new Map<number, number>();
  prTimeline
    .filter((item) => item.tag === '新 PR')
    .forEach((item) => {
      const bucketIndex = getBucketIndex(item.date, rangeStart, rangeWeeks);
      if (bucketIndex >= 0) {
        prCountByBucket.set(bucketIndex, (prCountByBucket.get(bucketIndex) ?? 0) + 1);
      }
    });
  buckets.forEach((bucket, index) => {
    bucket.prCount = prCountByBucket.get(index) ?? 0;
  });

  const coreLiftKeys: CoreLiftTrend['key'][] = ['bench', 'squat', 'deadlift', 'press'];
  const coreLifts = coreLiftKeys.map((key) => {
    const values = buckets.map(() => 0);
    performances.forEach((performance) => {
      if (getCoreLiftKey(performance.exerciseName) === key) {
        values[performance.bucketIndex] = Math.max(values[performance.bucketIndex], performance.estimatedOneRM);
      }
    });
    const activeValues = values.filter((value) => value > 0);
    const currentEstimatedOneRM = activeValues.at(-1);
    const previousEstimatedOneRM = activeValues.length > 1 ? activeValues.at(-2) : undefined;

    return {
      key,
      name: getCoreLiftName(key),
      currentEstimatedOneRM,
      change:
        currentEstimatedOneRM !== undefined && previousEstimatedOneRM !== undefined
          ? Math.round((currentEstimatedOneRM - previousEstimatedOneRM) * 10) / 10
          : undefined,
      direction: getDirectionFromValues(values),
      points: values.map((estimatedOneRM, index) => ({
        label: buckets[index].label,
        estimatedOneRM: estimatedOneRM > 0 ? estimatedOneRM : undefined,
      })),
    };
  });

  const currentWeek = buckets.at(-1)!;
  const previousWeek = buckets.at(-2) ?? buckets[0];
  const totalVolume = buckets.reduce((sum, bucket) => sum + bucket.volume, 0);
  const sessionCount = buckets.reduce((sum, bucket) => sum + bucket.sessionCount, 0);
  const completedSets = buckets.reduce((sum, bucket) => sum + bucket.completedSets, 0);
  const totalSets = buckets.reduce((sum, bucket) => sum + bucket.totalSets, 0);
  const completionRate = totalSets > 0 ? completedSets / totalSets : 0;
  const prCount = buckets.reduce((sum, bucket) => sum + bucket.prCount, 0);
  const topImprovingLift = coreLifts.find((lift) => lift.direction === 'up');

  const insights = [
    currentWeek.volume > previousWeek.volume * 1.05
      ? `本周训练量较上周提升 ${formatChangeLabel(currentWeek.volume, previousWeek.volume)}`
      : currentWeek.volume < previousWeek.volume * 0.95 && previousWeek.volume > 0
        ? '本周训练量较上周回落，建议控制恢复节奏'
        : '近期训练量整体稳定',
    currentWeek.sessionCount >= previousWeek.sessionCount
      ? '近期训练频率保持稳定'
      : '本周训练次数减少，可优先保证下一次训练完成',
    completionRate >= 0.85
      ? '完成率较好，可以继续按计划推进'
      : completionRate >= 0.6
        ? '完成率处于可观察区间，下一周优先保证目标组'
        : '完成率偏低，建议下周降低总量或从保守重量恢复',
    prCount > 0 ? `本周期记录到 ${prCount} 项 PR 动态` : '本周期暂无新 PR，继续积累有效训练样本',
    topImprovingLift
      ? `${topImprovingLift.name}趋势上升，下一周可小幅推进`
      : '核心动作趋势样本仍在积累，可先保持技术质量',
  ];

  return {
    memberId,
    rangeWeeks,
    totalVolume,
    sessionCount,
    completedSets,
    totalSets,
    completionRate,
    volumeChangePercent: getChangePercent(currentWeek.volume, previousWeek.volume),
    completionChangePercent: getChangePercent(currentWeek.completionRate, previousWeek.completionRate),
    sessionTrendLabel: formatChangeLabel(currentWeek.sessionCount, previousWeek.sessionCount),
    prCount,
    weeklyBuckets: buckets,
    currentWeek,
    coreLifts,
    prTimeline,
    insights,
  };
}

export function getGroupExerciseKey(name: string): GroupExerciseKey | null {
  const coreKey = getCoreLiftKey(name);
  if (coreKey) {
    return coreKey;
  }

  const normalized = normalizeExerciseName(name);
  if (normalized.includes('划船') || normalized.includes('row')) {
    return 'row';
  }

  if (
    normalized.includes('引体') ||
    normalized.includes('下拉') ||
    normalized.includes('pullup') ||
    normalized.includes('pull-up') ||
    normalized.includes('chinup') ||
    normalized.includes('pulldown')
  ) {
    return 'pullup';
  }

  return null;
}

export function getGroupExerciseName(key: GroupExerciseKey): string {
  if (key === 'row') {
    return '划船';
  }

  if (key === 'pullup') {
    return '引体 / 下拉';
  }

  if (key === 'other') {
    return '其他动作';
  }

  return getCoreLiftName(key);
}

type GroupHistoryAnalysisInput = {
  groupId: string;
  groupName: string;
  members: GroupMember[];
  details: WorkoutSessionDetail[];
  exerciseNamesById?: Record<string, string>;
  recentDetails?: WorkoutSessionDetail[];
  rangeDays?: number;
  today?: Date;
};

function getSetVolume(weight?: number, reps?: number): number {
  const safeWeight = Number.isFinite(weight) ? weight ?? 0 : 0;
  const safeReps = Number.isFinite(reps) ? reps ?? 0 : 0;
  return safeWeight > 0 && safeReps > 0 ? safeWeight * safeReps : 0;
}

function getWorkoutSetVolume(set: WorkoutSessionDetail['sets'][number]): number {
  return getSetVolume(set.actualWeight ?? set.plannedWeight, set.actualReps ?? set.plannedReps);
}

function getCompletionRate(completedSets: number, totalSets: number): number {
  return totalSets > 0 ? completedSets / totalSets : 0;
}

function getContributionStatus(completionRate: number, completedSets: number): GroupMemberContribution['statusLabel'] {
  if (completedSets === 0) {
    return '待开始';
  }

  if (completionRate >= 0.85) {
    return '优秀';
  }

  if (completionRate >= 0.65) {
    return '良好';
  }

  return '一般';
}

function compareSessionDetailDesc(left: WorkoutSessionDetail, right: WorkoutSessionDetail): number {
  return `${right.session.date} ${right.session.updatedAt}`.localeCompare(`${left.session.date} ${left.session.updatedAt}`);
}

export function getGroupHistoryAnalysis(input: GroupHistoryAnalysisInput): GroupHistoryAnalysis {
  const rangeDays = input.rangeDays ?? 7;
  const today = input.today ?? new Date();
  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const rangeStart = addDays(endDate, -(rangeDays - 1));
  const memberMap = new Map(input.members.map((member) => [member.id, member]));
  const memberStats = new Map<
    string,
    {
      completedSets: number;
      exerciseStats: Map<string, { bestWeight: number; completedSets: number; volume: number }>;
      lastTrainingDate?: string;
      sessionIds: Set<string>;
      totalSets: number;
      volume: number;
    }
  >();
  input.members.forEach((member) => {
    memberStats.set(member.id, {
      completedSets: 0,
      exerciseStats: new Map(),
      sessionIds: new Set<string>(),
      totalSets: 0,
      volume: 0,
    });
  });
  const exerciseStatsById = new Map<
    string,
    Map<
      string,
      {
        bestEstimatedOneRM: number;
        bestWeight: number;
        completedSets: number;
        latestDate?: string;
        latestLabel?: string;
        sessionIds: Set<string>;
        totalVolume: number;
        volumeByDate: Map<string, number>;
      }
    >
  >();
  const exerciseNameById = new Map<string, string>();

  const trend = Array.from({ length: rangeDays }, (_, index) => {
    const date = addDays(rangeStart, index);
    return {
      date: toLocalDateString(date),
      label: formatMonthDay(date),
      volume: 0,
      sessionCount: 0,
      completedSets: 0,
      totalSets: 0,
      completionRate: 0,
      sessionIds: new Set<string>(),
    };
  });
  const trendByDate = new Map(trend.map((point) => [point.date, point]));

  for (const detail of input.details) {
    const trendPoint = trendByDate.get(detail.session.date);
    const sessionHasCompletedSet = detail.sets.some((set) => set.completed);
    if (trendPoint && sessionHasCompletedSet) {
      trendPoint.sessionIds.add(detail.session.id);
    }

    for (const set of detail.sets) {
      const stats = memberStats.get(set.memberId);
      if (!stats) {
        continue;
      }

      stats.totalSets += 1;
      if (trendPoint) {
        trendPoint.totalSets += 1;
      }

      if (!set.completed) {
        continue;
      }

      const volume = getWorkoutSetVolume(set);
      const record = detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId);
      const exerciseId = record?.exerciseId ?? set.exerciseRecordId;
      const exerciseName = input.exerciseNamesById?.[exerciseId] ?? '未知动作';
      const weight = set.actualWeight ?? set.plannedWeight ?? 0;
      const reps = set.actualReps ?? set.plannedReps ?? 0;
      stats.completedSets += 1;
      stats.volume += volume;
      stats.lastTrainingDate =
        !stats.lastTrainingDate || detail.session.date > stats.lastTrainingDate
          ? detail.session.date
          : stats.lastTrainingDate;
      stats.sessionIds.add(detail.session.id);
      const memberExerciseStats = stats.exerciseStats.get(exerciseName) ?? {
        bestWeight: 0,
        completedSets: 0,
        volume: 0,
      };
      memberExerciseStats.completedSets += 1;
      memberExerciseStats.volume += volume;
      memberExerciseStats.bestWeight = Math.max(memberExerciseStats.bestWeight, weight);
      stats.exerciseStats.set(exerciseName, memberExerciseStats);

      exerciseNameById.set(exerciseId, exerciseName);
      if (!exerciseStatsById.has(exerciseId)) {
        exerciseStatsById.set(exerciseId, new Map());
      }
      const memberExerciseById = exerciseStatsById.get(exerciseId)!;
      const current = memberExerciseById.get(set.memberId) ?? {
        bestEstimatedOneRM: 0,
        bestWeight: 0,
        completedSets: 0,
        sessionIds: new Set<string>(),
        totalVolume: 0,
        volumeByDate: new Map<string, number>(),
      };
      current.bestWeight = Math.max(current.bestWeight, weight);
      current.bestEstimatedOneRM = Math.max(current.bestEstimatedOneRM, estimateOneRM(weight, reps));
      current.completedSets += 1;
      current.sessionIds.add(detail.session.id);
      current.totalVolume += volume;
      current.volumeByDate.set(detail.session.date, (current.volumeByDate.get(detail.session.date) ?? 0) + volume);
      if (!current.latestDate || detail.session.date >= current.latestDate) {
        current.latestDate = detail.session.date;
        current.latestLabel = weight > 0 && reps > 0 ? `${weight}kg x ${reps}` : undefined;
      }
      memberExerciseById.set(set.memberId, current);

      if (trendPoint) {
        trendPoint.completedSets += 1;
        trendPoint.volume += volume;
      }
    }
  }

  const normalizedTrend: GroupHistoryTrendPoint[] = trend.map(({ sessionIds, ...point }) => ({
    ...point,
    sessionCount: sessionIds.size,
    completionRate: getCompletionRate(point.completedSets, point.totalSets),
  }));

  const memberContributions = input.members
    .map((member) => {
      const stats = memberStats.get(member.id)!;
      const completionRate = getCompletionRate(stats.completedSets, stats.totalSets);
      const exerciseStats = [...stats.exerciseStats.entries()];
      const mostTrainedExercise = exerciseStats
        .slice()
        .sort(([, left], [, right]) => right.completedSets - left.completedSets || right.volume - left.volume)[0];
      const bestExercise = exerciseStats
        .slice()
        .sort(([, left], [, right]) => right.bestWeight - left.bestWeight || right.volume - left.volume)[0];
      return {
        memberId: member.id,
        memberName: member.displayName,
        rank: 0,
        volume: stats.volume,
        sessionCount: stats.sessionIds.size,
        completedSets: stats.completedSets,
        totalSets: stats.totalSets,
        completionRate,
        lastTrainingDate: stats.lastTrainingDate,
        mostTrainedExerciseName: mostTrainedExercise?.[0],
        bestExerciseName: bestExercise?.[0],
        statusLabel: getContributionStatus(completionRate, stats.completedSets),
      };
    })
    .sort((left, right) => right.volume - left.volume || right.completedSets - left.completedSets || left.memberName.localeCompare(right.memberName))
    .map((contribution, index) => ({
      ...contribution,
      rank: index + 1,
    }));

  const trendDates = normalizedTrend.map((point) => point.date);
  const trendLabels = normalizedTrend.map((point) => point.label);
  const exerciseAnalyses: GroupExerciseAnalysis[] = [...exerciseStatsById.entries()]
    .map(([exerciseId, byMember]) => {
      const exerciseName = exerciseNameById.get(exerciseId) ?? '未知动作';
      const sessionIds = new Set<string>();
      let completedSets = 0;
      const members = input.members
        .map((member) => {
          const stats = byMember.get(member.id);
          const values = trendDates.map((date) => stats?.volumeByDate.get(date) ?? 0);
          const latestVolume = stats?.latestDate ? (stats.volumeByDate.get(stats.latestDate) ?? 0) : 0;
          stats?.sessionIds.forEach((sessionId) => sessionIds.add(sessionId));
          completedSets += stats?.completedSets ?? 0;
          return {
            memberId: member.id,
            memberName: member.displayName,
            bestWeight: stats && stats.bestWeight > 0 ? stats.bestWeight : undefined,
            bestEstimatedOneRM:
              stats && stats.bestEstimatedOneRM > 0 ? Math.round(stats.bestEstimatedOneRM * 10) / 10 : undefined,
            latestVolume,
            latestLabel: stats?.latestLabel,
            trend: getDirectionFromValues(values),
          };
        })
        .filter((member) => member.bestWeight !== undefined || member.latestVolume > 0)
        .sort((left, right) => (right.bestWeight ?? 0) - (left.bestWeight ?? 0) || right.latestVolume - left.latestVolume);
      const trendSeries = members.slice(0, 4).map((member) => {
        const stats = byMember.get(member.memberId);
        return {
          memberId: member.memberId,
          memberName: member.memberName,
          values: trendDates.map((date) => stats?.volumeByDate.get(date) ?? 0),
        };
      });

      return {
        key: exerciseId,
        exerciseId,
        exerciseName,
        metric: 'volume' as const,
        labels: trendLabels,
        members,
        completedSets,
        sessionCount: sessionIds.size,
        trendSeries,
      };
    })
    .filter((analysis) => analysis.members.length > 0)
    .sort(
      (left, right) =>
        right.sessionCount - left.sessionCount ||
        right.completedSets - left.completedSets ||
        right.members.reduce((sum, member) => sum + member.latestVolume, 0) -
          left.members.reduce((sum, member) => sum + member.latestVolume, 0) ||
        left.exerciseName.localeCompare(right.exerciseName),
    );

  const recentDetails = (input.recentDetails ?? input.details).slice().sort(compareSessionDetailDesc).slice(0, 5);
  const recentSessions = recentDetails.map((detail) => {
    const memberIds = new Set(detail.sets.map((set) => set.memberId).filter((memberId) => memberMap.has(memberId)));
    const completedMemberIds = new Set(
      detail.sets.filter((set) => set.completed && memberMap.has(set.memberId)).map((set) => set.memberId),
    );
    const completedSets = detail.sets.filter((set) => set.completed);
    return {
      sessionId: detail.session.id,
      date: detail.session.date,
      title: detail.session.title,
      volume: completedSets.reduce((sum, set) => sum + getWorkoutSetVolume(set), 0),
      exerciseCount: detail.exercises.length,
      completedMembers: completedMemberIds.size,
      totalMembers: memberIds.size || input.members.length,
      completionRate: getCompletionRate(completedSets.length, detail.sets.length),
    };
  });

  const totalVolume = normalizedTrend.reduce((sum, point) => sum + point.volume, 0);
  const completedSets = normalizedTrend.reduce((sum, point) => sum + point.completedSets, 0);
  const totalSets = normalizedTrend.reduce((sum, point) => sum + point.totalSets, 0);
  const sessionCount = normalizedTrend.reduce((sum, point) => sum + point.sessionCount, 0);
  const activeMemberCount = memberContributions.filter((member) => member.completedSets > 0).length;
  const completionRate = getCompletionRate(completedSets, totalSets);
  const topMember = memberContributions.find((member) => member.completedSets > 0);

  const insights =
    sessionCount === 0
      ? ['本周还没有小组训练记录，完成一次训练后会生成小组洞察。']
      : [
          `本周小组完成 ${sessionCount} 次训练，总训练量 ${Math.round(totalVolume).toLocaleString('zh-CN')} kg。`,
          topMember
            ? `${topMember.memberName} 当前贡献最高，完成 ${topMember.completedSets} 组。`
            : '成员贡献还在积累，先保证每位成员都有有效记录。',
          activeMemberCount === input.members.length
            ? '本周所有成员都有训练记录，节奏稳定。'
            : `${activeMemberCount}/${input.members.length} 名成员完成本周训练记录。`,
          completionRate >= 0.8
            ? '整体完成率较好，可以继续按当前计划推进。'
            : '整体完成率偏低，下一次训练可减少动作或降低目标重量。',
        ];

  return {
    groupId: input.groupId,
    groupName: input.groupName,
    rangeDays,
    memberCount: input.members.length,
    totalVolume,
    sessionCount,
    completedSets,
    totalSets,
    completionRate,
    activeMemberCount,
    memberContributions,
    exerciseAnalyses,
    trend: normalizedTrend,
    recentSessions,
    insights,
  };
}

function takeRecentFive(entries: HistorySetEntry[]): HistorySetEntry[] {
  return [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}

function getTrend(values: number[], threshold = 0.02): HistoryTrendDirection {
  if (values.length < 2) {
    return 'unknown';
  }

  const first = values[0];
  const last = values[values.length - 1];
  if (first <= 0) {
    return 'unknown';
  }

  const ratio = (last - first) / first;
  if (ratio > threshold) {
    return 'up';
  }

  if (ratio < -threshold) {
    return 'down';
  }

  return 'stable';
}

export function analyzeExerciseHistory(entries: HistorySetEntry[]): HistoryAnalysis {
  const recentEntries = takeRecentFive(entries);
  const chronological = [...recentEntries].reverse();
  const estimatedOneRMs = chronological
    .map((entry) => estimateOneRM(entry.weight ?? 0, entry.reps ?? 0))
    .filter((value) => value > 0);
  const weights = chronological
    .map((entry) => entry.weight ?? 0)
    .filter((value) => value > 0);
  const completionRate =
    recentEntries.length === 0
      ? 0
      : recentEntries.filter((entry) => entry.completed).length / recentEntries.length;
  const bestEstimatedOneRM = estimatedOneRMs.length > 0 ? Math.max(...estimatedOneRMs) : undefined;
  const latestEstimatedOneRM = estimatedOneRMs.at(-1);
  const isNearPr = Boolean(
    bestEstimatedOneRM && latestEstimatedOneRM && latestEstimatedOneRM >= bestEstimatedOneRM * 0.97,
  );
  const fatigueFlags = getFatigueFlags(chronological);
  const suggestions = getHistorySuggestions({
    completionRate,
    fatigueFlags,
    isNearPr,
    weightTrend: getTrend(weights),
    estimatedOneRmTrend: getTrend(estimatedOneRMs),
  });

  return {
    sampleSize: recentEntries.length,
    recentEntries,
    estimatedOneRMs,
    bestEstimatedOneRM,
    latestEstimatedOneRM,
    isNearPr,
    completionRate,
    weightTrend: getTrend(weights),
    estimatedOneRmTrend: getTrend(estimatedOneRMs),
    fatigueFlags,
    suggestions,
  };
}

export function selectLargestExerciseSeries(entries: HistorySetEntry[]): HistorySeries | null {
  const groups = new Map<string, HistorySetEntry[]>();

  for (const entry of entries) {
    const key = `${entry.memberId}:${entry.exerciseId}`;
    groups.set(key, [...(groups.get(key) ?? []), entry]);
  }

  const largest = [...groups.entries()].sort(([, left], [, right]) => right.length - left.length)[0];
  if (!largest) {
    return null;
  }

  const [key, seriesEntries] = largest;
  const [memberId, exerciseId] = key.split(':');

  return {
    memberId,
    exerciseId,
    entries: seriesEntries,
  };
}

function getFatigueFlags(entries: HistorySetEntry[]): string[] {
  const recent = entries.slice(-5);
  const lastTwo = recent.slice(-2);
  const flags: string[] = [];

  if (lastTwo.length === 2 && lastTwo.every((entry) => !entry.completed)) {
    flags.push('连续未完成');
  }

  const volumes = recent.map((entry) => (entry.weight ?? 0) * (entry.reps ?? 0));
  if (volumes.length >= 2 && volumes[0] > 0 && volumes.at(-1)! < volumes[0] * 0.85) {
    flags.push('训练容量明显下降');
  }

  return flags;
}

type SuggestionInput = Pick<
  HistoryAnalysis,
  'completionRate' | 'fatigueFlags' | 'isNearPr' | 'weightTrend' | 'estimatedOneRmTrend'
>;

function getHistorySuggestions(input: SuggestionInput): string[] {
  if (input.fatigueFlags.length > 0) {
    return ['近期疲劳偏高，建议维持或减量'];
  }

  if (input.isNearPr) {
    return ['近期表现接近 PR，可考虑小幅尝试'];
  }

  if (input.completionRate >= 0.8 && input.weightTrend !== 'down') {
    return ['状态良好，可以尝试小幅加重', '完成率稳定，可继续推进'];
  }

  if (input.estimatedOneRmTrend === 'down' || input.completionRate < 0.6) {
    return ['表现波动较大，建议观察 1-2 次训练'];
  }

  return ['完成率稳定，可继续推进'];
}
