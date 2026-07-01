import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppCard, AppText, EmptyState, MultiLineTrendChart, Screen, SecondaryPageHeader, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import { estimateOneRM } from '@/domain/history/history-analysis';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type ExerciseMemberSummary = {
  memberId: string;
  memberName: string;
  profile: MemberProfile | null;
  bestEstimatedOneRM: number;
  bestWeight: number;
  completedSets: number;
  latestDate?: string;
  latestLabel?: string;
  totalVolume: number;
};

type ExerciseRecordRow = {
  date: string;
  estimatedOneRM: number;
  memberId: string;
  memberName: string;
  reps: number;
  sessionId: string;
  volume: number;
  weight: number;
};

type ExerciseAnalysisMetric = 'best_weight' | 'volume' | 'estimated_1rm';
type ExerciseAnalysisRange = '30d' | '90d' | 'all';

type ExerciseDetailView = {
  completedSets: number;
  exerciseName: string;
  groupName: string;
  memberSummaries: ExerciseMemberSummary[];
  records: ExerciseRecordRow[];
  sessionCount: number;
  totalVolume: number;
};

const metricOptions: { label: string; value: ExerciseAnalysisMetric }[] = [
  { label: '训练容量', value: 'volume' },
  { label: '最佳重量', value: 'best_weight' },
  { label: '估算 1RM', value: 'estimated_1rm' },
];

const metricTitleLabels: Record<ExerciseAnalysisMetric, string> = {
  best_weight: '最佳重量',
  estimated_1rm: '估算 1RM',
  volume: '训练容量',
};

const rangeOptions: { label: string; value: ExerciseAnalysisRange }[] = [
  { label: '30 天', value: '30d' },
  { label: '90 天', value: '90d' },
  { label: '全部', value: 'all' },
];

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

function getDetailSortValue(detail: WorkoutSessionDetail): string {
  return `${detail.session.date} ${detail.session.updatedAt}`;
}

function buildExerciseDetailView({
  details,
  exerciseId,
  exerciseNamesById,
  groupName,
  members,
  profilesByMemberId,
}: {
  details: WorkoutSessionDetail[];
  exerciseId: string;
  exerciseNamesById: Record<string, string>;
  groupName: string;
  members: GroupMember[];
  profilesByMemberId: Record<string, MemberProfile | null>;
}): ExerciseDetailView {
  const memberMap = new Map(members.map((member) => [member.id, member]));
  const sessionIds = new Set<string>();
  const memberStats = new Map<string, ExerciseMemberSummary>();
  const records: ExerciseRecordRow[] = [];

  const chronologicalDetails = details.slice().sort((left, right) => getDetailSortValue(left).localeCompare(getDetailSortValue(right)));
  for (const detail of chronologicalDetails) {
    for (const set of detail.sets) {
      if (!set.completed) continue;

      const exerciseRecord = detail.exercises.find((record) => record.id === set.exerciseRecordId);
      if (exerciseRecord?.exerciseId !== exerciseId) continue;

      const member = memberMap.get(set.memberId);
      if (!member) continue;

      const weight = set.actualWeight ?? set.plannedWeight ?? 0;
      const reps = set.actualReps ?? set.plannedReps ?? 0;
      if (weight <= 0 || reps <= 0) continue;

      const volume = weight * reps;
      const estimatedOneRM = estimateOneRM(weight, reps);
      sessionIds.add(detail.session.id);

      const current =
        memberStats.get(member.id) ??
        {
          memberId: member.id,
          memberName: member.displayName,
          profile: profilesByMemberId[member.id] ?? null,
          bestEstimatedOneRM: 0,
          bestWeight: 0,
          completedSets: 0,
          totalVolume: 0,
        };
      current.bestEstimatedOneRM = Math.max(current.bestEstimatedOneRM, estimatedOneRM);
      current.bestWeight = Math.max(current.bestWeight, weight);
      current.completedSets += 1;
      current.totalVolume += volume;
      current.latestDate = detail.session.date;
      current.latestLabel = `${weight}kg x ${reps}`;
      memberStats.set(member.id, current);

      records.push({
        date: detail.session.date,
        estimatedOneRM,
        memberId: member.id,
        memberName: member.displayName,
        reps,
        sessionId: detail.session.id,
        volume,
        weight,
      });
    }
  }

  const memberSummaries = [...memberStats.values()].sort(
    (left, right) =>
      right.bestEstimatedOneRM - left.bestEstimatedOneRM ||
      right.totalVolume - left.totalVolume ||
      left.memberName.localeCompare(right.memberName),
  );

  return {
    completedSets: records.length,
    exerciseName: exerciseNamesById[exerciseId] ?? '训练动作',
    groupName,
    memberSummaries,
    records: records.slice().sort((left, right) => `${right.date}:${right.sessionId}`.localeCompare(`${left.date}:${left.sessionId}`)),
    sessionCount: sessionIds.size,
    totalVolume: records.reduce((sum, record) => sum + record.volume, 0),
  };
}

