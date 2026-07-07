import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Equipment, Exercise, ExerciseCategory } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import {
  estimateOneRM,
  getCoreLiftKey,
  getCoreLiftName,
  getGroupHistoryAnalysis,
  type CoreLiftTrend,
  type GroupHistoryAnalysis,
  type HistoryTrendDirection,
  type PrTimelineItem,
} from '@/domain/history/history-analysis';
import { resolveDefaultTrainingMember } from '@/domain/member/member-selection';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { WorkoutSessionDetail, WorkoutSet } from '@/domain/workout/workout.types';

import {
  addDays,
  buildTrendBuckets,
  findBucketForDate,
  getDateSpanDays,
  getLocalDateString,
  parseLocalDate,
  type DateRangeValue,
} from './dateRange';

export type SessionSummary = {
  completedMembers: number;
  completedSets: number;
  date: string;
  exerciseCount: number;
  id: string;
  mainExerciseNames: string[];
  participantCount: number;
  title: string;
  totalSets: number;
  volume: number;
};

export type TrendPoint = {
  label: string;
  value: number;
};

export type MemberContributionView = {
  activeDays: number;
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  completedSets: number;
  completionRate: number;
  member: GroupMember;
  prCount: number;
  rank: number;
  sessionCount: number;
  statusLabel: '优秀' | '良好' | '一般' | '待提升';
  streakDays: number;
  volume: number;
};

export type CoreLiftCardView = {
  change?: number;
  direction: HistoryTrendDirection;
  exerciseId?: string;
  name: string;
  points: TrendPoint[];
  value?: number;
};

export type ExerciseAnalyticsView = {
  bestDate?: string;
  bestEstimatedOneRM: number;
  bestReps: number;
  bestRpe?: number;
  bestWeight: number;
  distribution: { label: string; ratio: number; value: number }[];
  exercise: Exercise | null;
  prTimeline: PrTimelineItem[];
  recentRecords: ExerciseRecordView[];
  suggestion: string;
  trendLabels: string[];
  trendOneRm: number[];
  trendVolume: number[];
  trendWeight: number[];
};

export type ExerciseRecordView = {
  date: string;
  estimatedOneRM: number;
  reps: number;
  rpe?: number;
  sessionId: string;
  setCount: number;
  volume: number;
  weight: number;
};

export type GroupExerciseCompareView = {
  exerciseId: string;
  exerciseName: string;
  labels: string[];
  members: {
    avatarLocalUri?: string;
    avatarThumbUrl?: string;
    avatarUrl?: string;
    bestEstimatedOneRM: number;
    bestLabel: string;
    member: GroupMember;
    values: number[];
  }[];
  records: {
    date: string;
    estimatedOneRM: number;
    isPr: boolean;
    member: GroupMember;
    reps: number;
    sessionId: string;
    weight: number;
  }[];
};

export type ExerciseTrendOption = {
  category: ExerciseCategory | 'other';
  equipment: Equipment | 'other';
  equipmentLabel: string;
  id: string;
  isRecent: boolean;
  name: string;
  recordCount: number;
  targetMuscle: string;
  lastTrainingDate?: string;
};

export type AttendanceView = {
  activeMembers: number;
  averageCompletionRate: number;
  completedSessions: number;
  memberRows: {
    completionRate: number;
    completedSessions: number;
    member: GroupMember;
    status: '优秀' | '稳定' | '待提升';
  }[];
  missedSessions: {
    absentMembers: GroupMember[];
    date: string;
    sessionId: string;
    title: string;
  }[];
  plannedSessions: number;
  trend: {
    completed: number;
    label: string;
    planned: number;
    rate: number;
  }[];
};

export type HistoryDataset = {
  currentMember: GroupMember | null;
  exerciseNamesById: Record<string, string>;
  exercises: Exercise[];
  group: Group;
  groupAnalysis: GroupHistoryAnalysis;
  groupSessions: SessionSummary[];
  memberContributions: MemberContributionView[];
  members: GroupMember[];
  profilesByMemberId: Record<string, MemberProfile | null>;
  personalSessions: SessionSummary[];
  range: DateRangeValue;
  details: WorkoutSessionDetail[];
};

