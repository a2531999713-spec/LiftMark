import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories } from '@/data/local';
import type { ProgressionSuggestion } from '@/domain/progression/progression.types';
import { ProgressionSuggestionList } from '@/features/progression/ProgressionSuggestionList';
import type { TrainingReportDetail, TrainingReportSessionType } from '@/domain/report/trainingReport.types';
import { colors, radius, spacing } from '@/theme';

import { useTrainingReportController } from './hooks/useTrainingReportController';

const sessionTypeLabels: Record<TrainingReportSessionType, string> = {
  free: '自由训练',
  manual: '补录训练',
  planned: '计划训练',
};

const intensityLabels = { high: '高强度', low: '轻强度', medium: '中等强度' } as const;

function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  return `${hours} 小时 ${minutes % 60} 分钟`;
}

function formatTime(value?: string): string {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}

export function TrainingReportScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { reload, state } = useTrainingReportController(sessionId);
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [suggestions, setSuggestions] = useState<ProgressionSuggestion[]>([]);
  const [suggestionStatus, setSuggestionStatus] = useState<'ready' | 'failed' | 'generating'>('ready');
  const loadSuggestions = useCallback(async () => {
    if (!sessionId) return;
    try {
      setSuggestions(await repositories.progressionRepository.listSuggestionsForSession(sessionId));
      setSuggestionStatus('ready');
    } catch {
      setSuggestionStatus('failed');
    }
  }, [repositories, sessionId]);
  const regenerateSuggestions = useCallback(async () => {
    if (!sessionId) return;
    setSuggestionStatus('generating');
    try {
      setSuggestions(await repositories.progressionRepository.createSuggestionsForSession(sessionId));
      setSuggestionStatus('ready');
    } catch {
      setSuggestionStatus('failed');
    }
  }, [repositories, sessionId]);
  useFocusEffect(useCallback(() => { void loadSuggestions(); }, [loadSuggestions]));
  return (
    <Screen safeTop={false} subtitle="训练结果、成员完成情况与动作明细" title="训练报告">
      {state.status === 'loading' ? <ReportSkeleton /> : null}
      {state.status === 'empty' ? (
        <EmptyState description="该训练记录不存在，或不属于当前账号和小组。" title="未找到训练报告" />
      ) : null}
      {state.status === 'error' ? (
        <EmptyState actionLabel="重新加载" description={state.message} onActionPress={() => void reload()} title="报告暂时无法加载" />
      ) : null}
      {state.status === 'ready' ? (
        <ReportContent
          onRegenerateSuggestions={regenerateSuggestions}
          report={state.report}
          suggestionStatus={suggestionStatus}
          suggestions={suggestions}
        />
      ) : null}
    </Screen>
  );
}

function ReportSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeleton, styles.skeletonHero]} />
      <View style={styles.skeletonRow}>
        <View style={[styles.skeleton, styles.skeletonTile]} />
        <View style={[styles.skeleton, styles.skeletonTile]} />
      </View>
      <View style={[styles.skeleton, styles.skeletonCard]} />
    </View>
  );
}