function getRangeStart(range: ExerciseAnalysisRange): string | null {
  if (range === 'all') {
    return null;
  }

  const date = new Date();
  date.setDate(date.getDate() - (range === '30d' ? 30 : 90));
  return date.toISOString().slice(0, 10);
}

function filterRecords(
  records: ExerciseRecordRow[],
  range: ExerciseAnalysisRange,
  memberId: string | null,
): ExerciseRecordRow[] {
  const start = getRangeStart(range);
  return records.filter((record) => (!start || record.date >= start) && (!memberId || record.memberId === memberId));
}

function buildTrendSeries(
  records: ExerciseRecordRow[],
  members: ExerciseMemberSummary[],
  metric: ExerciseAnalysisMetric,
) {
  const sessionSlots = Array.from(
    new Map(
      records
        .slice()
        .sort((left, right) => `${left.date}:${left.sessionId}`.localeCompare(`${right.date}:${right.sessionId}`))
        .map((record) => [record.sessionId, { date: record.date, sessionId: record.sessionId }] as const),
    ).values(),
  )
    .slice(-10);
  const visibleMemberIds = new Set(records.map((record) => record.memberId));
  const series = members
    .filter((member) => visibleMemberIds.has(member.memberId))
    .slice(0, 4)
    .map((member) => ({
      label: member.memberName,
      values: sessionSlots.map((slot) => {
        const dayRecords = records.filter((record) => record.memberId === member.memberId && record.sessionId === slot.sessionId);
        if (metric === 'volume') {
          return dayRecords.reduce((sum, record) => sum + record.volume, 0);
        }

        if (metric === 'estimated_1rm') {
          return Math.max(0, ...dayRecords.map((record) => record.estimatedOneRM));
        }

        return Math.max(0, ...dayRecords.map((record) => record.weight));
      }),
    }));
  const dateLabelCounts = new Map<string, number>();
  const labels = sessionSlots.map((slot) => {
    const nextDateCount = (dateLabelCounts.get(slot.date) ?? 0) + 1;
    dateLabelCounts.set(slot.date, nextDateCount);
    const dateLabel = formatShortDate(slot.date);
    return nextDateCount > 1 ? `${dateLabel}-${nextDateCount}` : dateLabel;
  });

  return {
    labels,
    series,
  };
}

function formatMetricValue(metric: ExerciseAnalysisMetric, value: number): string {
  if (metric === 'volume') {
    return formatKg(value);
  }

  return `${Math.round(value)} kg`;
}