function getSetWeight(set: WorkoutSet): number {
  return set.actualWeight ?? set.plannedWeight ?? 0;
}

function getSetReps(set: WorkoutSet): number {
  return set.actualReps ?? set.plannedReps ?? 0;
}

function getSetVolume(set: WorkoutSet): number {
  const weight = getSetWeight(set);
  const reps = getSetReps(set);
  return weight > 0 && reps > 0 ? weight * reps : 0;
}

function getCompletionRate(completed: number, total: number): number {
  return total > 0 ? completed / total : 0;
}

function formatDelta(current: number, previous: number, unit = ''): string {
  if (previous <= 0) return current > 0 ? `较上期 +${Math.round(current)}${unit}` : '较上期 持平';
  const delta = Math.round(current - previous);
  return delta === 0 ? '较上期 持平' : `较上期 ${delta > 0 ? '+' : ''}${delta}${unit}`;
}

export function formatKg(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}

export function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function getExerciseIds(details: WorkoutSessionDetail[]): string[] {
  return Array.from(new Set(details.flatMap((detail) => detail.exercises.map((exercise) => exercise.exerciseId))));
}

const equipmentLabels: Record<Equipment | 'other', string> = {
  barbell: '杠铃',
  bodyweight: '自重',
  cable: '绳索',
  dumbbell: '哑铃',
  machine: '固定器械',
  other: '其他',
  smith: '史密斯',
};

export function buildExerciseTrendOptions(dataset: HistoryDataset, memberId?: string): ExerciseTrendOption[] {
  const metaByExercise = new Map<string, { lastTrainingDate?: string; recordCount: number }>();
  const recentFromDate = getLocalDateString(addDays(parseLocalDate(dataset.range.toDate), -30));

  dataset.details.forEach((detail) => {
    detail.sets
      .filter((set) => set.completed && (!memberId || set.memberId === memberId))
      .forEach((set) => {
        const record = detail.exercises.find((item) => item.id === set.exerciseRecordId);
        if (!record) return;

        const current = metaByExercise.get(record.exerciseId) ?? { recordCount: 0 };
        metaByExercise.set(record.exerciseId, {
          lastTrainingDate:
            !current.lastTrainingDate || detail.session.date > current.lastTrainingDate
              ? detail.session.date
              : current.lastTrainingDate,
          recordCount: current.recordCount + 1,
        });
      });
  });

  const options: ExerciseTrendOption[] = [];
  dataset.exercises.forEach((exercise) => {
    const meta = metaByExercise.get(exercise.id);
    if (!meta) return;

    const option: ExerciseTrendOption = {
      category: exercise.category ?? 'other',
      equipment: exercise.equipment ?? 'other',
      equipmentLabel: equipmentLabels[exercise.equipment ?? 'other'] ?? '其他',
      id: exercise.id,
      isRecent: Boolean(meta.lastTrainingDate && meta.lastTrainingDate >= recentFromDate),
      name: exercise.name,
      recordCount: meta.recordCount,
      targetMuscle: exercise.targetMuscle,
    };
    if (meta.lastTrainingDate) {
      option.lastTrainingDate = meta.lastTrainingDate;
    }
    options.push(option);
  });

  return options.sort((left, right) => {
    if (left.isRecent !== right.isRecent) return left.isRecent ? -1 : 1;
    return right.recordCount - left.recordCount || left.name.localeCompare(right.name);
  });
}

function getMainExerciseNames(detail: WorkoutSessionDetail, exerciseNamesById: Record<string, string>, memberId?: string): string[] {
  const visibleRecordIds = new Set(
    detail.sets
      .filter((set) => set.completed && (!memberId || set.memberId === memberId))
      .map((set) => set.exerciseRecordId),
  );
  return detail.exercises
    .filter((record) => visibleRecordIds.has(record.id))
    .sort((left, right) => left.orderIndex - right.orderIndex)
    .map((record) => exerciseNamesById[record.exerciseId] ?? '训练动作')
    .filter((name, index, list) => list.indexOf(name) === index)
    .slice(0, 3);
}

