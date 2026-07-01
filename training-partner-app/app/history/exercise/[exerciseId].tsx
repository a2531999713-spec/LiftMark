import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, MiniLineChart, Screen, SecondaryPageHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import { estimateOneRM } from '@/domain/history/history-analysis';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

type ExerciseSetRecord = {
  date: string;
  estimatedOneRM: number;
  notes?: string;
  reps: number;
  sessionId: string;
  volume: number;
  weight: number;
};

type ExerciseSessionPoint = {
  date: string;
  estimatedOneRM: number;
  label: string;
  sessionId: string;
  volume: number;
  weight: number;
};

type ExerciseHistoryView = {
  bestEstimatedOneRM: number;
  bestWeight: number;
  exercise: Exercise | null;
  member: GroupMember;
  records: ExerciseSetRecord[];
  sessionPoints: ExerciseSessionPoint[];
  totalVolume: number;
};

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

function getSortValue(detail: WorkoutSessionDetail): string {
  return `${detail.session.date} ${detail.session.updatedAt}`;
}

function buildExerciseHistoryView({
  details,
  exercise,
  exerciseId,
  member,
}: {
  details: WorkoutSessionDetail[];
  exercise: Exercise | null;
  exerciseId: string;
  member: GroupMember;
}): ExerciseHistoryView {
  const records: ExerciseSetRecord[] = [];
  const chronologicalDetails = details.slice().sort((left, right) => getSortValue(left).localeCompare(getSortValue(right)));

  for (const detail of chronologicalDetails) {
    for (const set of detail.sets) {
      if (!set.completed || set.memberId !== member.id) {
        continue;
      }

      const exerciseRecord = detail.exercises.find((record) => record.id === set.exerciseRecordId);
      if (exerciseRecord?.exerciseId !== exerciseId) {
        continue;
      }

      const weight = set.actualWeight ?? set.plannedWeight ?? 0;
      const reps = set.actualReps ?? set.plannedReps ?? 0;
      if (weight <= 0 || reps <= 0) {
        continue;
      }

      records.push({
        date: detail.session.date,
        estimatedOneRM: estimateOneRM(weight, reps),
        notes: set.notes,
        reps,
        sessionId: detail.session.id,
        volume: weight * reps,
        weight,
      });
    }
  }

  const sessionSlots = Array.from(
    new Map(records.map((record) => [record.sessionId, { date: record.date, sessionId: record.sessionId }] as const)).values(),
  ).slice(-12);
  const sessionPoints = sessionSlots.map((slot, index) => {
    const sessionRecords = records.filter((record) => record.sessionId === slot.sessionId);
    return {
      date: slot.date,
      estimatedOneRM: Math.max(0, ...sessionRecords.map((record) => record.estimatedOneRM)),
      label: `第${index + 1}次`,
      sessionId: slot.sessionId,
      volume: sessionRecords.reduce((sum, record) => sum + record.volume, 0),
      weight: Math.max(0, ...sessionRecords.map((record) => record.weight)),
    };
  });

  return {
    bestEstimatedOneRM: Math.max(0, ...records.map((record) => record.estimatedOneRM)),
    bestWeight: Math.max(0, ...records.map((record) => record.weight)),
    exercise,
    member,
    records: records.slice().sort((left, right) => `${right.date}:${right.sessionId}`.localeCompare(`${left.date}:${left.sessionId}`)),
    sessionPoints,
    totalVolume: records.reduce((sum, record) => sum + record.volume, 0),
  };
}