function ReportContent({
  onRegenerateSuggestions,
  report,
  suggestionStatus,
  suggestions,
}: {
  onRegenerateSuggestions: () => void;
  report: TrainingReportDetail;
  suggestionStatus: 'ready' | 'failed' | 'generating';
  suggestions: ProgressionSuggestion[];
}) {
  return (
    <>
      {report.isHistoricalFallback ? (
        <AppCard style={styles.compatibilityCard} tone="soft">
          <View style={styles.noticeIcon}>
            <Ionicons color={colors.warning} name="information-circle-outline" size={22} />
          </View>
          <View style={styles.flex}>
            <AppText variant="bodySmall" weight="900">历史记录汇总</AppText>
            <AppText tone="muted" variant="caption">
              该记录创建于训练报告功能启用前，部分统计由历史训练明细即时汇总，未修改原始数据。
            </AppText>
          </View>
        </AppCard>
      ) : null}

      <AppCard style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <AppText tone="muted" variant="caption">{report.sessionDate}</AppText>
            <AppText variant="title" weight="900">{report.sessionTitle}</AppText>
          </View>
          <Tag label={sessionTypeLabels[report.sessionType]} tone={report.sessionType === 'planned' ? 'brand' : 'neutral'} />
        </View>
        <View style={styles.timeRow}>
          <TimeItem label="开始" value={formatTime(report.startedAt)} />
          <Ionicons color={colors.textSubtle} name="arrow-forward" size={18} />
          <TimeItem label="结束" value={formatTime(report.finishedAt)} />
          <View style={styles.timeDivider} />
          <TimeItem label="用时" value={formatDuration(report.durationSeconds)} />
        </View>
        <View style={styles.contextRow}>
          <Tag label={intensityLabels[report.intensityLevel]} tone="warning" />
          {report.planName ? <AppText tone="muted" variant="caption">{report.planName}</AppText> : null}
          {report.cycleName ? <AppText tone="muted" variant="caption">· {report.cycleName}</AppText> : null}
          {report.sessionType === 'planned' ? (
            <AppText tone="muted" variant="caption">· 第 {report.week} 周 · 第 {report.weekday} 练</AppText>
          ) : null}
        </View>
      </AppCard>

      <View style={styles.metricGrid}>
        <ReportMetric icon="barbell-outline" label="总训练量" unit="kg" value={formatNumber(report.totalVolume)} />
        <ReportMetric icon="layers-outline" label="完成组数" unit="组" value={`${report.totalSets}`} />
        <ReportMetric icon="repeat-outline" label="总次数" unit="次" value={`${report.totalReps}`} />
        <ReportMetric icon="fitness-outline" label="完成动作" unit="个" value={`${report.exerciseCount}`} />
      </View>

      <AppCard style={styles.calorieCard}>
        <View style={styles.calorieHeader}>
          <View style={styles.calorieIcon}>
            <Ionicons color={colors.warning} name="flame-outline" size={24} />
          </View>
          <View style={styles.flex}>
            <AppText tone="muted" variant="caption">预计热量消耗</AppText>
            <AppText variant="title" weight="900">
              {formatNumber(report.estimatedCaloriesMin)}–{formatNumber(report.estimatedCaloriesMax)} kcal
            </AppText>
          </View>
        </View>
        <AppText tone="muted" variant="caption">
          热量为基于训练时长、强度和参与成员体重计算的估算值，仅供参考。
        </AppText>
        {report.calorieEstimateUsedDefaultBodyweight ? (
          <View style={styles.weightHint}>
            <Ionicons color={colors.accent} name="body-outline" size={17} />
            <AppText tone="muted" variant="caption">部分成员未填写体重，完善体重后估算更准确。</AppText>
          </View>
        ) : null}
      </AppCard>

      <ProgressionSuggestionList
        emptyDescription={suggestionStatus === 'failed' ? '建议暂未生成；训练报告和历史记录未受影响。' : undefined}
        exerciseNames={Object.fromEntries(report.exercises.map((exercise) => [exercise.exerciseId, exercise.exerciseName]))}
        isGenerating={suggestionStatus === 'generating'}
        memberNames={Object.fromEntries(report.members.map((member) => [member.memberId, member.memberName]))}
        onRetry={onRegenerateSuggestions}
        suggestions={suggestions}
      />

      <SectionHeader subtitle="训练整体汇总之外，按参与成员分别统计。" title="成员完成情况" />
      <View style={styles.memberList}>
        {report.members.map((member) => (
          <AppCard key={member.memberId} style={styles.memberRow}>
            <View style={styles.memberAvatar}>
              <AppText tone="brand" variant="bodySmall" weight="900">{member.memberName.slice(0, 1)}</AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="bodySmall" weight="900">{member.memberName}</AppText>
              <AppText tone="muted" variant="caption">
                {member.completedSets} 组 · {member.totalReps} 次
              </AppText>
            </View>
            <AppText variant="bodySmall" weight="900">{formatNumber(member.totalVolume)} kg</AppText>
          </AppCard>
        ))}
      </View>

      <SectionHeader subtitle="每个动作展示实际完成组、成员与训练量。" title="动作完成情况" />
      <View style={styles.exerciseList}>
        {report.exercises.map((exercise) => (
          <AppCard key={exercise.recordId} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={styles.flex}>
                <AppText variant="subtitle" weight="900">{exercise.exerciseName}</AppText>
                <AppText tone="muted" variant="caption">
                  {exercise.completedSets} 组 · {exercise.totalReps} 次 · {formatNumber(exercise.totalVolume)} kg
                </AppText>
              </View>
              <View style={styles.tagRow}>
                {exercise.isTemporary ? <Tag label="临时添加" tone="warning" /> : null}
                {exercise.replacedFromExerciseName ? <Tag label="替换动作" tone="brand" /> : null}
              </View>
            </View>
            {exercise.replacedFromExerciseName ? (
              <AppText tone="muted" variant="caption">由“{exercise.replacedFromExerciseName}”替换</AppText>
            ) : null}
            <View style={styles.setList}>
              {exercise.sets.map((set) => (
                <View key={`${set.memberId}-${set.setNumber}`} style={styles.setRow}>
                  <AppText tone="muted" variant="caption">{set.memberName} · 第 {set.setNumber} 组</AppText>
                  <AppText variant="bodySmall" weight="900">
                    {set.skipped ? '已跳过' : `${set.weight} kg × ${set.reps}`}
                  </AppText>
                </View>
              ))}
            </View>
          </AppCard>
        ))}
      </View>

      {report.notes ? (
        <AppCard style={styles.notesCard}>
          <SectionHeader title="个人备注" />
          <AppText tone="muted" variant="bodySmall">{report.notes}</AppText>
        </AppCard>
      ) : null}
    </>
  );
}

function TimeItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeItem}>
      <AppText tone="muted" variant="caption">{label}</AppText>
      <AppText variant="bodySmall" weight="900">{value}</AppText>
    </View>
  );
}

function ReportMetric({ icon, label, unit, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; unit: string; value: string }) {
  return (
    <AppCard style={styles.metricCard}>
      <Ionicons color={colors.primary} name={icon} size={21} />
      <AppText tone="muted" variant="caption">{label}</AppText>
      <View style={styles.metricValueRow}>
        <AppText variant="title" weight="900">{value}</AppText>
        <AppText tone="muted" variant="caption">{unit}</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  calorieCard: { gap: spacing.md },
  calorieHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  calorieIcon: { alignItems: 'center', backgroundColor: colors.warningSoft, borderRadius: radius.lg, height: 48, justifyContent: 'center', width: 48 },
  compatibilityCard: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  contextRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  exerciseCard: { gap: spacing.md },
  exerciseHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  exerciseList: { gap: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  heroCard: { gap: spacing.lg },
  heroTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  memberAvatar: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 40, justifyContent: 'center', width: 40 },
  memberList: { gap: spacing.sm },
  memberRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  metricCard: { flexBasis: '48%', flexGrow: 1, gap: spacing.xs, minWidth: 140 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xs },
  notesCard: { gap: spacing.sm },
  noticeIcon: { paddingTop: spacing.xxs },
  setList: { gap: spacing.xs },
  setRow: { alignItems: 'center', backgroundColor: colors.backgroundElevated, borderRadius: radius.sm, flexDirection: 'row', justifyContent: 'space-between', minHeight: 44, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg },
  skeletonCard: { height: 132 },
  skeletonHero: { height: 170 },
  skeletonRow: { flexDirection: 'row', gap: spacing.sm },
  skeletonTile: { flex: 1, height: 108 },
  skeletonWrap: { gap: spacing.md },
  tagRow: { alignItems: 'flex-end', gap: spacing.xs },
  timeDivider: { backgroundColor: colors.border, height: 34, width: 1 },
  timeItem: { gap: spacing.xs },
  timeRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  weightHint: { alignItems: 'center', backgroundColor: colors.accentSoft, borderRadius: radius.sm, flexDirection: 'row', gap: spacing.sm, padding: spacing.sm },
});