export function summarizeSessions(
  details: WorkoutSessionDetail[],
  exerciseNamesById: Record<string, string>,
  memberId?: string,
): SessionSummary[] {
  return details
    .map((detail) => {
      const scopedSets = memberId ? detail.sets.filter((set) => set.memberId === memberId) : detail.sets;
      const completedSets = scopedSets.filter((set) => set.completed);
      const participantIds = new Set(scopedSets.map((set) => set.memberId));
      const completedMemberIds = new Set(completedSets.map((set) => set.memberId));
      const exerciseIds = new Set(
        completedSets.map(
          (set) => detail.exercises.find((record) => record.id === set.exerciseRecordId)?.exerciseId ?? set.exerciseRecordId,
        ),
      );
      return {
        completedMembers: completedMemberIds.size,
        completedSets: completedSets.length,
        date: detail.session.date,
        exerciseCount: exerciseIds.size,
        id: detail.session.id,
        mainExerciseNames: getMainExerciseNames(detail, exerciseNamesById, memberId),
        participantCount: participantIds.size,
        title: detail.session.title,
        totalSets: scopedSets.length,
        volume: completedSets.reduce((sum, set) => sum + getSetVolume(set), 0),
      };
    })
    .filter((summary) => summary.totalSets > 0 || summary.volume > 0)
    .sort((left, right) => right.date.localeCompare(left.date));
}

export function getSummaryMetrics(sessions: SessionSummary[]) {
  const volume = sessions.reduce((sum, session) => sum + session.volume, 0);
  const completedSets = sessions.reduce((sum, session) => sum + session.completedSets, 0);
  const totalSets = sessions.reduce((sum, session) => sum + session.totalSets, 0);
  return {
    completedSets,
    completionRate: getCompletionRate(completedSets, totalSets),
    sessionCount: sessions.length,
    totalSets,
    volume,
  };
}

export function buildVolumeTrend(sessions: SessionSummary[], range: DateRangeValue): { labels: string[]; values: number[] } {
  const buckets = buildTrendBuckets(range.fromDate, range.toDate);
  const valuesByBucket = new Map(buckets.map((bucket) => [bucket.key, 0]));
  sessions.forEach((session) => {
    const bucket = findBucketForDate(buckets, session.date);
    if (bucket) valuesByBucket.set(bucket.key, (valuesByBucket.get(bucket.key) ?? 0) + session.volume);
  });
  return {
    labels: buckets.map((bucket) => bucket.label),
    values: buckets.map((bucket) => valuesByBucket.get(bucket.key) ?? 0),
  };
}

// 训练频次趋势：按时间桶统计训练次数，用于"训练趋势"卡片
export function buildSessionCountTrend(sessions: SessionSummary[], range: DateRangeValue): { labels: string[]; values: number[] } {
  const buckets = buildTrendBuckets(range.fromDate, range.toDate);
  const countsByBucket = new Map(buckets.map((bucket) => [bucket.key, 0]));
  sessions.forEach((session) => {
    const bucket = findBucketForDate(buckets, session.date);
    if (bucket) countsByBucket.set(bucket.key, (countsByBucket.get(bucket.key) ?? 0) + 1);
  });
  return {
    labels: buckets.map((bucket) => bucket.label),
    values: buckets.map((bucket) => countsByBucket.get(bucket.key) ?? 0),
  };
}

export function getCountsByDate(sessions: SessionSummary[]): Record<string, number> {
  return sessions.reduce<Record<string, number>>((acc, session) => {
    acc[session.date] = (acc[session.date] ?? 0) + 1;
    return acc;
  }, {});
}

function previousRange(range: DateRangeValue): DateRangeValue {
  const span = getDateSpanDays(range.fromDate, range.toDate);
  const previousTo = new Date(parseLocalDate(range.fromDate));
  previousTo.setDate(previousTo.getDate() - 1);
  const previousFrom = new Date(previousTo);
  previousFrom.setDate(previousFrom.getDate() - (span - 1));
  const fromDate = previousFrom.toISOString().slice(0, 10);
  const toDate = previousTo.toISOString().slice(0, 10);
  return { fromDate, preset: 'custom', title: '上期', toDate };
}

