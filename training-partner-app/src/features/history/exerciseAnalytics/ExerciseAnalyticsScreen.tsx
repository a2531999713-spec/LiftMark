import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import {
  BackHeader,
  ChartCard,
  HorizontalBarRow,
  MetricGrid,
  SectionCard,
  SegmentControl,
} from '@/features/history/shared/HistoryUi';
import {
  buildExerciseAnalytics,
  loadHistoryDataset,
  type ExerciseAnalyticsView,
  type HistoryDataset,
} from '@/features/history/shared/historyViewModel';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';

type ExerciseMetric = 'oneRm' | 'weight' | 'volume';

export function ExerciseAnalyticsScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { range, setRange } = useDateRange('30d');
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const [metric, setMetric] = useState<ExerciseMetric>('oneRm');
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [view, setView] = useState<ExerciseAnalyticsView | null>(null);
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
      const nextDataset = await loadHistoryDataset(range, selectedGroupId);
      setDataset(nextDataset);
      setView(buildExerciseAnalytics(nextDataset, exerciseId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '动作分析加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [exerciseId, range, selectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const chart = useMemo(() => {
    if (!view) return { labels: [], title: '估算 1RM 趋势', unit: 'kg', values: [] };
    if (metric === 'weight') return { labels: view.trendLabels, title: '重量趋势', unit: 'kg', values: view.trendWeight };
    if (metric === 'volume') return { labels: view.trendLabels, title: '训练量趋势', unit: 'kg', values: view.trendVolume };
    return { labels: view.trendLabels, title: '估算 1RM 趋势', unit: 'kg', values: view.trendOneRm };
  }, [metric, view]);

  return (
    <Screen contentStyle={styles.screen}>
      <BackHeader title={`${view?.exercise?.name ?? '动作'}分析`} />
      <DateRangeSelector compact onChange={setRange} range={range} subtitle="当前动作按范围刷新趋势和记录" />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="动作分析暂时无法加载" /> : null}

      {!isLoading && !error && view ? (
        <>
          <MetricGrid
            items={[
              {
                delta: view.bestDate ? `${view.bestDate} 完成` : '样本积累中',
                icon: 'trophy-outline',
                label: '当前最佳成绩',
                unit: view.bestWeight > 0 ? `kg x ${view.bestReps}` : '',
                value: view.bestWeight > 0 ? `${view.bestWeight}` : '暂无',
              },
              {
                delta: view.bestRpe ? `RPE ${view.bestRpe}` : '较上周期',
                icon: 'radio-button-on-outline',
                label: '估算 1RM',
                unit: 'kg',
                value: view.bestEstimatedOneRM > 0 ? `${view.bestEstimatedOneRM}` : '暂无',
              },
            ]}
          />

          <SegmentControl
            onChange={setMetric}
            options={[
              { label: '估算1RM', value: 'oneRm' },
              { label: '重量', value: 'weight' },
              { label: '训练量', value: 'volume' },
            ]}
            value={metric}
          />

          <ChartCard
            action={<Tag label="最近范围" tone="neutral" />}
            data={chart.values}
            formatValue={(value) => (metric === 'volume' ? `${Math.round(value / 1000)}k` : `${Math.round(value)}`)}
            labels={chart.labels}
            title={chart.title}
            unit={chart.unit}
          />

          <View style={styles.twoColumn}>
            <SectionCard title="重量分布">
              <View style={styles.distribution}>
                {view.distribution.map((item) => (
                  <HorizontalBarRow
                    key={item.label}
                    label={item.label}
                    ratio={item.ratio}
                    right={
                      <AppText tone="muted" variant="caption" weight="900">
                        {Math.round(item.ratio * 100)}%
                      </AppText>
                    }
                  />
                ))}
              </View>
            </SectionCard>
            <SectionCard title="最近训练记录">
              <View style={styles.recordList}>
                {view.recentRecords.slice(0, 5).map((record) => (
                  <Pressable
                    accessibilityRole="button"
                    key={record.sessionId}
                    onPress={() => router.push({ pathname: '/history/[sessionId]', params: { sessionId: record.sessionId } } as never)}
                    style={styles.compactRow}
                  >
                    <AppText style={styles.compactDate} tone="muted" variant="caption">
                      {record.date.slice(5).replace('-', '/')}
                    </AppText>
                    <AppText style={styles.compactMain} variant="caption" weight="900">
                      {record.weight}kg x {record.reps}
                    </AppText>
                    <Tag label={record.rpe ? `RPE ${record.rpe}` : `${record.setCount}组`} tone="brand" />
                  </Pressable>
                ))}
              </View>
            </SectionCard>
          </View>

          <SectionCard action={<Tag label={`${view.prTimeline.length} 项`} tone="brand" />} title="PR 时间线">
            {view.prTimeline.length === 0 ? (
              <EmptyState description="该动作还没有可展示的 PR 变化。" title="暂无 PR 时间线" />
            ) : (
              <View style={styles.timeline}>
                {view.prTimeline.slice(0, 5).map((item) => (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <AppText tone="muted" variant="caption">
                      {item.date}
                    </AppText>
                    <AppText style={styles.timelineMain} variant="bodySmall" weight="900">
                      {item.weight}kg x {item.reps}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      估算 1RM {item.estimatedOneRM}kg
                    </AppText>
                    <Tag label="新 PR" tone="brand" />
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard
            action={
              <AppButton icon="create-outline" onPress={() => router.push('/history/manual' as never)} size="sm" variant="secondary">
                记录训练
              </AppButton>
            }
            title="下次建议"
          >
            <View style={styles.suggestion}>
              <View style={styles.suggestionIcon}>
                <Ionicons color={colors.primary} name="trending-up-outline" size={21} />
              </View>
              <AppText style={styles.suggestionText} variant="bodySmall" weight="900">
                {view.suggestion}
              </AppText>
            </View>
          </SectionCard>
        </>
      ) : null}

      {!isLoading && !error && dataset && !view ? <EmptyState description="当前范围内暂无该动作训练记录。" title="暂无动作数据" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  compactDate: {
    width: 44,
  },
  compactMain: {
    flex: 1,
  },
  compactRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  distribution: {
    gap: spacing.sm,
  },
  recordList: {
    gap: spacing.sm,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  suggestion: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  suggestionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  suggestionText: {
    flex: 1,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  timelineMain: {
    flex: 1,
  },
  timelineRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  twoColumn: {
    gap: spacing.lg,
  },
});
