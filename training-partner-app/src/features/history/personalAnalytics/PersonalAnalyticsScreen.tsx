import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ExerciseTrendFilterSheet } from '@/components/history/ExerciseTrendFilterSheet';
import { AppButton, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { estimateOneRM } from '@/domain/history/history-analysis';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import { addDays, buildTrendBuckets, findBucketForDate, getLocalDateString, type DateRangeValue } from '@/features/history/shared/dateRange';
import {
  BackHeader,
  ChartCard,
  InsightList,
  MetricGrid,
  SectionCard,
  SegmentControl,
} from '@/features/history/shared/HistoryUi';
import {
  buildExerciseTrendOptions,
  buildPersonalInsights,
  buildPrTimeline,
  buildVolumeTrend,
  formatKg,
  formatPercent,
  getSummaryMetrics,
  loadHistoryDataset,
  type ExerciseTrendOption,
  type HistoryDataset,
  type SessionSummary,
} from '@/features/history/shared/historyViewModel';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';

type FastRange = '4w' | '8w' | 'custom';
type ExerciseChartTarget = 'oneRm' | 'volume';
type ExerciseTrendMetric = 'oneRm' | 'volume';

function createWeekRange(weeks: 4 | 8): DateRangeValue {
  const today = new Date();
  return {
    fromDate: getLocalDateString(addDays(today, -(weeks * 7 - 1))),
    preset: 'custom',
    title: `最近${weeks}周`,
    toDate: getLocalDateString(today),
  };
}

export function PersonalAnalyticsScreen() {
  const { range, setRange } = useDateRange('30d');
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const [fastRange, setFastRange] = useState<FastRange>('4w');
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exercisePickerTarget, setExercisePickerTarget] = useState<ExerciseChartTarget | null>(null);
  const [selectedOneRmExerciseId, setSelectedOneRmExerciseId] = useState<string | null>(null);
  const [selectedVolumeExerciseId, setSelectedVolumeExerciseId] = useState<string | null>(null);

  const effectiveRange = useMemo(
    () => (fastRange === '4w' ? createWeekRange(4) : fastRange === '8w' ? createWeekRange(8) : range),
    [fastRange, range],
  );

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDataset(await loadHistoryDataset(effectiveRange, selectedGroupId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练分析加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [effectiveRange, selectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sessions = dataset?.personalSessions ?? [];
  const metrics = getSummaryMetrics(sessions);
  const volumeTrend = buildVolumeTrend(sessions, effectiveRange);
  const frequencyTrend = buildFrequencyTrend(sessions, volumeTrend.labels, effectiveRange);
  const exerciseOptions = useMemo(
    () => (dataset ? buildExerciseTrendOptions(dataset, dataset.currentMember?.id) : []),
    [dataset],
  );
  const oneRmExerciseId = resolveExerciseId(selectedOneRmExerciseId, exerciseOptions);
  const volumeExerciseId = resolveExerciseId(selectedVolumeExerciseId, exerciseOptions) ?? oneRmExerciseId;
  const oneRmTrend = dataset && oneRmExerciseId
    ? buildExerciseTrendSeries(dataset, oneRmExerciseId, effectiveRange, 'oneRm')
    : { labels: [], values: [] };
  const exerciseVolumeTrend = dataset && volumeExerciseId
    ? buildExerciseTrendSeries(dataset, volumeExerciseId, effectiveRange, 'volume')
    : { labels: [], values: [] };
  const prTimeline = dataset ? buildPrTimeline(dataset, dataset.currentMember?.id) : [];
  const insights = dataset ? buildPersonalInsights(dataset) : [];
  const pickerSelectedExerciseId = exercisePickerTarget === 'volume' ? volumeExerciseId : oneRmExerciseId;

  return (
    <Screen contentStyle={styles.screen}>
      <BackHeader title="训练分析" />

      <SegmentControl
        onChange={(value) => setFastRange(value)}
        options={[
          { label: '最近4周', value: '4w' },
          { label: '最近8周', value: '8w' },
          { label: '自定义', value: 'custom' },
        ]}
        value={fastRange}
      />

      {fastRange === 'custom' ? (
        <DateRangeSelector
          compact
          onChange={(nextRange) => {
            setRange(nextRange);
            setFastRange('custom');
          }}
          range={range}
          subtitle="自定义日期范围"
        />
      ) : null}

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="训练分析暂时无法加载" /> : null}

      {!isLoading && !error && dataset ? (
        <>
          <MetricGrid
            items={[
              { delta: '较上周期变化', icon: 'barbell-outline', label: '总训练量', unit: 'kg', value: formatKg(metrics.volume) },
              { delta: '较上周期变化', icon: 'calendar-outline', label: '训练次数', unit: '次', value: `${metrics.sessionCount}` },
              { delta: '较上周期变化', icon: 'radio-button-on-outline', label: '完成率', value: formatPercent(metrics.completionRate) },
              { delta: '较上周期变化', icon: 'layers-outline', label: '完成组数', unit: '组', value: `${metrics.completedSets}` },
            ]}
          />

          <ChartCard
            action={
              <AppButton
                disabled={exerciseOptions.length === 0}
                icon="options-outline"
                onPress={() => setExercisePickerTarget('oneRm')}
                size="sm"
                variant="secondary"
              >
                {getExerciseName(exerciseOptions, oneRmExerciseId)}
              </AppButton>
            }
            data={oneRmTrend.values}
            formatValue={(value) => `${Math.round(value)}`}
            labels={oneRmTrend.labels}
            subtitle="点击点位查看该次估算 1RM"
            title="单个动作 1RM 趋势"
          />

          <ChartCard
            action={
              <AppButton
                disabled={exerciseOptions.length === 0}
                icon="options-outline"
                onPress={() => setExercisePickerTarget('volume')}
                size="sm"
                variant="secondary"
              >
                {getExerciseName(exerciseOptions, volumeExerciseId)}
              </AppButton>
            }
            data={exerciseVolumeTrend.values}
            formatValue={(value) => `${Math.round(value / 1000)}k`}
            labels={exerciseVolumeTrend.labels}
            subtitle="点击点位查看该动作训练容量"
            title="单个动作训练容量趋势"
          />

          <ChartCard
            action={<Tag label="较上周期" tone="brand" />}
            data={volumeTrend.values}
            formatValue={(value) => `${Math.round(value / 1000)}k`}
            labels={volumeTrend.labels}
            subtitle="单位：kg"
            title="训练量趋势"
          />

          <ChartCard
            action={<Tag label={`${averageActive(frequencyTrend.values).toFixed(1)} 次/周`} tone="neutral" />}
            data={frequencyTrend.values}
            formatValue={(value) => `${Math.round(value)}`}
            labels={frequencyTrend.labels}
            subtitle="每周训练次数变化"
            title="训练频率趋势"
            unit="次"
          />

          <SectionCard action={<Tag label={`${prTimeline.length} 项`} tone="brand" />} title="PR 时间线">
            {prTimeline.length === 0 ? (
              <EmptyState description="继续积累训练后，这里会显示新 PR 和接近 PR 的表现。" title="暂无 PR 动态" />
            ) : (
              <View style={styles.timeline}>
                {prTimeline.slice(0, 6).map((item) => (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <AppText style={styles.timelineDate} tone="muted" variant="caption">
                      {item.date}
                    </AppText>
                    <AppText style={styles.timelineName} numberOfLines={1} variant="bodySmall" weight="900">
                      {item.exerciseName}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      {item.weight}kg x {item.reps}
                    </AppText>
                    <Tag label={item.tag} tone="brand" />
                  </View>
                ))}
              </View>
            )}
          </SectionCard>

          <SectionCard title="洞察与建议">
            <InsightList insights={insights} />
          </SectionCard>
        </>
      ) : null}

      <ExerciseTrendFilterSheet
        allowAllOption={false}
        onClose={() => setExercisePickerTarget(null)}
        onSelect={(exerciseId) => {
          if (!exerciseId || !exercisePickerTarget) return;
          if (exercisePickerTarget === 'oneRm') {
            setSelectedOneRmExerciseId(exerciseId);
          } else {
            setSelectedVolumeExerciseId(exerciseId);
          }
        }}
        options={exerciseOptions}
        selectedExerciseId={pickerSelectedExerciseId}
        visible={exercisePickerTarget !== null}
      />
    </Screen>
  );
}

function resolveExerciseId(selectedExerciseId: string | null, options: ExerciseTrendOption[]): string | null {
  if (selectedExerciseId && options.some((option) => option.id === selectedExerciseId)) {
    return selectedExerciseId;
  }
  return options[0]?.id ?? null;
}

function getExerciseName(options: ExerciseTrendOption[], exerciseId: string | null): string {
  if (!exerciseId) return '选择动作';
  return options.find((option) => option.id === exerciseId)?.name ?? '选择动作';
}

function buildExerciseTrendSeries(
  dataset: HistoryDataset,
  exerciseId: string,
  range: DateRangeValue,
  metric: ExerciseTrendMetric,
) {
  const buckets = buildTrendBuckets(range.fromDate, range.toDate);
  const values = buckets.map(() => 0);

  dataset.details.forEach((detail) => {
    detail.sets
      .filter((set) => {
        const record = detail.exercises.find((item) => item.id === set.exerciseRecordId);
        return set.completed && record?.exerciseId === exerciseId && (!dataset.currentMember || set.memberId === dataset.currentMember.id);
      })
      .forEach((set) => {
        const bucket = findBucketForDate(buckets, detail.session.date);
        const bucketIndex = bucket ? buckets.findIndex((item) => item.key === bucket.key) : -1;
        if (bucketIndex < 0) return;

        const weight = set.actualWeight ?? set.plannedWeight ?? 0;
        const reps = set.actualReps ?? set.plannedReps ?? 0;
        if (weight <= 0 || reps <= 0) return;

        if (metric === 'volume') {
          values[bucketIndex] += weight * reps;
          return;
        }

        values[bucketIndex] = Math.max(values[bucketIndex], estimateOneRM(weight, reps));
      });
  });

  return {
    labels: buckets.map((bucket) => bucket.label),
    values,
  };
}

function buildFrequencyTrend(sessions: SessionSummary[], labels: string[], range: DateRangeValue) {
  const values = labels.map(() => 0);
  const buckets = buildTrendBuckets(range.fromDate, range.toDate);
  sessions.forEach((session) => {
    const bucket = findBucketForDate(buckets, session.date);
    const index = bucket ? buckets.findIndex((item) => item.key === bucket.key) : -1;
    if (index >= 0) values[index] += 1;
  });
  return {
    labels,
    values,
  };
}

function averageActive(values: number[]) {
  const activeValues = values.filter((value) => value > 0);
  if (activeValues.length === 0) return 0;
  return activeValues.reduce((sum, value) => sum + value, 0) / activeValues.length;
}

const styles = StyleSheet.create({
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  timeline: {
    gap: spacing.sm,
  },
  timelineDate: {
    width: 74,
  },
  timelineDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  timelineName: {
    flex: 1,
  },
  timelineRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