export async function loadHistoryDataset(range: DateRangeValue): Promise<HistoryDataset> {
  const repositories = createLocalRepositories();
  await initializeLocalDatabase();
  const group = await repositories.groupRepository.getDefaultGroup();
  if (!group) {
    return createEmptyDataset(range);
  }

  const members = await repositories.memberRepository.listMembers(group.id);
  const currentMember = resolveDefaultTrainingMember(members);
  const previous = previousRange(range);
  const [sessions, previousSessions] = await Promise.all([
    repositories.workoutRepository.listSessions({ fromDate: range.fromDate, groupId: group.id, limit: 800, toDate: range.toDate }),
    repositories.workoutRepository.listSessions({ fromDate: previous.fromDate, groupId: group.id, limit: 800, toDate: previous.toDate }),
  ]);
  const [details, previousDetails] = await Promise.all([
    Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
    Promise.all(previousSessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id))),
  ]);
  const exerciseIds = getExerciseIds(details);
  const [exercises, profiles] = await Promise.all([
    exerciseIds.length > 0 ? repositories.exerciseRepository.listExercisesByIds(exerciseIds) : Promise.resolve([]),
    Promise.all(members.map(async (member) => [member.id, await repositories.memberRepository.getMemberProfile(member.id)] as const)),
  ]);
  const profilesByMemberId = Object.fromEntries(profiles);
  const exerciseNamesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise.name]));
  const groupSessions = summarizeSessions(details, exerciseNamesById);
  const personalSessions = currentMember ? summarizeSessions(details, exerciseNamesById, currentMember.id) : [];
  const rangeDays = getDateSpanDays(range.fromDate, range.toDate);
  const groupAnalysis = getGroupHistoryAnalysis({
    details,
    exerciseNamesById,
    groupId: group.id,
    groupName: group.name,
    members,
    rangeDays,
    recentDetails: details,
    today: parseLocalDate(range.toDate),
  });
  const previousByMember = buildMemberStats(previousDetails, members);
  const currentByMember = buildMemberStats(details, members);
  const memberContributions = members
    .map((member) => {
      const current = currentByMember.get(member.id) ?? createEmptyMemberStats();
      const previousStats = previousByMember.get(member.id) ?? createEmptyMemberStats();
      const profile = profilesByMemberId[member.id];
      return {
        activeDays: current.activeDays.size,
        avatarLocalUri: profile?.avatarLocalUri,
        avatarThumbUrl: profile?.avatarThumbUrl,
        avatarUrl: profile?.avatarUrl ?? member.avatarUrl,
        completedSets: current.completedSets,
        completionRate: getCompletionRate(current.completedSets, current.totalSets),
        member,
        prCount: current.prCount,
        rank: 0,
        sessionCount: current.sessionIds.size,
        statusLabel: getStatusLabel(getCompletionRate(current.completedSets, current.totalSets), current.completedSets),
        streakDays: Math.max(current.activeDays.size, previousStats.activeDays.size),
        volume: current.volume,
      };
    })
    .sort((left, right) => right.volume - left.volume || right.completedSets - left.completedSets)
    .map((member, index) => ({ ...member, rank: index + 1 }));

  return {
    currentMember,
    details,
    exerciseNamesById,
    exercises,
    group,
    groupAnalysis,
    groupSessions,
    memberContributions,
    members,
    personalSessions,
    profilesByMemberId,
    range,
  };
}

function createEmptyDataset(range: DateRangeValue): HistoryDataset {
  const now = new Date().toISOString();
  const group: Group = {
    activePlanId: '',
    createdAt: now,
    currentPhaseType: 'custom',
    currentWeek: 1,
    fridayEnabled: false,
    fridayStrategy: 'default_rest',
    id: '',
    name: '默认训练小组',
    updatedAt: now,
  };
  const groupAnalysis = getGroupHistoryAnalysis({
    details: [],
    exerciseNamesById: {},
    groupId: group.id,
    groupName: group.name,
    members: [],
    rangeDays: getDateSpanDays(range.fromDate, range.toDate),
    today: parseLocalDate(range.toDate),
  });

  return {
    currentMember: null,
    details: [],
    exerciseNamesById: {},
    exercises: [],
    group,
    groupAnalysis,
    groupSessions: [],
    memberContributions: [],
    members: [],
    personalSessions: [],
    profilesByMemberId: {},
    range,
  };
}