export default function ExerciseHistoryRoute() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [view, setView] = useState<ExerciseHistoryView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!exerciseId) {
      setError('缺少动作 ID。');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const group = await repositories.groupRepository.getDefaultGroup();
      if (!group) {
        throw new Error('默认训练小组尚未初始化。');
      }

      const members = await repositories.memberRepository.listMembers(group.id);
      const member = members[0] ?? null;
      if (!member) {
        setView(null);
        return;
      }

      const [exercise] = await repositories.exerciseRepository.listExercisesByIds([exerciseId]);
      const sessions = await repositories.workoutRepository.listSessions({
        groupId: group.id,
        limit: 240,
        memberId: member.id,
      });
      const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
      setView(buildExerciseHistoryView({ details, exercise: exercise ?? null, exerciseId, member }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '动作历史暂时无法加载。');
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, repositories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const points = view?.sessionPoints ?? [];
  const volumeMax = Math.max(1, ...points.map((point) => point.volume));
  const weightMax = Math.max(1, ...points.map((point) => point.weight));
  const oneRmMax = Math.max(1, ...points.map((point) => point.estimatedOneRM));

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="动作历史"
        icon="barbell-outline"
        meta={view?.member.displayName}
        subtitle="按实际训练次数展示，不用自然日补零。"
        title={view?.exercise?.name ?? '动作详情'}
      />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="暂时无法加载动作历史" /> : null}

      {!isLoading && !error && !view ? <EmptyState description="先完成一次训练后再查看动作历史。" title="暂无动作历史" /> : null}

      {!isLoading && !error && view ? (
        <>
          <AppCard style={styles.heroCard} tone="dark">
            <View style={styles.heroHeader}>
              <View style={styles.heroMain}>
                <AppText style={styles.darkMuted} variant="caption">
                  总训练容量
                </AppText>
                <AppText tone="inverse" variant="headline">
                  {formatKg(view.totalVolume)}
                </AppText>
              </View>
              <Tag label={`${view.records.length} 组`} tone="dark" />
            </View>
            <View style={styles.metricRow}>
              <DarkMetric label="最佳重量" value={view.bestWeight > 0 ? `${view.bestWeight} kg` : '-'} />
              <DarkMetric label="估算 1RM" value={view.bestEstimatedOneRM > 0 ? `${view.bestEstimatedOneRM} kg` : '-'} />
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <AppText variant="subtitle" weight="900">
              训练趋势
            </AppText>
            <TrendBlock
              data={points.map((point) => point.volume)}
              empty="暂无容量趋势"
              includeZero
              labels={points.map((point) => point.label)}
              max={volumeMax}
              title="容量"
              unit="kg"
            />
            <TrendBlock
              data={points.map((point) => point.weight)}
              empty="暂无重量趋势"
              labels={points.map((point) => point.label)}
              max={weightMax}
              title="最佳重量"
              unit="kg"
            />
            <TrendBlock
              data={points.map((point) => point.estimatedOneRM)}
              empty="暂无 1RM 趋势"
              labels={points.map((point) => point.label)}
              max={oneRmMax}
              title="估算 1RM"
              unit="kg"
            />
          </AppCard>

          <AppCard style={styles.card}>
            <AppText variant="subtitle" weight="900">
              最近有效组
            </AppText>
            {view.records.length === 0 ? (
              <View style={styles.inlineEmpty}>
                <Ionicons color={colors.textMuted} name="calendar-clear-outline" size={20} />
                <AppText tone="muted" variant="bodySmall">
                  暂无该动作的有效训练组。
                </AppText>
              </View>
            ) : (
              view.records.slice(0, 40).map((record, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${record.sessionId}-${index}`}
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
                      {record.weight}kg x {record.reps}
                    </AppText>
                    <AppText numberOfLines={1} tone="muted" variant="caption">
                      {formatKg(record.volume)} · 1RM {record.estimatedOneRM || '-'}kg
                    </AppText>
                  </View>
                  <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
                </Pressable>
              ))
            )}
          </AppCard>
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

function TrendBlock({
  data,
  empty,
  includeZero = false,
  labels,
  max,
  title,
  unit,
}: {
  data: number[];
  empty: string;
  includeZero?: boolean;
  labels: string[];
  max: number;
  title: string;
  unit: string;
}) {
  return (
    <View style={styles.trendBlock}>
      <View style={styles.chartHeader}>
        <AppText variant="bodySmall" weight="900">
          {title}
        </AppText>
        {unit ? <Tag label={unit} tone="neutral" /> : null}
      </View>
      <MiniLineChart
        chartHeight={88}
        data={data}
        emptyMessage={empty}
        formatValue={(value) => `${Math.round(value * 10) / 10}${unit}`}
        includeZero={includeZero}
        labels={labels}
        minChartHeight={max}
        showValues
        unitLabel={unit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  chartHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  darkMetric: {
    flex: 1,
    gap: 2,
  },
  darkMuted: {
    color: colors.darkMuted,
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
  heroMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  metricRow: {
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  recordDate: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  recordMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  recordRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  trendBlock: {
    gap: spacing.sm,
  },
});
