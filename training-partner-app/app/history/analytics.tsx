import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import {
  getPersonalHistoryAnalysis,
  getAvailableHistoryAnalysisRanges,
  type CoreLiftTrend,
  type HistoryRangeWeeks,
  type PersonalHistoryAnalysis,
  type PrTimelineItem,
  type WeeklyHistoryBucket,
} from '@/domain/history/history-analysis';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

type AnalyticsState = {
  analysis: PersonalHistoryAnalysis | null;
  currentMember: GroupMember | null;
};

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, count: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function collectExerciseIds(details: WorkoutSessionDetail[]): string[] {
  return Array.from(new Set(details.flatMap((detail) => detail.exercises.map((exercise) => exercise.exerciseId))));
}

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDelta(value?: number): string {
  if (value === undefined || Math.abs(value) < 0.1) {
    return '持平';
  }

  return `${value > 0 ? '+' : ''}${value}kg`;
}

function formatSignedPercent(value?: number): string {
  if (value === undefined || Math.abs(value) < 3) {
    return '持平';
  }

  return `${value > 0 ? '+' : ''}${value}%`;
}

export default function HistoryAnalyticsRoute() {
  const navigation = useNavigation();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [rangeWeeks, setRangeWeeks] = useState<HistoryRangeWeeks>(4);
  const [state, setState] = useState<AnalyticsState>({ analysis: null, currentMember: null });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
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
        setState({ analysis: null, currentMember: null });
        return;
      }

      const today = getLocalDateString();
      const fromDate = getLocalDateString(addDays(new Date(), -(rangeWeeks * 7 - 1)));
      const sessions = await repositories.workoutRepository.listSessions({
        groupId: group.id,
        memberId: currentMember.id,
        fromDate,
        toDate: today,
        limit: 600,
      });
      const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
      const exercises = await repositories.exerciseRepository.listExercisesByIds(collectExerciseIds(details));
      const exerciseNamesById = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise.name]));

      setState({
        analysis: getPersonalHistoryAnalysis(details, currentMember.id, exerciseNamesById, rangeWeeks),
        currentMember,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练分析加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [rangeWeeks, repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadAnalytics();
    }, [loadAnalytics]),
  );

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.iconButton}>
          <Ionicons color={colors.text} name="close-outline" size={22} />
        </Pressable>
      }
      subtitle={state.currentMember ? `当前成员：${state.currentMember.displayName}` : '个人记录分析'}
      title="训练分析"
    >
      <RangeTabs rangeWeeks={rangeWeeks} setRangeWeeks={setRangeWeeks} />
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="训练分析暂时无法加载" description={error} /> : null}

      {!isLoading && !error && state.analysis ? (
        <>
          <MetricSummary analysis={state.analysis} />
          <VolumeTrendCard buckets={state.analysis.weeklyBuckets} />
          <FrequencyTrendCard analysis={state.analysis} />
          <CoreLiftTrendGrid lifts={state.analysis.coreLifts} />
          <PrTimelineCard items={state.analysis.prTimeline} />
          <InsightCard insights={state.analysis.insights} />
        </>
      ) : null}

      {!isLoading && !error && !state.analysis ? (
        <EmptyState title="还没有训练记录" description="完成训练后，这里会展示训练频率、训练量、PR 和核心动作趋势。" />
      ) : null}
    </Screen>
  );
}

function RangeTabs({
  rangeWeeks,
  setRangeWeeks,
}: {
  rangeWeeks: HistoryRangeWeeks;
  setRangeWeeks: (range: HistoryRangeWeeks) => void;
}) {
  return (
    <AppCard style={styles.rangeCard}>
      <View style={styles.rangeTabs}>
        {getAvailableHistoryAnalysisRanges().map((option) => (
          <RangeButton
            active={rangeWeeks === option.weeks}
            key={option.weeks}
            label={option.label}
            onPress={() => setRangeWeeks(option.weeks)}
          />
        ))}
      </View>
    </AppCard>
  );
}

function RangeButton({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.rangeButton, active && styles.rangeButtonActive]}>
      <AppText tone={active ? 'inverse' : 'muted'} variant="caption">
        {label}
      </AppText>
    </Pressable>
  );
}