type MemberStats = {
  activeDays: Set<string>;
  completedSets: number;
  prCount: number;
  sessionIds: Set<string>;
  totalSets: number;
  volume: number;
};

function createEmptyMemberStats(): MemberStats {
  return {
    activeDays: new Set(),
    completedSets: 0,
    prCount: 0,
    sessionIds: new Set(),
    totalSets: 0,
    volume: 0,
  };
}

function buildMemberStats(details: WorkoutSessionDetail[], members: GroupMember[]) {
  const stats = new Map(members.map((member) => [member.id, createEmptyMemberStats()]));
  const bestByMemberExercise = new Map<string, number>();
  const chronological = [...details].sort((left, right) => left.session.date.localeCompare(right.session.date));
  chronological.forEach((detail) => {
    detail.sets.forEach((set) => {
      const memberStats = stats.get(set.memberId);
      if (!memberStats) return;
      memberStats.totalSets += 1;
      if (!set.completed) return;
      memberStats.completedSets += 1;
      memberStats.volume += getSetVolume(set);
      memberStats.activeDays.add(detail.session.date);
      memberStats.sessionIds.add(detail.session.id);
      const record = detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId);
      const exerciseId = record?.exerciseId ?? set.exerciseRecordId;
      const oneRm = estimateOneRM(getSetWeight(set), getSetReps(set));
      const key = `${set.memberId}:${exerciseId}`;
      const previousBest = bestByMemberExercise.get(key) ?? 0;
      if (oneRm > previousBest + 0.1) {
        bestByMemberExercise.set(key, oneRm);
        memberStats.prCount += 1;
      }
    });
  });
  return stats;
}

function getStatusLabel(rate: number, completedSets: number): MemberContributionView['statusLabel'] {
  if (completedSets === 0) return '待提升';
  if (rate >= 0.85) return '优秀';
  if (rate >= 0.65) return '良好';
  return '一般';
}

export function buildCoreLiftCards(dataset: HistoryDataset): CoreLiftCardView[] {
  const buckets = buildTrendBuckets(dataset.range.fromDate, dataset.range.toDate);
  const lifts: CoreLiftTrend['key'][] = ['bench', 'squat', 'deadlift', 'press'];
  return lifts.map((key) => {
    const values = buckets.map(() => 0);
    let exerciseId: string | undefined;
    dataset.details.forEach((detail) => {
      detail.sets
        .filter((set) => set.completed && (!dataset.currentMember || set.memberId === dataset.currentMember.id))
        .forEach((set) => {
          const record = detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId);
          if (!record) return;
          const name = dataset.exerciseNamesById[record.exerciseId] ?? '';
          if (getCoreLiftKey(name) !== key) return;
          const bucket = findBucketForDate(buckets, detail.session.date);
          const bucketIndex = bucket ? buckets.findIndex((item) => item.key === bucket.key) : -1;
          if (bucketIndex < 0) return;
          exerciseId = record.exerciseId;
          values[bucketIndex] = Math.max(values[bucketIndex], estimateOneRM(getSetWeight(set), getSetReps(set)));
        });
    });
    const activeValues = values.filter((value) => value > 0);
    const latest = activeValues.at(-1);
    const previous = activeValues.length > 1 ? activeValues.at(-2) : undefined;
    return {
      change: latest !== undefined && previous !== undefined ? Math.round((latest - previous) * 10) / 10 : undefined,
      direction: getDirection(values),
      exerciseId,
      name: getCoreLiftName(key),
      points: buckets.map((bucket, index) => ({ label: bucket.label, value: values[index] })),
      value: latest,
    };
  });
}

function getDirection(values: number[]): HistoryTrendDirection {
  const active = values.filter((value) => value > 0);
  if (active.length < 2) return 'unknown';
  const first = active[0];
  const latest = active.at(-1)!;
  if (latest > first * 1.03) return 'up';
  if (latest < first * 0.97) return 'down';
  return 'stable';
}

