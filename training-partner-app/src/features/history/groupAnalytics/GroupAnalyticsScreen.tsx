import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, Avatar, EmptyState, Screen, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import { buildTrendBuckets, getDateSpanDays } from '@/features/history/shared/dateRange';
import {
  AvatarName,
  BackHeader,
  HorizontalBarRow,
  InsightList,
  SectionCard,
  SegmentControl,
  VerticalBars,
} from '@/features/history/shared/HistoryUi';
import {
  formatKg,
  formatPercent,
  loadHistoryDataset,
  type HistoryDataset,
  type MemberContributionView,
} from '@/features/history/shared/historyViewModel';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';

type IconName = ComponentProps<typeof Ionicons>['name'];
type SortKey = 'volume' | 'completion' | 'activity';
type TrendMetric = 'volume' | 'completion' | 'activity';

export function GroupAnalyticsScreen() {
  const { range, setRange } = useDateRange('7d');
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const [sortKey, setSortKey] = useState<SortKey>('volume');
  const [trendMetric, setTrendMetric] = useState<TrendMetric>('volume');
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDataset(await loadHistoryDataset(range, selectedGroupId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '小组分析加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [range, selectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const members = useMemo(() => {
    const source = dataset?.memberContributions ?? [];
    if (sortKey === 'completion') return [...source].sort((left, right) => right.completionRate - left.completionRate);
    if (sortKey === 'activity') return [...source].sort((left, right) => right.sessionCount - left.sessionCount);
    return source;
  }, [dataset, sortKey]);
  const maxMemberVolume = Math.max(1, ...members.map((member) => member.volume));
  const maxMemberSessions = Math.max(1, ...members.map((member) => member.sessionCount));

  // 小组趋势柱状图：范围超过 14 天时按周聚合，避免 30 天/本月出现 30 根柱子拥挤不堪。
  // 聚合后过滤掉全 0 的桶，无训练的日期不再占位。
  const trendBars = useMemo(() => {
    const rawTrend = dataset?.groupAnalysis.trend ?? [];
    if (rawTrend.length === 0) return [];

    const span = getDateSpanDays(range.fromDate, range.toDate);
    if (span <= 14) {
      return rawTrend
        .map((point) => ({
          label: point.label,
          value:
            trendMetric === 'volume'
              ? point.volume
              : trendMetric === 'completion'
                ? Math.round(point.completionRate * 100)
                : point.sessionCount,
        }))
        .filter((bar) => bar.value > 0);
    }

    const buckets = buildTrendBuckets(range.fromDate, range.toDate);
    return buckets
      .map((bucket) => {
        const pointsInBucket = rawTrend.filter((point) => point.date >= bucket.startDate && point.date <= bucket.endDate);
        if (pointsInBucket.length === 0) return null;
        const volume = pointsInBucket.reduce((sum, point) => sum + point.volume, 0);
        const sessionCount = pointsInBucket.reduce((sum, point) => sum + point.sessionCount, 0);
        const completedSets = pointsInBucket.reduce((sum, point) => sum + point.completedSets, 0);
        const totalSets = pointsInBucket.reduce((sum, point) => sum + point.totalSets, 0);
        const completionRate = totalSets > 0 ? completedSets / totalSets : 0;
        const value =
          trendMetric === 'volume'
            ? volume
            : trendMetric === 'completion'
              ? Math.round(completionRate * 100)
              : sessionCount;
        if (value === 0) return null;
        return { label: bucket.label, value };
      })
      .filter((bar): bar is { label: string; value: number } => bar !== null);
  }, [dataset, range.fromDate, range.toDate, trendMetric]);

  return (
    <Screen contentStyle={styles.screen}>
      <BackHeader title="小组分析" />
      <AppCard style={styles.filterCard}>
        <View style={styles.filterRow}>
          <DateRangeSelector compact onChange={setRange} range={range} subtitle="小组分析范围" />
        </View>
        <View style={styles.shortcutRow}>
          <AnalyticsShortcut icon="barbell-outline" label="动作对比" onPress={() => router.push('/history/group/exercise-compare' as never)} />
          <AnalyticsShortcut icon="calendar-clear-outline" label="出勤率" onPress={() => router.push('/history/group/attendance' as never)} />
        </View>
      </AppCard>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="小组分析暂时无法加载" /> : null}

      {!isLoading && !error && dataset ? (
        <>
          <AppCard style={styles.darkSummary} tone="dark">
            <View style={styles.darkHeader}>
              <View>
                <AppText style={styles.darkMuted} variant="caption">
                  当前范围小组训练量
                </AppText>
                <AppText tone="inverse" variant="display" weight="900">
                  {formatKg(dataset.groupAnalysis.totalVolume)} kg
                </AppText>
                <AppText tone="brand" variant="bodySmall" weight="900">
                  完成率 {formatPercent(dataset.groupAnalysis.completionRate)}
                </AppText>
              </View>
              <Tag label={dataset.group.name} tone="dark" />
            </View>
            <View style={styles.darkMetrics}>
              <DarkMetric label="总组数" value={`${dataset.groupAnalysis.completedSets}组`} />
              <DarkMetric label="训练次数" value={`${dataset.groupAnalysis.sessionCount}次`} />
              <DarkMetric label="活跃成员" value={`${dataset.groupAnalysis.activeMemberCount}人`} />
            </View>
            <View style={styles.progressWrap}>
              <AppText tone="inverse" variant="caption" weight="900">
                完成进度
              </AppText>
              <View style={styles.darkTrack}>
                <View style={[styles.darkFill, { width: `${Math.round(dataset.groupAnalysis.completionRate * 100)}%` }]} />
              </View>
              <AppText tone="inverse" variant="caption" weight="900">
                {formatPercent(dataset.groupAnalysis.completionRate)}
              </AppText>
            </View>
          </AppCard>

          <SectionCard title="成员贡献">
            <SegmentControl
              onChange={setSortKey}
              options={[
                { label: '训练量', value: 'volume' },
                { label: '完成率', value: 'completion' },
                { label: '活跃度', value: 'activity' },
              ]}
              value={sortKey}
            />
            <View style={styles.avatarStrip}>
              {members.slice(0, 4).map((member) => (
                <Pressable
                  accessibilityRole="button"
                  key={member.member.id}
                  onPress={() => router.push({ pathname: '/history/group/member/[memberId]', params: { memberId: member.member.id } } as never)}
                  style={styles.memberAvatarItem}
                >
                  <Avatar
                    avatarLocalUri={member.avatarLocalUri}
                    avatarThumbUrl={member.avatarThumbUrl}
                    avatarUrl={member.avatarUrl}
                    name={member.member.displayName}
                    size={58}
                  />
                  <AppText numberOfLines={1} variant="caption" weight="900">
                    {member.member.displayName}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    {formatKg(member.volume)}kg
                  </AppText>
                </Pressable>
              ))}
            </View>
            <View style={styles.memberRows}>
              {members.map((member) => (
                <MemberRow
                  key={member.member.id}
                  maxSessions={maxMemberSessions}
                  maxVolume={maxMemberVolume}
                  member={member}
                  sortKey={sortKey}
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard title="小组趋势">
            <SegmentControl
              onChange={setTrendMetric}
              options={[
                { label: '训练量', value: 'volume' },
                { label: '完成率', value: 'completion' },
                { label: '活跃度', value: 'activity' },
              ]}
              value={trendMetric}
            />
            <VerticalBars
              bars={trendBars}
              formatValue={(value) =>
                trendMetric === 'volume' ? `${Math.round(value / 1000)}k` : trendMetric === 'completion' ? `${value}%` : `${value}次`
              }
            />
          </SectionCard>

          <SectionCard action={<Tag label={`${dataset.groupSessions.length} 次`} tone="neutral" />} title="最近小组训练记录">
            {dataset.groupSessions.length === 0 ? (
              <EmptyState description="当前范围没有小组训练记录。" title="暂无训练记录" />
            ) : (
              <View style={styles.sessionList}>
                {dataset.groupSessions.slice(0, 5).map((session) => {
                  const sessionMeta = [session.date, session.mainExerciseNames.join(' / ') || '训练动作'].filter(Boolean).join(' · ');
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={session.id}
                      onPress={() => router.push({ pathname: '/history/[sessionId]', params: { scope: 'group', sessionId: session.id } } as never)}
                      style={styles.sessionRow}
                    >
                      <View style={styles.sessionIcon}>
                        <Ionicons color={colors.primary} name="barbell-outline" size={20} />
                      </View>
                      <View style={styles.sessionMain}>
                        <AppText numberOfLines={1} variant="bodySmall" weight="900">
                          {session.title || '小组训练'}
                        </AppText>
                        {sessionMeta ? (
                          <AppText tone="muted" variant="caption">
                            {sessionMeta}
                          </AppText>
                        ) : null}
                      </View>
                      <Tag label={`${session.completedMembers}/${session.participantCount || dataset.members.length} 完成`} tone="neutral" />
                      <Ionicons color={colors.textSubtle} name="chevron-forward" size={16} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </SectionCard>

          <SectionCard title="小组洞察">
            <InsightList insights={dataset.groupAnalysis.insights.slice(0, 4)} />
          </SectionCard>
        </>
      ) : null}
    </Screen>
  );
}

function AnalyticsShortcut({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}>
      <Ionicons color={colors.primary} name={icon} size={16} />
      <AppText numberOfLines={1} tone="brand" variant="caption" weight="900">
        {label}
      </AppText>
    </Pressable>
  );
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.darkMetric}>
      <AppText style={styles.darkMetricValue} tone="inverse" variant="subtitle" weight="900">
        {value}
      </AppText>
      <AppText style={[styles.darkMuted, styles.darkMetricLabel]} variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function MemberRow({
  maxSessions,
  maxVolume,
  member,
  sortKey,
}: {
  maxSessions: number;
  maxVolume: number;
  member: MemberContributionView;
  sortKey: SortKey;
}) {
  const tone = member.statusLabel === '优秀' ? 'success' : member.statusLabel === '良好' ? 'accent' : member.statusLabel === '一般' ? 'warning' : 'danger';
  const primary =
    sortKey === 'completion'
      ? formatPercent(member.completionRate)
      : sortKey === 'activity'
        ? `${member.sessionCount} 次训练`
        : `${formatKg(member.volume)} kg`;
  const meta =
    sortKey === 'completion'
      ? `${member.completedSets} 组 · ${formatKg(member.volume)}kg`
      : sortKey === 'activity'
        ? `${member.activeDays} 天活跃 · ${member.completedSets} 组`
        : `${member.completedSets} 组 · ${formatPercent(member.completionRate)}`;
  const ratio =
    sortKey === 'completion'
      ? member.completionRate
      : sortKey === 'activity'
        ? member.sessionCount / maxSessions
        : member.volume / maxVolume;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/history/group/member/[memberId]', params: { memberId: member.member.id } } as never)}
      style={styles.memberRow}
    >
      <Tag label={`${member.rank}`} tone={member.rank === 1 ? 'warning' : 'neutral'} />
      <AvatarName
        avatarLocalUri={member.avatarLocalUri}
        avatarThumbUrl={member.avatarThumbUrl}
        avatarUrl={member.avatarUrl}
        name={member.member.displayName}
      />
      <View style={styles.memberStats}>
        <HorizontalBarRow
          label={primary}
          meta={meta}
          ratio={Math.max(0.04, ratio)}
          right={<Tag label={member.statusLabel} tone={tone} />}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarStrip: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  darkFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
  },
  darkHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  darkMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  darkMetricLabel: {
    textAlign: 'center',
  },
  darkMetricValue: {
    textAlign: 'center',
  },
  darkMetrics: {
    alignItems: 'center',
    borderTopColor: 'rgba(255,255,255,0.13)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'center',
    paddingTop: spacing.md,
  },
  darkMuted: {
    color: colors.darkMuted,
  },
  darkSummary: {
    gap: spacing.lg,
  },
  darkTrack: {
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: radius.pill,
    flex: 1,
    height: 10,
    overflow: 'hidden',
  },
  dateSelectorWrap: {
    flex: 1,
    minWidth: 0,
  },
  filterCard: {
    gap: spacing.md,
  },
  filterRow: {
    minWidth: 0,
  },
  memberAvatarItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  memberRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  memberRows: {
    gap: spacing.sm,
  },
  memberStats: {
    flex: 1,
  },
  pressed: {
    opacity: 0.84,
  },
  progressWrap: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  sessionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionMain: {
    flex: 1,
    minWidth: 0,
  },
  sessionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  shortcut: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
