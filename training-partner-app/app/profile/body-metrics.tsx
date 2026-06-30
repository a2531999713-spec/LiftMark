import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, MiniLineChart, Screen, SecondaryPageHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import {
  buildBodyMetricChangeSummary,
  buildBodyMetricGoalProgress,
  buildBodyMetricTrends,
  buildBodyTrainingCorrelation,
  type BodyTrainingCorrelationInput,
} from '@/domain/body/body-metrics-analysis';
import type { BodyMetric, BodyMetricGoal, BodyMetricGoalType } from '@/domain/body/body-metrics.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutSessionDetail } from '@/domain/workout/workout.types';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing, typography } from '@/theme';

type MetricDraft = {
  bicepCm: string;
  bodyFatPercent: string;
  calfCm: string;
  chestCm: string;
  date: string;
  hipCm: string;
  notes: string;
  thighCm: string;
  waistCm: string;
  weightKg: string;
};

type GoalDraft = {
  goalType: BodyMetricGoalType;
  notes: string;
  targetDate: string;
  targetWeightKg: string;
};

const defaultTrainingSummary: BodyTrainingCorrelationInput = {
  completedSets: 0,
  sessionCount: 0,
  totalVolume: 0,
};

const goalOptions: { label: string; value: BodyMetricGoalType }[] = [
  { label: '增肌', value: 'bulk' },
  { label: '减脂', value: 'cut' },
  { label: '维持', value: 'maintain' },
];

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, count: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + count);
  return next;
}

function toDraft(metric?: BodyMetric | null): MetricDraft {
  return {
    bicepCm: metric?.bicepCm?.toString() ?? '',
    bodyFatPercent: metric?.bodyFatPercent?.toString() ?? '',
    calfCm: metric?.calfCm?.toString() ?? '',
    chestCm: metric?.chestCm?.toString() ?? '',
    date: metric?.date ?? getLocalDateString(),
    hipCm: metric?.hipCm?.toString() ?? '',
    notes: metric?.notes ?? '',
    thighCm: metric?.thighCm?.toString() ?? '',
    waistCm: metric?.waistCm?.toString() ?? '',
    weightKg: metric?.weightKg?.toString() ?? '',
  };
}

function toGoalDraft(goal?: BodyMetricGoal | null): GoalDraft {
  return {
    goalType: goal?.goalType ?? 'maintain',
    notes: goal?.notes ?? '',
    targetDate: goal?.targetDate ?? '',
    targetWeightKg: goal?.targetWeightKg?.toString() ?? '',
  };
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) return undefined;
  const parsed = Math.round(Number(trimmed) * 10) / 10;
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatShortDate(date: string): string {
  return date.slice(5).replace('-', '/');
}

function formatValue(value?: number, unit = ''): string {
  return value === undefined ? '未填' : `${value}${unit}`;
}