export function buildPrTimeline(dataset: HistoryDataset, memberId?: string, exerciseId?: string): PrTimelineItem[] {
  const bestByExercise = new Map<string, number>();
  const items: PrTimelineItem[] = [];
  const chronological = [...dataset.details].sort((left, right) => left.session.date.localeCompare(right.session.date));
  chronological.forEach((detail) => {
    detail.sets
      .filter((set) => set.completed && (!memberId || set.memberId === memberId))
      .forEach((set) => {
        const record = detail.exercises.find((exercise) => exercise.id === set.exerciseRecordId);
        if (!record || (exerciseId && record.exerciseId !== exerciseId)) return;
        const oneRm = estimateOneRM(getSetWeight(set), getSetReps(set));
        if (oneRm <= 0) return;
        const key = `${set.memberId}:${record.exerciseId}`;
        const previous = bestByExercise.get(key) ?? 0;
        if (oneRm > previous + 0.1) {
          bestByExercise.set(key, oneRm);
          items.push({
            date: detail.session.date,
            estimatedOneRM: oneRm,
            exerciseId: record.exerciseId,
            exerciseName: dataset.exerciseNamesById[record.exerciseId] ?? '训练动作',
            id: `${detail.session.id}:${set.id}`,
            reps: getSetReps(set),
            tag: '新 PR',
            weight: getSetWeight(set),
          });
        }
      });
  });
  return items.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 10);
}

export function buildPersonalInsights(dataset: HistoryDataset): string[] {
  const metrics = getSummaryMetrics(dataset.personalSessions);
  const trend = buildVolumeTrend(dataset.personalSessions, dataset.range).values;
  const first = trend.find((value) => value > 0) ?? 0;
  const latest = [...trend].reverse().find((value) => value > 0) ?? 0;
  const prCount = buildPrTimeline(dataset, dataset.currentMember?.id).length;
  return [
    latest > first && first > 0 ? `训练量持续上升，本周期达到 ${formatKg(metrics.volume)} kg。` : '当前训练量保持稳定，继续积累有效训练样本。',
    metrics.completionRate >= 0.85 ? `完成率 ${formatPercent(metrics.completionRate)}，计划执行质量不错。` : `完成率 ${formatPercent(metrics.completionRate)}，下一周期优先保证目标组。`,
    prCount > 0 ? `本周期记录到 ${prCount} 项 PR 动态。` : '本周期暂无新 PR，先保持动作质量和训练频率。',
  ];
}

