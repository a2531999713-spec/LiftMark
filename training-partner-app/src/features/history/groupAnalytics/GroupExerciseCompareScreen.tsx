import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ExerciseTrendFilterSheet } from '@/components/history/ExerciseTrendFilterSheet';
import { AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector } from '@/features/history/shared/DateRangeSelector';
import { addDays, getLocalDateString, type DateRangeValue } from '@/features/history/shared/dateRange';
import {
  AvatarName,
  BackHeader,
  HorizontalBarRow,
  InsightList,
  MultiChartCard,
  SectionCard,
} from '@/features/history/shared/HistoryUi';
import {
  buildGroupExerciseCompare,
  buildExerciseTrendOptions,
  loadHistoryDataset,
  type GroupExerciseCompareView,
  type HistoryDataset,
} from '@/features/history/shared/historyViewModel';

function createEightWeekRange(): DateRangeValue {
  const today = new Date();
  return {
    fromDate: getLocalDateString(addDays(today, -(8 * 7 - 1))),
    preset: 'custom',
    title: '最近8周',
    toDate: getLocalDateString(today),
  };
}

export function GroupExerciseCompareScreen() {
  const [range, setRange] = useState<DateRangeValue>(createEightWeekRange);
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const [view, setView] = useState<GroupExerciseCompareView | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextDataset = await loadHistoryDataset(range);
      const nextOptions = buildExerciseTrendOptions(nextDataset);
      const selectedStillExists = nextOptions.some((option) => option.id === selectedExerciseId);
      const fallbackExerciseId =
        selectedStillExists
          ? selectedExerciseId
          : nextOptions[0]?.id ?? nextDataset.groupAnalysis.exerciseAnalyses[0]?.exerciseId ?? '';
      setDataset(nextDataset);
      setSelectedExerciseId(fallbackExerciseId);
      setView(buildGroupExerciseCompare(nextDataset, fallbackExerciseId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '动作对比加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [range, selectedExerciseId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const exerciseOptions = useMemo(() => (dataset ? buildExerciseTrendOptions(dataset) : []), [dataset]);
  const maxOneRm = Math.max(1, ...(view?.members.map((member) => member.bestEstimatedOneRM) ?? [1]));
  const bestProgress = view?.members[0];
  const averageOneRm = view && view.members.length > 0
    ? view.members.reduce((sum, member) => sum + member.bestEstimatedOneRM, 0) / view.members.length
    : 0;
  const prCount = view?.records.filter((record) => record.isPr).length ?? 0;
  const insights = [
    bestProgress ? `${bestProgress.member.displayName} 当前 ${view?.exerciseName} 表现最高，估算 1RM ${bestProgress.bestEstimatedOneRM}kg。` : '当前动作还没有小组有效记录。',
    averageOneRm > 0 ? `小组平均估算 1RM ${Math.round(averageOneRm)}kg，可作为后续对比基线。` : '动作样本不足，先完成一次小组训练。',
    prCount > 0 ? `范围内有 ${prCount} 条新 PR 记录，保持当前节奏。` : '近期暂无新 PR，可关注完成率和动作稳定性。',
  ];

  return (
    <Screen contentStyle={styles.screen}>
      <BackHeader title="动作对比" />
      <DateRangeSelector compact onChange={setRange} range={range} subtitle="小组动作对比按范围刷新" />

      {exerciseOptions.length > 0 ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => setShowExercisePicker(true)}
          style={({ pressed }) => [styles.exerciseSelector, pressed && styles.pressed]}
        >
          <View style={styles.exerciseSelectorIcon}>
            <Ionicons color={colors.primary} name="options-outline" size={20} />
          </View>
          <View style={styles.exerciseSelectorText}>
            <AppText numberOfLines={1} variant="bodySmall" weight="900">
              {view?.exerciseName ?? '选择动作'}
            </AppText>
            <AppText tone="muted" variant="caption">
              {exerciseOptions.length} 个可对比动作
            </AppText>
          </View>
          <Tag label="筛选" tone="brand" />
        </Pressable>
      ) : null}

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="动作对比暂时无法加载" /> : null}

      {!isLoading && !error && view ? (
        <>
          <SectionCard action={<Tag label="估算 1RM (kg)" tone="neutral" />} title={`${view.exerciseName} 当前最佳成绩`}>
            <View style={styles.rankList}>
              {view.members.length === 0 ? (
                <EmptyState description="当前范围没有该动作的成员记录。" title="暂无对比数据" />
              ) : (
                view.members.map((member, index) => (
                  <Pressable
                    accessibilityRole="button"
                    key={member.member.id}
                    onPress={() => router.push({ pathname: '/history/group/member/[memberId]', params: { memberId: member.member.id } } as never)}
                    style={styles.rankRow}
                  >
                    <Tag label={`${index + 1}`} tone={index === 0 ? 'warning' : 'neutral'} />
                    <AvatarName
                      avatarLocalUri={member.avatarLocalUri}
                      avatarThumbUrl={member.avatarThumbUrl}
                      avatarUrl={member.avatarUrl}
                      name={member.member.displayName}
                    />
                    <View style={styles.rankBar}>
                      <HorizontalBarRow
                        label={member.bestLabel}
                        ratio={member.bestEstimatedOneRM / maxOneRm}
                        right={
                          <AppText variant="subtitle" weight="900">
                            {member.bestEstimatedOneRM.toFixed(1)}
                          </AppText>
                        }
                      />
                    </View>
                  </Pressable>
                ))
              )}
            </View>
            <AppText tone="muted" variant="caption">
              * 1RM 基于 Epley 公式估算
            </AppText>
          </SectionCard>

          <MultiChartCard
            labels={view.labels}
            series={view.members.slice(0, 4).map((member) => ({ label: member.member.displayName, values: member.values }))}
            title={`${view.exerciseName} 1RM 趋势对比`}
          />

          <SectionCard title="本周最佳进步 / PR 达成">
            <View style={styles.progressGrid}>
              <ProgressTile icon="trending-up-outline" label="1RM 提升" value={bestProgress ? `${bestProgress.bestEstimatedOneRM.toFixed(1)} kg` : '暂无'} />
              <ProgressTile icon="stats-chart-outline" label="小组平均" value={averageOneRm > 0 ? `${Math.round(averageOneRm)} kg` : '暂无'} />
              <ProgressTile icon="ribbon-outline" label="本周新 PR" value={`${prCount} 人`} />
            </View>
          </SectionCard>

          <SectionCard title="动作记录">
            <View style={styles.recordList}>
              {view.records.slice(0, 8).map((record, index) => (
                <Pressable
                  accessibilityRole="button"
                  key={`${record.sessionId}-${record.member.id}-${index}`}
                  onPress={() => router.push({ pathname: '/history/[sessionId]', params: { sessionId: record.sessionId } } as never)}
                  style={styles.recordRow}
                >
                  <AvatarName
                    avatarLocalUri={dataset?.profilesByMemberId[record.member.id]?.avatarLocalUri}
                    avatarThumbUrl={dataset?.profilesByMemberId[record.member.id]?.avatarThumbUrl}
                    avatarUrl={dataset?.profilesByMemberId[record.member.id]?.avatarUrl ?? record.member.avatarUrl}
                    name={record.member.displayName}
                    size={32}
                  />
                  <AppText style={styles.recordMain} variant="bodySmall" weight="900">
                    {record.weight}kg x {record.reps}
                  </AppText>
                  {record.isPr ? <Tag label="新 PR" tone="brand" /> : null}
                  <AppText tone="muted" variant="caption">
                    {record.estimatedOneRM.toFixed(1)}kg
                  </AppText>
                </Pressable>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="小组洞察">
            <InsightList insights={insights} />
          </SectionCard>
        </>
      ) : null}

      <ExerciseTrendFilterSheet
        allowAllOption={false}
        onClose={() => setShowExercisePicker(false)}
        onSelect={(exerciseId) => {
          if (!exerciseId) return;
          setSelectedExerciseId(exerciseId);
          if (dataset) setView(buildGroupExerciseCompare(dataset, exerciseId));
        }}
        options={exerciseOptions}
        selectedExerciseId={selectedExerciseId || null}
        visible={showExercisePicker}
      />
    </Screen>
  );
}

function ProgressTile({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.progressTile}>
      <View style={styles.progressIcon}>
        <Ionicons color={colors.primary} name={icon} size={20} />
      </View>
      <AppText variant="title" weight="900">
        {value}
      </AppText>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  exerciseSelector: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  exerciseSelectorIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  exerciseSelectorText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.84,
  },
  progressGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  progressTile: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  rankBar: {
    flex: 1,
  },
  rankList: {
    gap: spacing.md,
  },
  rankRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  recordList: {
    gap: spacing.sm,
  },
  recordMain: {
    flex: 1,
  },
  recordRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
});