function summarizeTraining(details: WorkoutSessionDetail[], memberId: string): BodyTrainingCorrelationInput {
  const memberDetails = details.filter((detail) => detail.sets.some((set) => set.memberId === memberId && set.completed));
  const completedSets = memberDetails.flatMap((detail) => detail.sets).filter((set) => set.memberId === memberId && set.completed);
  return {
    completedSets: completedSets.length,
    sessionCount: memberDetails.length,
    totalVolume: completedSets.reduce(
      (sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
      0,
    ),
  };
}

export default function BodyMetricsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [draft, setDraft] = useState<MetricDraft>(toDraft());
  const [goal, setGoal] = useState<BodyMetricGoal | null>(null);
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(toGoalDraft());
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [trainingSummary, setTrainingSummary] = useState<BodyTrainingCorrelationInput>(defaultTrainingSummary);
  const [isGoalExpanded, setIsGoalExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMeasurementsExpanded, setIsMeasurementsExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingGoal, setIsSavingGoal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
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
      const member = members[0] ?? null;
      setCurrentMember(member);
      if (!member) {
        setMetrics([]);
        setGoal(null);
        setTrainingSummary(defaultTrainingSummary);
        return;
      }

      const [nextMetrics, nextGoal, sessions] = await Promise.all([
        repositories.bodyMetricsRepository.listMetrics(member.id),
        repositories.bodyMetricsRepository.getGoal(member.id),
        repositories.workoutRepository.listSessions({
          fromDate: getLocalDateString(addDays(new Date(), -27)),
          groupId: group.id,
          limit: 100,
          toDate: getLocalDateString(),
        }),
      ]);
      const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
      setMetrics(nextMetrics);
      setGoal(nextGoal);
      setGoalDraft(toGoalDraft(nextGoal));
      setTrainingSummary(summarizeTraining(details, member.id));
      setDraft(toDraft(nextMetrics.find((metric) => metric.date === getLocalDateString()) ?? null));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '身体数据加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const trends = useMemo(() => buildBodyMetricTrends(metrics), [metrics]);
  const chronologicalMetrics = useMemo(() => [...metrics].sort((left, right) => left.date.localeCompare(right.date)), [metrics]);
  const latest = chronologicalMetrics.at(-1);
  const goalProgress = useMemo(() => buildBodyMetricGoalProgress(goal, latest), [goal, latest]);
  const changeSummary = useMemo(() => buildBodyMetricChangeSummary(metrics), [metrics]);
  const trainingCorrelation = useMemo(
    () => buildBodyTrainingCorrelation(metrics, trainingSummary),
    [metrics, trainingSummary],
  );

  const save = async () => {
    if (!currentMember) return;
    setIsSaving(true);
    setError(null);
    try {
      await repositories.bodyMetricsRepository.upsertMetric({
        bicepCm: parseNumber(draft.bicepCm),
        bodyFatPercent: parseNumber(draft.bodyFatPercent),
        calfCm: parseNumber(draft.calfCm),
        chestCm: parseNumber(draft.chestCm),
        date: draft.date,
        hipCm: parseNumber(draft.hipCm),
        memberId: currentMember.id,
        notes: draft.notes,
        thighCm: parseNumber(draft.thighCm),
        waistCm: parseNumber(draft.waistCm),
        weightKg: parseNumber(draft.weightKg),
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '身体数据保存失败。');
    } finally {
      setIsSaving(false);
    }
  };

  const saveGoal = async () => {
    if (!currentMember) return;
    setIsSavingGoal(true);
    setError(null);
    try {
      const nextGoal = await repositories.bodyMetricsRepository.upsertGoal({
        goalType: goalDraft.goalType,
        memberId: currentMember.id,
        notes: goalDraft.notes,
        targetDate: goalDraft.targetDate,
        targetWeightKg: parseNumber(goalDraft.targetWeightKg),
      });
      setGoal(nextGoal);
      setGoalDraft(toGoalDraft(nextGoal));
      setIsGoalExpanded(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '身体目标保存失败。');
    } finally {
      setIsSavingGoal(false);
    }
  };

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        caption="身体数据"
        icon="body-outline"
        meta={currentMember?.displayName ?? '默认成员'}
        subtitle="优先记录体重和日期；围度、目标和训练关联按需展开。"
        title="身体追踪"
      />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="身体数据暂时无法加载" /> : null}

      {!isLoading && !error && !currentMember ? (
        <EmptyState description="先创建一个训练成员，再记录身体数据。" title="暂无训练成员" />
      ) : null}

      {!isLoading && !error && currentMember ? (
        <>
          <AppCard style={styles.summaryCard} tone="dark">
            <View style={styles.summaryHeader}>
              <View style={styles.summaryMain}>
                <AppText style={styles.darkMuted} variant="caption">
                  最新记录 {latest ? formatShortDate(latest.date) : '暂无'}
                </AppText>
                <AppText tone="inverse" variant="headline">
                  {formatValue(latest?.weightKg, 'kg')}
                </AppText>
                <AppText style={styles.darkMuted} variant="caption">
                  {goalProgress.description}
                </AppText>
              </View>
              <Tag label={goalProgress.targetLabel} tone="dark" />
            </View>
            <View style={styles.summaryRow}>
              <DarkMetric label="体脂" value={formatValue(latest?.bodyFatPercent, '%')} />
              <DarkMetric label="腰围" value={formatValue(latest?.waistCm, 'cm')} />
              <DarkMetric label="记录" value={`${metrics.length} 条`} />
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <AppText variant="subtitle" weight="900">
                  快速记录
                </AppText>
                <AppText tone="muted" variant="caption">
                  体重、日期和备注放在最前，适合训练后快速补记。
                </AppText>
              </View>
              <DateStepper date={draft.date} onChange={(date) => setDraft((current) => ({ ...current, date }))} />
            </View>
            <MetricInput label="体重" unit="kg" value={draft.weightKg} onChangeText={(value) => setDraft((current) => ({ ...current, weightKg: value }))} />
            <TextInput
              multiline
              onChangeText={(value) => setDraft((current) => ({ ...current, notes: value }))}
              placeholder="可选：训练后状态、饮食、测量时间"
              placeholderTextColor={colors.textSubtle}
              style={styles.notesInput}
              value={draft.notes}
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => setIsMeasurementsExpanded((value) => !value)}
              style={({ pressed }) => [styles.expandRow, pressed && styles.pressed]}
            >
              <View>
                <AppText variant="bodySmall" weight="900">
                  围度和体脂
                </AppText>
                <AppText tone="muted" variant="caption">
                  体脂、胸围、腰围、臀围、手臂和腿围
                </AppText>
              </View>
              <Ionicons color={colors.textMuted} name={isMeasurementsExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
            </Pressable>
            {isMeasurementsExpanded ? (
              <View style={styles.inputGrid}>
                <MetricInput label="体脂" unit="%" value={draft.bodyFatPercent} onChangeText={(value) => setDraft((current) => ({ ...current, bodyFatPercent: value }))} />
                <MetricInput label="腰围" unit="cm" value={draft.waistCm} onChangeText={(value) => setDraft((current) => ({ ...current, waistCm: value }))} />
                <MetricInput label="胸围" unit="cm" value={draft.chestCm} onChangeText={(value) => setDraft((current) => ({ ...current, chestCm: value }))} />
                <MetricInput label="臀围" unit="cm" value={draft.hipCm} onChangeText={(value) => setDraft((current) => ({ ...current, hipCm: value }))} />
                <MetricInput label="肱二头肌" unit="cm" value={draft.bicepCm} onChangeText={(value) => setDraft((current) => ({ ...current, bicepCm: value }))} />
                <MetricInput label="大腿" unit="cm" value={draft.thighCm} onChangeText={(value) => setDraft((current) => ({ ...current, thighCm: value }))} />
                <MetricInput label="小腿" unit="cm" value={draft.calfCm} onChangeText={(value) => setDraft((current) => ({ ...current, calfCm: value }))} />
              </View>
            ) : null}
            <AppButton disabled={isSaving || !draft.weightKg.trim()} icon="save-outline" onPress={() => void save()} size="lg">
              {isSaving ? '保存中...' : '保存身体数据'}
            </AppButton>
          </AppCard>

          <GoalCard
            draft={goalDraft}
            goal={goal}
            isExpanded={isGoalExpanded}
            isSaving={isSavingGoal}
            onChange={setGoalDraft}
            onSave={() => void saveGoal()}
            onToggle={() => setIsGoalExpanded((value) => !value)}
          />

          <SummaryStrip title="变化摘要" items={changeSummary} />
          <SummaryStrip title="训练关联" items={trainingCorrelation} />

          <AppCard style={styles.card}>
            <AppText variant="subtitle" weight="900">
              趋势
            </AppText>
            <TrendBlock data={trends.weight} empty="暂无体重趋势" label="体重" unit="kg" />
            <TrendBlock data={trends.bodyFat} empty="暂无体脂趋势" label="体脂" unit="%" />
            <TrendBlock data={trends.waist} empty="暂无围度趋势" label="腰围" unit="cm" />
          </AppCard>

          <HistoryCard metrics={metrics} />
        </>
      ) : null}
    </Screen>
  );
}