export function buildExerciseAnalytics(dataset: HistoryDataset, exerciseId: string): ExerciseAnalyticsView {
  const exercise = dataset.exercises.find((item) => item.id === exerciseId) ?? null;
  const recordsBySession = new Map<string, ExerciseRecordView>();
  const chronological = [...dataset.details].sort((left, right) => left.session.date.localeCompare(right.session.date));

  chronological.forEach((detail) => {
    const exerciseSets = detail.sets.filter((set) => {
      const record = detail.exercises.find((item) => item.id === set.exerciseRecordId);
      return set.completed && record?.exerciseId === exerciseId && (!dataset.currentMember || set.memberId === dataset.currentMember.id);
    });
    if (exerciseSets.length === 0) return;
    const bestSet = exerciseSets
      .slice()
      .sort((left, right) => estimateOneRM(getSetWeight(right), getSetReps(right)) - estimateOneRM(getSetWeight(left), getSetReps(left)))[0];
    recordsBySession.set(detail.session.id, {
      date: detail.session.date,
      estimatedOneRM: estimateOneRM(getSetWeight(bestSet), getSetReps(bestSet)),
      reps: getSetReps(bestSet),
      rpe: bestSet.rpe,
      sessionId: detail.session.id,
      setCount: exerciseSets.length,
      volume: exerciseSets.reduce((sum, set) => sum + getSetVolume(set), 0),
      weight: getSetWeight(bestSet),
    });
  });

  const recentRecords = [...recordsBySession.values()].sort((left, right) => right.date.localeCompare(left.date));
  const best = recentRecords.slice().sort((left, right) => right.estimatedOneRM - left.estimatedOneRM)[0];
  const buckets = buildTrendBuckets(dataset.range.fromDate, dataset.range.toDate);
  const trendOneRm = buckets.map(() => 0);
  const trendWeight = buckets.map(() => 0);
  const trendVolume = buckets.map(() => 0);
  recentRecords.forEach((record) => {
    const bucket = findBucketForDate(buckets, record.date);
    const index = bucket ? buckets.findIndex((item) => item.key === bucket.key) : -1;
    if (index < 0) return;
    trendOneRm[index] = Math.max(trendOneRm[index], record.estimatedOneRM);
    trendWeight[index] = Math.max(trendWeight[index], record.weight);
    trendVolume[index] += record.volume;
  });

  const weights = recentRecords.flatMap((record) => Array.from({ length: Math.max(1, record.setCount) }, () => record.weight));
  const maxWeight = Math.max(0, ...weights);
  const step = maxWeight > 0 ? Math.max(5, Math.ceil(maxWeight / 5 / 5) * 5) : 20;
  const distribution = Array.from({ length: 5 }, (_, index) => {
    const high = Math.max(0, maxWeight - index * step);
    const low = Math.max(0, high - step);
    const count = weights.filter((weight) => (index === 4 ? weight < high : weight >= low && weight < high)).length;
    return {
      label: index === 0 ? `≥${Math.round(low)}kg` : index === 4 ? `<${Math.round(high)}kg` : `${Math.round(low)}-${Math.round(high)}kg`,
      ratio: weights.length > 0 ? count / weights.length : 0,
      value: count,
    };
  });

  const prTimeline = buildPrTimeline(dataset, dataset.currentMember?.id, exerciseId);
  const suggestion = best
    ? `主项可尝试 ${Math.max(0, Math.round((best.weight * 0.925) / 2.5) * 2.5)}kg x ${Math.max(3, best.reps)}，根据完成情况小幅推进。`
    : '完成一次有效训练后，会基于近期表现生成下次建议。';

  return {
    bestDate: best?.date,
    bestEstimatedOneRM: best?.estimatedOneRM ?? 0,
    bestReps: best?.reps ?? 0,
    bestRpe: best?.rpe,
    bestWeight: best?.weight ?? 0,
    distribution,
    exercise,
    prTimeline,
    recentRecords,
    suggestion,
    trendLabels: buckets.map((bucket) => bucket.label),
    trendOneRm,
    trendVolume,
    trendWeight,
  };
}

export function buildGroupExerciseCompare(dataset: HistoryDataset, exerciseId?: string): GroupExerciseCompareView | null {
  const selectedExerciseId = exerciseId ?? dataset.groupAnalysis.exerciseAnalyses[0]?.exerciseId ?? dataset.exercises[0]?.id;
  if (!selectedExerciseId) return null;
  const exerciseName = dataset.exerciseNamesById[selectedExerciseId] ?? dataset.exercises.find((item) => item.id === selectedExerciseId)?.name ?? '训练动作';
  const buckets = buildTrendBuckets(dataset.range.fromDate, dataset.range.toDate);
  const memberValues = new Map<string, number[]>(dataset.members.map((member) => [member.id, buckets.map(() => 0)]));
  const bestByMember = new Map<string, { estimatedOneRM: number; label: string }>();
  const records: GroupExerciseCompareView['records'] = [];
  const bestSeen = new Map<string, number>();

  [...dataset.details]
    .sort((left, right) => left.session.date.localeCompare(right.session.date))
    .forEach((detail) => {
      detail.sets
        .filter((set) => set.completed)
        .forEach((set) => {
          const record = detail.exercises.find((item) => item.id === set.exerciseRecordId);
          if (record?.exerciseId !== selectedExerciseId) return;
          const member = dataset.members.find((item) => item.id === set.memberId);
          if (!member) return;
          const oneRm = estimateOneRM(getSetWeight(set), getSetReps(set));
          const label = `${getSetWeight(set)}kg x ${getSetReps(set)}`;
          const current = bestByMember.get(member.id);
          if (!current || oneRm > current.estimatedOneRM) {
            bestByMember.set(member.id, { estimatedOneRM: oneRm, label });
          }
          const bucket = findBucketForDate(buckets, detail.session.date);
          const index = bucket ? buckets.findIndex((item) => item.key === bucket.key) : -1;
          if (index >= 0) {
            const values = memberValues.get(member.id);
            if (values) values[index] = Math.max(values[index], oneRm);
          }
          const key = `${member.id}:${selectedExerciseId}`;
          const previous = bestSeen.get(key) ?? 0;
          const isPr = oneRm > previous + 0.1;
          if (isPr) bestSeen.set(key, oneRm);
          records.push({
            date: detail.session.date,
            estimatedOneRM: oneRm,
            isPr,
            member,
            reps: getSetReps(set),
            sessionId: detail.session.id,
            weight: getSetWeight(set),
          });
        });
    });

  return {
    exerciseId: selectedExerciseId,
    exerciseName,
    labels: buckets.map((bucket) => bucket.label),
    members: dataset.members
      .map((member) => {
        const profile = dataset.profilesByMemberId[member.id];
        return {
          avatarLocalUri: profile?.avatarLocalUri,
          avatarThumbUrl: profile?.avatarThumbUrl,
          avatarUrl: profile?.avatarUrl ?? member.avatarUrl,
          bestEstimatedOneRM: bestByMember.get(member.id)?.estimatedOneRM ?? 0,
          bestLabel: bestByMember.get(member.id)?.label ?? '暂无',
          member,
          values: memberValues.get(member.id) ?? [],
        };
      })
      .filter((member) => member.bestEstimatedOneRM > 0)
      .sort((left, right) => right.bestEstimatedOneRM - left.bestEstimatedOneRM),
    records: records.sort((left, right) => right.date.localeCompare(left.date)).slice(0, 20),
  };
}