function MetricSummary({ analysis }: { analysis: PersonalHistoryAnalysis }) {
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">核心指标</AppText>
          <AppText tone="muted" variant="caption">
            最近 {analysis.rangeWeeks} 周个人训练数据
          </AppText>
        </View>
        <Tag label="个人记录" tone="brand" />
      </View>
      <View style={styles.metricGrid}>
        <MetricBlock label="总训练量" value={formatKg(analysis.totalVolume)} />
        <MetricBlock label="训练次数" value={`${analysis.sessionCount} 次`} />
        <MetricBlock label="完成率" value={formatPercent(analysis.completionRate)} />
        <MetricBlock label="完成组数" value={`${analysis.completedSets} 组`} />
      </View>
    </AppCard>
  );
}

function VolumeTrendCard({ buckets }: { buckets: WeeklyHistoryBucket[] }) {
  const maxVolume = Math.max(1, ...buckets.map((bucket) => bucket.volume));

  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">每周训练量</AppText>
          <AppText tone="muted" variant="caption">
            柱状图仅展示训练量，不混用其他图形语义
          </AppText>
        </View>
        <Ionicons color={colors.primary} name="bar-chart-outline" size={22} />
      </View>
      <View style={styles.volumeBars}>
        {buckets.map((bucket) => (
          <View key={bucket.label} style={styles.volumeColumn}>
            <View style={styles.volumeTrack}>
              <View style={[styles.volumeBar, { height: 16 + Math.round((bucket.volume / maxVolume) * 104) }]} />
            </View>
            <AppText tone="muted" variant="caption">
              {bucket.label}
            </AppText>
            <AppText variant="caption" weight="900">
              {formatKg(bucket.volume)}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function FrequencyTrendCard({ analysis }: { analysis: PersonalHistoryAnalysis }) {
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">训练频率与完成率</AppText>
          <AppText tone="muted" variant="caption">
            数字卡展示次数和完成率，避免混乱图表
          </AppText>
        </View>
        <Tag label={`完成率 ${formatPercent(analysis.completionRate)}`} tone="success" />
      </View>
      <View style={styles.weekList}>
        {analysis.weeklyBuckets.map((bucket) => (
          <View key={bucket.label} style={styles.weekRow}>
            <AppText variant="bodySmall" weight="900">
              {bucket.label}
            </AppText>
            <View style={styles.weekStats}>
              <Tag label={`${bucket.sessionCount} 次`} tone="accent" />
              <Tag label={`${bucket.completedSets} 组`} tone="neutral" />
              <Tag label={formatPercent(bucket.completionRate)} tone="success" />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.deltaRow}>
        <TrendPill label="训练量" value={formatSignedPercent(analysis.volumeChangePercent)} />
        <TrendPill label="训练次数" value={analysis.sessionTrendLabel} />
        <TrendPill label="完成率" value={formatSignedPercent(analysis.completionChangePercent)} />
      </View>
    </AppCard>
  );
}

function CoreLiftTrendGrid({ lifts }: { lifts: CoreLiftTrend[] }) {
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">核心动作估算 1RM</AppText>
          <AppText tone="muted" variant="caption">
            卧推、深蹲、硬拉、肩推的主要趋势
          </AppText>
        </View>
        <Ionicons color={colors.primary} name="pulse-outline" size={22} />
      </View>
      <View style={styles.liftGrid}>
        {lifts.map((lift) => (
          <CoreLiftCard key={lift.key} lift={lift} />
        ))}
      </View>
    </AppCard>
  );
}

function CoreLiftCard({ lift }: { lift: CoreLiftTrend }) {
  const activePoints = lift.points.filter((point) => point.estimatedOneRM);
  const max = Math.max(1, ...activePoints.map((point) => point.estimatedOneRM ?? 0));

  return (
    <View style={styles.liftCard}>
      <View style={styles.cardHeaderRow}>
        <AppText variant="bodySmall" weight="900">
          {lift.name}
        </AppText>
        <Tag label={formatDelta(lift.change)} tone={lift.direction === 'up' ? 'success' : lift.direction === 'down' ? 'warning' : 'neutral'} />
      </View>
      <AppText variant="subtitle">
        {lift.currentEstimatedOneRM ? `${lift.currentEstimatedOneRM} kg` : '暂无'}
      </AppText>
      <View style={styles.pointRow}>
        {lift.points.map((point) => {
          const size = point.estimatedOneRM ? 7 + Math.round(((point.estimatedOneRM ?? 0) / max) * 9) : 6;
          return (
            <View key={point.label} style={styles.pointColumn}>
              <View
                style={[
                  styles.trendPoint,
                  { height: size, width: size },
                  point.estimatedOneRM ? styles.trendPointActive : styles.trendPointEmpty,
                ]}
              />
              <AppText tone="muted" variant="caption">
                {point.label.replace('周前', '')}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PrTimelineCard({ items }: { items: PrTimelineItem[] }) {
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">PR 时间线</AppText>
          <AppText tone="muted" variant="caption">
            记录新 PR 和接近 PR 的表现
          </AppText>
        </View>
        <Tag label={`${items.filter((item) => item.tag === '新 PR').length} 项新 PR`} tone="warning" />
      </View>
      {items.length === 0 ? (
        <View style={styles.inlineEmpty}>
          <Ionicons color={colors.textMuted} name="trophy-outline" size={22} />
          <AppText tone="muted" variant="bodySmall">
            暂无 PR 动态，继续积累训练样本。
          </AppText>
        </View>
      ) : (
        <View style={styles.timeline}>
          {items.slice(0, 8).map((item) => (
            <TimelineRow key={item.id} item={item} />
          ))}
        </View>
      )}
    </AppCard>
  );
}

function TimelineRow({ item }: { item: PrTimelineItem }) {
  return (
    <View style={styles.timelineRow}>
      <View style={styles.timelineDot} />
      <View style={styles.timelineBody}>
        <View style={styles.cardHeaderRow}>
          <AppText numberOfLines={1} variant="bodySmall" weight="900">
            {item.exerciseName}
          </AppText>
          <Tag label={item.tag} tone={item.tag === '新 PR' ? 'brand' : 'accent'} />
        </View>
        <AppText tone="muted" variant="caption">
          {item.date} · {item.weight}kg x {item.reps} · 估算 1RM {item.estimatedOneRM}kg
        </AppText>
      </View>
    </View>
  );
}

function InsightCard({ insights }: { insights: string[] }) {
  return (
    <AppCard style={styles.cardGap} tone="brand">
      <View style={styles.cardHeaderRow}>
        <View>
          <AppText variant="subtitle">建议与洞察</AppText>
          <AppText tone="muted" variant="caption">
            根据训练频率、完成率、PR 和核心动作趋势生成
          </AppText>
        </View>
        <Ionicons color={colors.primary} name="sparkles-outline" size={22} />
      </View>
      <View style={styles.insightList}>
        {insights.map((insight) => (
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

function TrendPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.trendPill}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="bodySmall" weight="900">
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
  rangeCard: {
    padding: spacing.sm,
  },
  rangeTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rangeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flex: 1,
    justifyContent: 'center',
    minHeight: 40,
  },
  rangeButtonActive: {
    backgroundColor: colors.primary,
  },
  cardGap: {
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
  volumeBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 164,
  },
  volumeColumn: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  volumeTrack: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 126,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 22,
  },
  volumeBar: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    width: 22,
  },
  weekList: {
    gap: spacing.sm,
  },
  weekRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.sm,
  },
  weekStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-end',
  },
  deltaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  trendPill: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    flex: 1,
    gap: 2,
    padding: spacing.sm,
  },
  liftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  liftCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  pointRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pointColumn: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
  },
  trendPoint: {
    borderRadius: radius.pill,
  },
  trendPointActive: {
    backgroundColor: colors.primary,
  },
  trendPointEmpty: {
    backgroundColor: colors.borderStrong,
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 9,
    marginTop: 12,
    width: 9,
  },
  timelineBody: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.sm,
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
});