function GoalCard({
  draft,
  goal,
  isExpanded,
  isSaving,
  onChange,
  onSave,
  onToggle,
}: {
  draft: GoalDraft;
  goal: BodyMetricGoal | null;
  isExpanded: boolean;
  isSaving: boolean;
  onChange: (draft: GoalDraft) => void;
  onSave: () => void;
  onToggle: () => void;
}) {
  const goalLabel = goalOptions.find((option) => option.value === (goal?.goalType ?? draft.goalType))?.label ?? '维持';
  return (
    <AppCard style={styles.card}>
      <Pressable accessibilityRole="button" onPress={onToggle} style={({ pressed }) => [styles.goalHeader, pressed && styles.pressed]}>
        <View>
          <AppText variant="subtitle" weight="900">
            身体目标
          </AppText>
          <AppText tone="muted" variant="caption">
            {goal ? `${goalLabel} · ${goal.targetWeightKg ? `${goal.targetWeightKg}kg` : '未填目标体重'}` : '设置增肌、减脂或维持目标'}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} />
      </Pressable>
      {isExpanded ? (
        <>
          <View style={styles.segmented}>
            {goalOptions.map((option) => {
              const selected = draft.goalType === option.value;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={option.value}
                  onPress={() => onChange({ ...draft, goalType: option.value })}
                  style={({ pressed }) => [styles.segmentButton, selected && styles.segmentButtonActive, pressed && styles.pressed]}
                >
                  <AppText tone={selected ? 'brand' : 'muted'} variant="caption" weight="900">
                    {option.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.inputGrid}>
            <MetricInput
              label="目标体重"
              onChangeText={(value) => onChange({ ...draft, targetWeightKg: value })}
              unit="kg"
              value={draft.targetWeightKg}
            />
            <TextField
              label="目标日期"
              onChangeText={(value) => onChange({ ...draft, targetDate: value })}
              placeholder="YYYY-MM-DD"
              value={draft.targetDate}
            />
          </View>
          <TextInput
            multiline
            onChangeText={(value) => onChange({ ...draft, notes: value })}
            placeholder="可选：目标说明、饮食或阶段备注"
            placeholderTextColor={colors.textSubtle}
            style={styles.notesInput}
            value={draft.notes}
          />
          <AppButton disabled={isSaving} icon="flag-outline" onPress={onSave} size="md">
            {isSaving ? '保存中...' : '保存目标'}
          </AppButton>
        </>
      ) : null}
    </AppCard>
  );
}

function SummaryStrip({ items, title }: { items: { label: string; tone: 'accent' | 'neutral' | 'success' | 'warning'; value: string }[]; title: string }) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardHeader}>
        <AppText variant="subtitle" weight="900">
          {title}
        </AppText>
      </View>
      <View style={styles.summaryGrid}>
        {items.map((item) => (
          <View key={item.label} style={styles.summaryTile}>
            <Tag label={item.label} tone={item.tone} />
            <AppText numberOfLines={1} variant="bodySmall" weight="900">
              {item.value}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function HistoryCard({ metrics }: { metrics: BodyMetric[] }) {
  return (
    <AppCard style={styles.card}>
      <AppText variant="subtitle" weight="900">
        历史记录
      </AppText>
      {metrics.length === 0 ? (
        <View style={styles.inlineEmpty}>
          <Ionicons color={colors.textMuted} name="calendar-clear-outline" size={20} />
          <AppText tone="muted" variant="bodySmall">
            保存一次身体数据后，这里会按日期倒序展示。
          </AppText>
        </View>
      ) : (
        metrics.slice(0, 20).map((metric) => (
          <View key={metric.id} style={styles.historyRow}>
            <View style={styles.historyDate}>
              <AppText variant="caption" weight="900">
                {formatShortDate(metric.date)}
              </AppText>
            </View>
            <View style={styles.historyMain}>
              <AppText variant="bodySmall" weight="900">
                {formatValue(metric.weightKg, 'kg')} · 体脂 {formatValue(metric.bodyFatPercent, '%')}
              </AppText>
              <AppText numberOfLines={1} tone="muted" variant="caption">
                腰围 {formatValue(metric.waistCm, 'cm')} · {metric.notes ?? '无备注'}
              </AppText>
            </View>
          </View>
        ))
      )}
    </AppCard>
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

function DateStepper({ date, onChange }: { date: string; onChange: (date: string) => void }) {
  function addDay(delta: number) {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + delta);
    onChange(getLocalDateString(next));
  }

  return (
    <View style={styles.dateStepper}>
      <Pressable accessibilityRole="button" onPress={() => addDay(-1)} style={styles.dateBtn}>
        <Ionicons color={colors.text} name="chevron-back" size={16} />
      </Pressable>
      <AppText variant="caption" weight="900">
        {date}
      </AppText>
      <Pressable accessibilityRole="button" onPress={() => addDay(1)} style={styles.dateBtn}>
        <Ionicons color={colors.text} name="chevron-forward" size={16} />
      </Pressable>
    </View>
  );
}

function MetricInput({
  label,
  onChangeText,
  unit,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  unit: string;
  value: string;
}) {
  return (
    <View style={styles.metricInput}>
      <View style={styles.inputLabelRow}>
        <AppText variant="caption" weight="900">
          {label}
        </AppText>
        <AppText tone="muted" variant="caption">
          {unit}
        </AppText>
      </View>
      <TextInput
        keyboardType="decimal-pad"
        onChangeText={onChangeText}
        placeholder="可选"
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function TextField({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.metricInput}>
      <AppText variant="caption" weight="900">
        {label}
      </AppText>
      <TextInput
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function TrendBlock({
  data,
  empty,
  label,
  unit,
}: {
  data: { label: string; value: number }[];
  empty: string;
  label: string;
  unit: string;
}) {
  const max = Math.max(1, ...data.map((point) => point.value));
  return (
    <View style={styles.trendBlock}>
      <View style={styles.cardHeader}>
        <AppText variant="bodySmall" weight="900">
          {label}
        </AppText>
        <Tag label={unit} tone="neutral" />
      </View>
      <MiniLineChart
        chartHeight={86}
        data={data.map((point) => point.value)}
        emptyMessage={empty}
        formatValue={(value) => `${Math.round(value * 10) / 10}${unit}`}
        includeZero={false}
        labels={data.map((point) => point.label)}
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
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  darkMetric: {
    flex: 1,
    gap: 2,
  },
  darkMuted: {
    color: colors.darkMuted,
  },
  dateBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  dateStepper: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 3,
  },
  expandRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  goalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  historyDate: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    justifyContent: 'center',
    minWidth: 52,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  historyMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  historyRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  inlineEmpty: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  input: {
    color: colors.textStrong,
    fontSize: typography.sizes.body,
    fontWeight: '900',
    minHeight: 36,
  },
  inputGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  inputLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  metricInput: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    minHeight: 70,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  segmented: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    padding: 4,
  },
  segmentButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    flex: 1,
    minHeight: 34,
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  summaryCard: {
    gap: spacing.lg,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  summaryMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  summaryRow: {
    borderTopColor: 'rgba(255,255,255,0.12)',
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.md,
  },
  summaryTile: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    flexBasis: '31%',
    flexGrow: 1,
    gap: spacing.sm,
    minWidth: 96,
    padding: spacing.md,
  },
  trendBlock: {
    gap: spacing.sm,
  },
});
