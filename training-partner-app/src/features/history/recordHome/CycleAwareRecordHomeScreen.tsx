import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useAppScope } from '@/application/scope/AppScopeProvider';
import { AppModalSheet, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import type { HistoryCycleOption, HistoryFilter, HistoryListItem } from '@/domain/history/history.types';
import { getPlanCycleStatusLabel } from '@/domain/plan/planCycle.service';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import { RecentDateStrip } from '@/features/history/shared/RecentDateStrip';
import { buildTrendBuckets, findBucketForDate } from '@/features/history/shared/dateRange';
import { ChartCard, IconButton, InsightList, MetricGrid, PageHeader, SectionCard, SegmentControl } from '@/features/history/shared/HistoryUi';
import { colors, radius, spacing } from '@/theme';

import { defaultHistoryFilter, resolveScopedHistoryFilter, type ScopedHistoryFilterState } from './historyFilter.state';
import { useHistoryListController } from './useHistoryListController';
import { buildHistoryTrendInsight, buildRecordHomeInsights } from './historyInsights';

type RecordScope = 'personal' | 'group';

const baseFilters: { label: string; value: HistoryFilter }[] = [
  { label: '全部', value: { kind: 'all' } },
  { label: '当前计划周期', value: { kind: 'current_cycle' } },
  { label: '历史计划周期', value: { kind: 'cycle' } },
  { label: '自由训练', value: { kind: 'free' } },
  { label: '补录训练', value: { kind: 'manual' } },
];

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60}m` : `${minutes}m`;
}

function getFilterLabel(filter: HistoryFilter, cycles: HistoryCycleOption[]): string {
  if (filter.kind === 'cycle' && filter.planCycleId) {
    return cycles.find((cycle) => cycle.cycleId === filter.planCycleId)?.cycleName ?? '历史计划周期';
  }
  return baseFilters.find((option) => option.value.kind === filter.kind)?.label ?? '全部';
}

function getEmptyCopy(filter: HistoryFilter) {
  if (filter.kind === 'current_cycle') return { title: '当前周期暂无记录', description: '完成当前计划周期中的训练后，记录会显示在这里。' };
  if (filter.kind === 'cycle') return { title: '归档周期暂无记录', description: '该周期没有可见的已完成训练，或筛选周期已失效。' };
  if (filter.kind === 'free') return { title: '暂无自由训练', description: '不关联计划的自由训练会显示在这里。' };
  if (filter.kind === 'manual') return { title: '暂无补录训练', description: '通过记录页补录的训练会显示在这里。' };
  return { title: '还没有训练记录', description: '完成训练或补录后，这里会显示训练摘要。' };
}

export function CycleAwareRecordHomeScreen() {
  const appScope = useAppScope();
  const { range, setRange } = useDateRange('30d');
  const contextKey = `${appScope.scope?.userId ?? 'none'}:${appScope.scope?.groupId ?? 'none'}`;
  const [scope, setScope] = useState<RecordScope>('personal');
  const [selectedDateState, setSelectedDateState] = useState<{ contextKey: string; value: string | null }>({ contextKey, value: null });
  const [isCyclePickerVisible, setCyclePickerVisible] = useState(false);
  const [filterState, setFilterState] = useState<ScopedHistoryFilterState>({ contextKey, filter: defaultHistoryFilter });
  const effectiveFilterState = resolveScopedHistoryFilter(filterState, contextKey);
  const filter = effectiveFilterState.filter;
  const selectedDate = selectedDateState.contextKey === contextKey ? selectedDateState.value : null;
  const setSelectedDate = (value: string | null) => setSelectedDateState({ contextKey, value });
  const { reload, state } = useHistoryListController({
    currentPlanCycleId: appScope.scope?.activePlanCycleId,
    filter,
    groupId: appScope.scope?.groupId,
    memberId: scope === 'personal' ? appScope.scope?.memberId : null,
    range,
  });
  const visibleItems = selectedDate ? state.items.filter((item) => item.date === selectedDate) : state.items;
  const metrics = useMemo(() => ({
    completedSets: state.items.reduce((sum, item) => sum + item.completedSets, 0),
    reportCount: state.items.filter((item) => item.hasCompleteReport).length,
    sessionCount: state.items.length,
    totalVolume: state.items.reduce((sum, item) => sum + item.totalVolume, 0),
  }), [state.items]);
  const trend = useMemo(() => {
    const buckets = buildTrendBuckets(range.fromDate, range.toDate);
    const values = new Map(buckets.map((bucket) => [bucket.key, 0]));
    state.items.forEach((item) => {
      const bucket = findBucketForDate(buckets, item.date);
      if (bucket) values.set(bucket.key, (values.get(bucket.key) ?? 0) + item.totalVolume);
    });
    return { labels: buckets.map((bucket) => bucket.label), values: buckets.map((bucket) => values.get(bucket.key) ?? 0) };
  }, [range.fromDate, range.toDate, state.items]);
  const countsByDate = useMemo(() => state.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.date] = (acc[item.date] ?? 0) + 1;
    return acc;
  }, {}), [state.items]);
  const filterLabel = getFilterLabel(filter, state.cycles);
  const emptyCopy = getEmptyCopy(filter);
  const trendInsight = useMemo(() => buildHistoryTrendInsight(state.items), [state.items]);
  const analysisInsights = useMemo(() => buildRecordHomeInsights(state.items, scope), [scope, state.items]);

  const chooseBaseFilter = (next: HistoryFilter) => {
    if (next.kind === 'cycle') {
      setCyclePickerVisible(true);
      return;
    }
    setFilterState({ contextKey, filter: next });
    setSelectedDate(null);
  };

  return (
    <Screen contentStyle={styles.screen}>
      <PageHeader
        right={<IconButton accessibilityLabel="补录训练" icon="add-outline" onPress={() => router.push('/history/manual' as never)} />}
        subtitle={`${scope === 'personal' ? '个人' : '小组'}训练 · ${filterLabel}`}
        title="记录"
      />
      <SegmentControl
        onChange={(nextScope) => { setScope(nextScope); setSelectedDate(null); }}
        options={[{ label: '个人记录', value: 'personal' }, { label: '小组记录', value: 'group' }]}
        value={scope}
      />
      <DateRangeSelector onChange={(nextRange) => { setRange(nextRange); setSelectedDate(null); }} range={range} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {baseFilters.map((option) => {
          const active = option.value.kind === filter.kind;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value.kind}
              onPress={() => chooseBaseFilter(option.value)}
              style={[styles.filterChip, active && styles.filterChipActive]}
            >
              <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
                {option.value.kind === 'cycle' && filter.kind === 'cycle' ? filterLabel : option.label}
              </AppText>
              {option.value.kind === 'cycle' ? (
                <Ionicons color={active ? colors.surface : colors.textMuted} name="chevron-down-outline" size={15} />
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      {state.status === 'loading' && state.items.length === 0 ? <HistorySkeleton /> : null}
      {state.status === 'error' ? (
        <EmptyState actionLabel="重新加载" description={state.message} onActionPress={() => void reload()} title="记录暂时无法加载" />
      ) : null}
      {state.status !== 'error' && state.status !== 'loading' ? (
        <>
          <MetricGrid items={[
            { icon: 'analytics-outline', label: '训练量', unit: 'kg', value: formatNumber(metrics.totalVolume) },
            { icon: 'calendar-outline', label: '训练次数', unit: '次', value: `${metrics.sessionCount}` },
            { icon: 'barbell-outline', label: '完成组数', unit: '组', value: `${metrics.completedSets}` },
            { icon: 'document-text-outline', label: '完整报告', unit: '份', value: `${metrics.reportCount}` },
          ]} />
          <ChartCard data={trend.values} labels={trend.labels} subtitle={`${range.fromDate} - ${range.toDate}`} title="训练量趋势" />
          <SectionCard title="趋势说明">
            <AppText tone="muted" variant="bodySmall">{trendInsight}</AppText>
          </SectionCard>
          <Pressable accessibilityRole="button" onPress={() => router.push((scope === 'personal' ? '/history/analytics' : '/history/group') as never)}>
            <SectionCard
              action={<AppText tone="brand" variant="caption" weight="900">查看{scope === 'personal' ? '训练' : '小组'}分析 ›</AppText>}
              title={scope === 'personal' ? '训练趋势' : '小组洞察'}
            >
              <InsightList insights={analysisInsights.slice(0, 3)} />
              {scope === 'personal' ? (
                <View style={styles.analysisActions}>
                  <Pressable onPress={() => router.push('/history/analytics' as never)} style={styles.analysisAction}>
                    <AppText tone="brand" variant="bodySmall" weight="900">完整训练分析</AppText>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.analysisActions}>
                  <Pressable onPress={() => router.push('/history/group' as never)} style={styles.analysisAction}><AppText tone="brand" variant="bodySmall" weight="900">小组分析</AppText></Pressable>
                  <Pressable onPress={() => router.push('/history/group/exercise-compare' as never)} style={styles.analysisAction}><AppText tone="brand" variant="bodySmall" weight="900">动作对比</AppText></Pressable>
                  <Pressable onPress={() => router.push('/history/group/attendance' as never)} style={styles.analysisAction}><AppText tone="brand" variant="bodySmall" weight="900">出勤率</AppText></Pressable>
                </View>
              )}
            </SectionCard>
          </Pressable>
          <SectionCard subtitle="点击日期筛选当天训练。" title="近期训练日期">
            <RecentDateStrip
              countsByDate={countsByDate}
              fromDate={range.fromDate}
              onSelectDate={setSelectedDate}
              selectedDate={selectedDate}
              toDate={range.toDate}
            />
          </SectionCard>
          <SectionCard
            action={<AppText tone="muted" variant="caption" weight="900">{visibleItems.length} 项训练</AppText>}
            title={selectedDate ? '当天训练' : '最近训练'}
          >
            {visibleItems.length === 0 ? (
              <EmptyState
                actionLabel={filter.kind === 'all' ? '补录训练' : undefined}
                description={emptyCopy.description}
                onActionPress={filter.kind === 'all' ? () => router.push('/history/manual' as never) : undefined}
                title={emptyCopy.title}
              />
            ) : <HistoryList items={visibleItems} scope={scope} />}
          </SectionCard>
        </>
      ) : null}

      <AppModalSheet
        contentStyle={styles.cyclePickerContent}
        onClose={() => setCyclePickerVisible(false)}
        subtitle="仅显示当前账号和当前小组可见的周期。"
        title="选择历史计划周期"
        visible={isCyclePickerVisible}
      >
        <ScrollView contentContainerStyle={styles.cycleList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {state.cycles.filter((cycle) => cycle.status !== 'active').length === 0 ? (
            <EmptyState description="完成或归档计划周期后，可以在这里按周期筛选。" title="暂无历史周期" />
          ) : state.cycles.filter((cycle) => cycle.status !== 'active').map((cycle) => (
            <Pressable
              accessibilityRole="button"
              key={cycle.cycleId}
              onPress={() => {
                setFilterState({ contextKey, filter: { kind: 'cycle', planCycleId: cycle.cycleId } });
                setCyclePickerVisible(false);
                setSelectedDate(null);
              }}
              style={styles.cycleOption}
            >
              <View style={styles.flex}>
                <AppText variant="bodySmall" weight="900">{cycle.planName} · {cycle.cycleName}</AppText>
                <AppText tone="muted" variant="caption">
                  {cycle.startDate} — {cycle.endDate ?? '未设置'} · {cycle.sessionCount} 次训练
                </AppText>
              </View>
              <Tag label={getPlanCycleStatusLabel(cycle.status)} tone={cycle.status === 'archived' ? 'success' : 'neutral'} />
            </Pressable>
          ))}
        </ScrollView>
      </AppModalSheet>
    </Screen>
  );
}

function HistorySkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeleton, styles.skeletonMetrics]} />
      <View style={[styles.skeleton, styles.skeletonChart]} />
      <View style={[styles.skeleton, styles.skeletonList]} />
    </View>
  );
}

function HistoryList({ items, scope }: { items: HistoryListItem[]; scope: RecordScope }) {
  return (
    <View style={styles.sessionList}>
      {items.map((item) => (
        <Pressable
          accessibilityRole="button"
          key={item.id}
          onPress={() => router.push({ pathname: '/history/[sessionId]', params: { scope, sessionId: item.id } } as never)}
          style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
        >
          <View style={styles.sessionIcon}>
            <Ionicons color={colors.primary} name={item.sessionType === 'manual' ? 'create-outline' : 'barbell-outline'} size={21} />
          </View>
          <View style={styles.flex}>
            <View style={styles.sessionTitleRow}>
              <AppText numberOfLines={1} style={styles.flex} variant="bodySmall" weight="900">{item.title}</AppText>
              <Tag label={item.hasCompleteReport ? '报告完整' : '历史汇总'} tone={item.hasCompleteReport ? 'success' : 'neutral'} />
            </View>
            <AppText numberOfLines={1} tone="muted" variant="caption">
              {item.date} · {item.participantNames.join('、') || '训练成员'}
            </AppText>
            <View style={styles.metaRow}>
              <Tag
                label={item.sessionType === 'manual' ? '补录' : item.sessionType === 'free' ? '自由训练' : item.cycleName ?? '计划训练'}
                tone={item.cycleStatus === 'archived' ? 'success' : 'brand'}
              />
              <AppText tone="muted" variant="caption">{item.completedSets} 组</AppText>
              <AppText tone="muted" variant="caption">{formatNumber(item.totalVolume)} kg</AppText>
              <AppText tone="muted" variant="caption">{formatDuration(item.durationSeconds)}</AppText>
            </View>
          </View>
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  analysisAction: { alignItems: 'center', backgroundColor: colors.brandSoft, borderRadius: radius.md, minHeight: 42, justifyContent: 'center', paddingHorizontal: spacing.md },
  analysisActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cycleList: { gap: spacing.sm, paddingBottom: spacing.sm },
  cycleOption: { alignItems: 'center', backgroundColor: colors.backgroundElevated, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', gap: spacing.sm, minHeight: 64, padding: spacing.md },
  cyclePickerContent: { maxHeight: 500 },
  filterChip: { alignItems: 'center', backgroundColor: colors.backgroundElevated, borderColor: colors.border, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', gap: spacing.xs, minHeight: 40, paddingHorizontal: spacing.md },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterRow: { gap: spacing.sm, paddingRight: spacing.lg },
  flex: { flex: 1, minWidth: 0 },
  metaRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  pressed: { opacity: 0.84 },
  screen: { gap: spacing.lg, paddingBottom: spacing.xxxxl },
  sessionCard: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, borderWidth: 1, flexDirection: 'row', gap: spacing.md, padding: spacing.md },
  sessionIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.lg, height: 48, justifyContent: 'center', width: 48 },
  sessionList: { gap: spacing.sm },
  sessionTitleRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg },
  skeletonChart: { height: 180 },
  skeletonList: { height: 220 },
  skeletonMetrics: { height: 130 },
  skeletonWrap: { gap: spacing.md },
});