export function buildAttendanceView(dataset: HistoryDataset): AttendanceView {
  const summaries = dataset.groupSessions;
  const plannedSessions = summaries.length;
  const completedSessions = summaries.filter((session) => session.completedSets > 0).length;
  const activeMembers = dataset.memberContributions.filter((member) => member.completedSets > 0).length;
  const averageCompletionRate = summaries.length > 0
    ? summaries.reduce((sum, session) => sum + getCompletionRate(session.completedSets, session.totalSets), 0) / summaries.length
    : 0;
  const buckets = buildTrendBuckets(dataset.range.fromDate, dataset.range.toDate);
  const trend = buckets.map((bucket) => {
    const bucketSessions = summaries.filter((session) => session.date >= bucket.startDate && session.date <= bucket.endDate);
    const completed = bucketSessions.filter((session) => session.completedSets > 0).length;
    return {
      completed,
      label: bucket.label,
      planned: bucketSessions.length,
      rate: getCompletionRate(completed, bucketSessions.length),
    };
  });

  const memberRows = dataset.members.map((member) => {
    const sessionIds = new Set<string>();
    dataset.details.forEach((detail) => {
      if (detail.sets.some((set) => set.memberId === member.id && set.completed)) {
        sessionIds.add(detail.session.id);
      }
    });
    const rate = getCompletionRate(sessionIds.size, plannedSessions);
    return {
      completionRate: rate,
      completedSessions: sessionIds.size,
      member,
      status: rate >= 0.85 ? '优秀' as const : rate >= 0.6 ? '稳定' as const : '待提升' as const,
    };
  });

  const missedSessions = dataset.details
    .map((detail) => {
      const completedMemberIds = new Set(detail.sets.filter((set) => set.completed).map((set) => set.memberId));
      const absentMembers = dataset.members.filter((member) => !completedMemberIds.has(member.id));
      return {
        absentMembers,
        date: detail.session.date,
        sessionId: detail.session.id,
        title: detail.session.title,
      };
    })
    .filter((item) => item.absentMembers.length > 0)
    .slice(0, 6);

  return {
    activeMembers,
    averageCompletionRate,
    completedSessions,
    memberRows,
    missedSessions,
    plannedSessions,
    trend,
  };
}

export function getMetricDelta(currentSessions: SessionSummary[], previousSessions: SessionSummary[]) {
  const current = getSummaryMetrics(currentSessions);
  const previous = getSummaryMetrics(previousSessions);
  return {
    completion: `较上期 ${Math.round((current.completionRate - previous.completionRate) * 100) >= 0 ? '+' : ''}${Math.round((current.completionRate - previous.completionRate) * 100)}%`,
    sessions: formatDelta(current.sessionCount, previous.sessionCount, '次'),
    sets: formatDelta(current.completedSets, previous.completedSets, '组'),
    volume: formatDelta(current.volume, previous.volume, 'kg'),
  };
}
