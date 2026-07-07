import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import { RecentDateStrip } from '@/features/history/shared/RecentDateStrip';
import { getPresetTitle } from '@/features/history/shared/dateRange';
import {
  ChartCard,
  IconButton,
  InsightList,
  MetricGrid,
  PageHeader,
  SectionCard,
  SegmentControl,
} from '@/features/history/shared/HistoryUi';
import {
  buildPersonalInsights,
  buildVolumeTrend,
  formatKg,
  formatPercent,
  getCountsByDate,
  getSummaryMetrics,
  loadHistoryDataset,
  type HistoryDataset,
  type SessionSummary,
} from '@/features/history/shared/historyViewModel';

type RecordScope = 'personal' | 'group';

export function RecordHomeScreen() {
  const { range, setRange } = useDateRange('7d');
  const [scope, setScope] = useState<RecordScope>('personal');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDataset(await loadHistoryDataset(range));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '记录加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sessions = useMemo(() => {
    const source = scope === 'personal' ? dataset?.personalSessions ?? [] : dataset?.groupSessions ?? [];
    return selectedDate ? source.filter((session) => session.date === selectedDate) : source;
  }, [dataset, scope, selectedDate]);
  const allScopeSessions = scope === 'personal' ? dataset?.personalSessions ?? [] : dataset?.groupSessions ?? [];
  const metrics = getSummaryMetrics(allScopeSessions);
  const trend = buildVolumeTrend(allScopeSessions, range);
  const insights = scope === 'personal'
    ? dataset ? buildPersonalInsights(dataset) : []
    : dataset?.groupAnalysis.insights ?? [];
  const countsByDate = getCountsByDate(allScopeSessions);
  const analyticsPath = scope === 'personal' ? '/history/analytics' : '/history/group';

  return (
    <Screen contentStyle={styles.screen}>
      <PageHeader
        right={<IconButton accessibilityLabel="补录训练" icon="add-outline" onPress={() => router.push('/history/manual' as never)} />}
        subtitle={scope === 'personal' ? '个人训练记录与进展分析' : '小组训练记录与整体表现'}
        title="记录"
      />

      <SegmentControl
        onChange={(nextScope) => {
          setScope(nextScope);
          setSelectedDate(null);
        }}
        options={[
          { label: '个人记录', value: 'personal' },
          { label: '小组记录', value: 'group' },
        ]}
        value={scope}
      />

      <DateRangeSelector
        onChange={(nextRange) => {
          setRange(nextRange);
          setSelectedDate(null);
        }}
        range={range}
      />

      {isLoading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="记录暂时无法加载" /> : null}

      {!isLoading && !error && dataset ? (
        <>
          <MetricGrid
            items={[
              {
                delta: `${getPresetTitle(range)}数据`,
                icon: 'analytics-outline',
                label: `${getPresetTitle(range)}训练量`,
                unit: 'kg',
                value: formatKg(metrics.volume),
              },
              { icon: 'calendar-outline', label: '训练次数', unit: '次', value: `${metrics.sessionCount}` },
              { icon: 'barbell-outline', label: '完成组数', unit: '组', value: `${metrics.completedSets}` },
              { icon: 'radio-button-on-outline', label: '完成率', value: formatPercent(metrics.completionRate) },
            ]}
          />

          <ChartCard
            data={trend.values}
            formatValue={(value) => `${Math.round(value / 1000)}k`}
            labels={trend.labels}
            subtitle={`${range.fromDate} - ${range.toDate}`}
            title="训练量趋势"
          />

          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(analyticsPath as never)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <SectionCard
              action={
                <View style={styles.inlineLink}>
                  <AppText tone="brand" variant="caption" weight="900">
                    查看训练分析
                  </AppText>
                  <Ionicons color={colors.textMuted} name="chevron-forward" size={16} />
                </View>
              }
              title={scope === 'group' ? '小组洞察' : '训练趋势'}
            >
              <InsightList insights={insights.slice(0, 3)} />
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
            action={
              <AppText tone="muted" variant="caption" weight="900">
                {sessions.length} 项训练
              </AppText>
            }
            title={selectedDate ? '当天训练' : '最近训练'}
          >
            <TrainingList scope={scope} sessions={sessions} />
          </SectionCard>
        </>
      ) : null}
    </Screen>
  );
}

function TrainingList({ scope, sessions }: { scope: RecordScope; sessions: SessionSummary[] }) {
  if (sessions.length === 0) {
    return (
      <EmptyState
        actionLabel="补录训练"
        description="当前范围没有训练记录。完成训练或补录后，这里会显示训练摘要。"
        onActionPress={() => router.push('/history/manual' as never)}
        title="还没有训练记录"
      />
    );
  }

  return (
    <View style={styles.sessionList}>
      {sessions.slice(0, 12).map((session) => (
        <Pressable
          accessibilityRole="button"
          key={session.id}
          onPress={() =>
            router.push({
              pathname: '/history/[sessionId]',
              params: { scope, sessionId: session.id },
            } as never)
          }
          style={({ pressed }) => [styles.sessionCard, pressed && styles.pressed]}
        >
          <View style={styles.sessionIcon}>
            <Ionicons color={colors.primary} name={scope === 'group' ? 'people-outline' : 'barbell-outline'} size={22} />
          </View>
          <View style={styles.sessionMain}>
            <View style={styles.sessionTitleRow}>
              <AppText numberOfLines={1} style={styles.sessionTitle} variant="bodySmall" weight="900">
                {session.title || session.mainExerciseNames.join(' / ') || '训练记录'}
              </AppText>
              <Tag label="已完成" tone="success" />
            </View>
            <AppText numberOfLines={1} tone="muted" variant="caption">
              {session.date} · {session.mainExerciseNames.join(' / ') || '训练动作'}
            </AppText>
            <View style={styles.metaGrid}>
              <Meta label="动作" value={`${session.exerciseCount}`} />
              <Meta label="组数" value={`${session.completedSets}`} />
              <Meta label="训练量" value={`${formatKg(session.volume)}kg`} />
              {scope === 'group' ? <Meta label="成员" value={`${session.completedMembers}/${session.participantCount || '-'}`} /> : null}
            </View>
          </View>
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
        </Pressable>
      ))}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaItem}>
      <AppText numberOfLines={1} variant="caption" weight="900">
        {value}
      </AppText>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  inlineLink: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  loadingWrap: {
    paddingVertical: spacing.xl,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  metaItem: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    minWidth: 62,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  pressed: {
    opacity: 0.84,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  sessionCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  sessionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.lg,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  sessionTitle: {
    flex: 1,
  },
  sessionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
});