export default function GroupExerciseDetailRoute() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [view, setView] = useState<ExerciseDetailView | null>(null);
  const [metric, setMetric] = useState<ExerciseAnalysisMetric>('volume');
  const [range, setRange] = useState<ExerciseAnalysisRange>('90d');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!exerciseId) {
      setError('未找到可分析的训练动作。');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
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
      const sessions = await repositories.workoutRepository.listSessions({ groupId: group.id, limit: 200 });
      const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
      const exerciseIds = Array.from(
        new Set(details.flatMap((detail) => detail.exercises.map((exerciseRecord) => exerciseRecord.exerciseId))),
      );
      const [exercises, memberProfiles] = await Promise.all([
        repositories.exerciseRepository.listExercisesByIds(exerciseIds),
        Promise.all(
          members.map(async (member) => [
            member.id,
            await repositories.memberRepository.getMemberProfile(member.id),
          ] as const),
        ),
      ]);
      const exerciseNamesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise.name]));

      setView(
        buildExerciseDetailView({
          details,
          exerciseId,
          exerciseNamesById,
          groupName: group.name,
          members,
          profilesByMemberId: Object.fromEntries(memberProfiles),
        }),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '小组动作详情加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail]),
  );

  const filteredRecords = useMemo(
    () => (view ? filterRecords(view.records, range, selectedMemberId) : []),
    [range, selectedMemberId, view],
  );
  const trend = useMemo(
    () => (view ? buildTrendSeries(filteredRecords, view.memberSummaries, metric) : { labels: [], series: [] }),
    [filteredRecords, metric, view],
  );

  return (
    <Screen>
      <SecondaryPageHeader
        caption="小组动作"
        icon="barbell-outline"
        meta={view ? `${view.memberSummaries.length} 名成员` : undefined}
        subtitle={view ? `${view.groupName} · 小组动作对比` : '小组动作对比'}
        title={view?.exerciseName ?? '动作详情'}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void loadDetail()} title="暂时无法加载动作详情" /> : null}

      {!isLoading && !error && view ? (
        <>
          <AppCard style={styles.heroCard} tone="dark">
            <View style={styles.heroHeader}>
              <View style={styles.headerText}>
                <AppText style={styles.darkMuted} variant="caption">
                  近 200 条小组训练记录
                </AppText>
                <AppText tone="inverse" variant="display">
                  {formatKg(view.totalVolume)}
                </AppText>
              </View>
              <Tag label={`${view.memberSummaries.length} 名成员`} tone="dark" />
            </View>
            <View style={styles.heroMetricRow}>
              <DarkMetric label="训练次数" value={`${view.sessionCount} 次`} />
              <DarkMetric label="完成组数" value={`${view.completedSets} 组`} />
              <DarkMetric label="记录条数" value={`${view.records.length} 条`} />
            </View>
          </AppCard>

          <AppCard style={styles.analysisCard}>
            <View style={styles.controlBlock}>
              <AppText variant="bodySmall" weight="900">
                分析指标
              </AppText>
              <SegmentedControl
                options={metricOptions}
                value={metric}
                onChange={setMetric}
              />
            </View>
            <View style={styles.controlBlock}>
              <AppText variant="bodySmall" weight="900">
                时间范围
              </AppText>
              <SegmentedControl
                options={rangeOptions}
                value={range}
                onChange={setRange}
              />
            </View>
            <View style={styles.controlBlock}>
              <AppText variant="bodySmall" weight="900">
                成员
              </AppText>
              <View style={styles.segmentRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setSelectedMemberId(null)}
                  style={[styles.segmentChip, selectedMemberId === null && styles.segmentChipActive]}
                >
                  <AppText style={selectedMemberId === null ? styles.segmentTextActive : styles.segmentText} variant="caption" weight="900">
                    全部
                  </AppText>
                </Pressable>
                {view.memberSummaries.map((member) => (
                  <Pressable
                    accessibilityRole="button"
                    key={member.memberId}
                    onPress={() => setSelectedMemberId(member.memberId)}
                    style={[styles.segmentChip, selectedMemberId === member.memberId && styles.segmentChipActive]}
                  >
                    <AppText
                      numberOfLines={1}
                      style={selectedMemberId === member.memberId ? styles.segmentTextActive : styles.segmentText}
                      variant="caption"
                      weight="900"
                    >
                      {member.memberName}
                    </AppText>
                  </Pressable>
                ))}
              </View>
            </View>
            <AppText variant="bodySmall" weight="900">
              {view.exerciseName}{metricTitleLabels[metric]}趋势
            </AppText>
            <MultiLineTrendChart
              chartHeight={128}
              emptyMessage="当前筛选范围内还没有有效训练数据"
              formatValue={(value) => formatMetricValue(metric, value)}
              labels={trend.labels}
              series={trend.series}
              unitLabel="kg"
            />
          </AppCard>

          <SectionHeader title="成员对比" />
          {view.memberSummaries.length === 0 ? (
            <EmptyState description="完成该主项动作后，这里会显示成员重量、容量和最近记录。" title="暂无该动作训练数据" />
          ) : (
            <View style={styles.memberList}>
              {view.memberSummaries.map((member, index) => (
                <AppCard key={member.memberId} style={styles.memberRow}>
                  <Avatar
                    avatarLocalUri={member.profile?.avatarLocalUri}
                    avatarThumbUrl={member.profile?.avatarThumbUrl}
                    avatarUrl={member.profile?.avatarUrl}
                    name={member.memberName}
                    size={42}
                  />
                  <View style={styles.memberMain}>
                    <View style={styles.memberTitleRow}>
                      <AppText numberOfLines={1} variant="bodySmall" weight="900">
                        {member.memberName}
                      </AppText>
                      {index === 0 ? <Tag label="当前最高" tone="success" /> : null}
                    </View>
                    <AppText numberOfLines={1} tone="muted" variant="caption">
                      最近 {member.latestLabel ?? '暂无'} · {member.latestDate ? formatShortDate(member.latestDate) : '暂无日期'}
                    </AppText>
                  </View>
                  <View style={styles.memberMetrics}>
                    <AppText variant="bodySmall" weight="900">
                      {member.bestWeight > 0 ? `${member.bestWeight} kg` : '暂无'}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      最好重量
                    </AppText>
                  </View>
                </AppCard>
              ))}
            </View>
          )}

          <SectionHeader title="最近有效组" />
          <View style={styles.recordList}>
            {filteredRecords.slice(0, 30).map((record, index) => (
              <Pressable
                accessibilityRole="button"
                key={`${record.sessionId}-${record.memberId}-${index}`}
                onPress={() => router.push({ pathname: '/history/[sessionId]', params: { sessionId: record.sessionId } } as never)}
                style={({ pressed }) => [styles.recordRow, pressed && styles.pressed]}
              >
                <View style={styles.recordDate}>
                  <AppText variant="caption" weight="900">
                    {formatShortDate(record.date)}
                  </AppText>
                </View>
                <View style={styles.recordMain}>
                  <AppText variant="bodySmall" weight="900">
                    {record.memberName}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    {record.weight}kg x {record.reps} · {formatKg(record.volume)}
                  </AppText>
                </View>
                <View style={styles.recordRight}>
                  <AppText variant="caption" weight="900">
                    {record.estimatedOneRM > 0 ? `${record.estimatedOneRM} kg` : '样本不足'}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    预估 1RM
                  </AppText>
                </View>
                <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkMetric}>
      <AppText tone="inverse" variant="subtitle" weight="900">
        {value}
      </AppText>
      <AppText style={styles.darkMuted} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function SegmentedControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.segmentRow}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentChip, active && styles.segmentChipActive]}
          >
            <AppText style={active ? styles.segmentTextActive : styles.segmentText} variant="caption" weight="900">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  analysisCard: {
    gap: spacing.md,
  },
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  darkMetric: {
    flex: 1,
    gap: 2,
  },
  darkMuted: {
    color: colors.darkMuted,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  heroCard: {
    gap: spacing.lg,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  heroMetricRow: {
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  loadingWrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  memberMetrics: {
    alignItems: 'flex-end',
    gap: 2,
  },
  memberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  memberTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  recordDate: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recordList: {
    gap: spacing.sm,
  },
  recordMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recordRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  recordRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  controlBlock: {
    gap: spacing.sm,
  },
  segmentRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  segmentChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    maxWidth: 118,
    minHeight: 34,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  segmentChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  segmentText: {
    color: colors.textMuted,
  },
  segmentTextActive: {
    color: colors.surface,
  },
});
