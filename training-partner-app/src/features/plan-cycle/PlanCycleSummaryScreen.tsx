import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { getPlanCycleStatusLabel } from '@/domain/plan/planCycle.service';
import type { HistoryListItem } from '@/domain/history/history.types';
import type { PlanCycleOverview } from '@/domain/plan/plan.types';
import { colors, radius, spacing } from '@/theme';

import { usePlanCycleController } from './hooks/usePlanCycleController';
import {
  consumePlanCycleConfirmation,
  dismissPlanCycleConfirmation,
  initialPlanCycleConfirmationState,
  requestPlanCycleConfirmation,
} from './model/planCycleConfirmation.state';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return hours > 0 ? `${hours} 小时 ${minutes} 分` : `${minutes} 分钟`;
}

function formatNumber(value: number): string {
  return Math.round(value).toLocaleString('zh-CN');
}

export function PlanCycleSummaryScreen() {
  const { cycleId } = useLocalSearchParams<{ cycleId: string }>();
  const { archive, complete, isWorking, reload, state } = usePlanCycleController(cycleId);
  const [confirmation, setConfirmation] = useState(initialPlanCycleConfirmationState);
  const [actionError, setActionError] = useState<string | null>(null);

  const runAction = async () => {
    const consumed = consumePlanCycleConfirmation(confirmation);
    const action = consumed.action;
    setConfirmation(consumed.nextState);
    setActionError(null);
    try {
      if (action === 'complete') await complete();
      if (action === 'archive') await archive();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '周期操作失败。');
    }
  };

  return (
    <Screen safeTop={false} subtitle="完成情况、训练统计与单次报告" title="周期总结">
      {state.status === 'loading' ? <CycleSkeleton /> : null}
      {state.status === 'empty' ? <EmptyState description="该周期不存在或当前账号不可见。" title="未找到计划周期" /> : null}
      {state.status === 'error' ? (
        <EmptyState actionLabel="重新加载" description={state.message} onActionPress={() => void reload()} title="周期总结暂时无法加载" />
      ) : null}
      {state.status === 'ready' ? (
        <CycleContent
          isWorking={isWorking}
          onArchive={() => setConfirmation(requestPlanCycleConfirmation('archive'))}
          onComplete={() => setConfirmation(requestPlanCycleConfirmation('complete'))}
          overview={state.overview}
          sessions={state.sessions}
        />
      ) : null}

      <AppModalSheet
        onClose={() => setConfirmation(dismissPlanCycleConfirmation())}
        position="center"
        subtitle={confirmation.action === 'archive'
          ? '归档后该周期不再作为当前周期，但训练历史、报告和周期总结都会保留。'
          : '结束周期后将生成或更新周期总结，不会删除训练历史，也不会修改当前计划内容。'}
        title={confirmation.action === 'archive' ? '归档本周期？' : '结束当前周期？'}
        visible={Boolean(confirmation.action)}
      >
        <View style={styles.actionRow}>
          <AppButton onPress={() => setConfirmation(dismissPlanCycleConfirmation())} style={styles.flexButton} variant="secondary">取消</AppButton>
          <AppButton disabled={isWorking} onPress={() => void runAction()} style={styles.flexButton}>
            {isWorking ? '处理中...' : confirmation.action === 'archive' ? '确认归档' : '确认结束'}
          </AppButton>
        </View>
      </AppModalSheet>
      <AppModalSheet
        onClose={() => setActionError(null)}
        position="center"
        subtitle={actionError ?? undefined}
        title="周期操作失败"
        visible={Boolean(actionError)}
      >
        <AppButton onPress={() => setActionError(null)}>知道了</AppButton>
      </AppModalSheet>
    </Screen>
  );
}

function CycleSkeleton() {
  return (
    <View style={styles.skeletonWrap}>
      <View style={[styles.skeleton, styles.skeletonHero]} />
      <View style={styles.actionRow}>
        <View style={[styles.skeleton, styles.skeletonTile]} />
        <View style={[styles.skeleton, styles.skeletonTile]} />
      </View>
    </View>
  );
}

function CycleContent({
  isWorking,
  onArchive,
  onComplete,
  overview,
  sessions,
}: {
  isWorking: boolean;
  onArchive: () => void;
  onComplete: () => void;
  overview: PlanCycleOverview;
  sessions: HistoryListItem[];
}) {
  const completionPercent = Math.round(overview.completionRate * 100);
  const statusTone = overview.cycle.status === 'archived' || overview.cycle.status === 'completed' ? 'success' : 'brand';
  return (
    <>
      <AppCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.flex}>
            <AppText tone="muted" variant="caption">{overview.planName}</AppText>
            <AppText variant="title" weight="900">{overview.cycle.name}</AppText>
          </View>
          <Tag label={getPlanCycleStatusLabel(overview.cycle.status)} tone={statusTone} />
        </View>
        <AppText tone="muted" variant="bodySmall">
          {overview.cycle.startDate} — {overview.cycle.actualEndDate ?? overview.cycle.endDate ?? '进行中'} · {overview.actualDurationDays} 天
        </AppText>
        <View style={styles.progressHeader}>
          <AppText variant="display" weight="900">{completionPercent}%</AppText>
          <AppText tone="muted" variant="bodySmall">
            {overview.completedWorkoutCount}/{overview.plannedWorkoutCount} 次训练
          </AppText>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completionPercent}%` }]} />
        </View>
        {overview.cycle.status === 'active' ? (
          <AppButton disabled={isWorking} onPress={onComplete} variant="secondary">手动结束本周期</AppButton>
        ) : null}
        {overview.cycle.status === 'completed' ? (
          <AppButton disabled={isWorking} onPress={onArchive}>归档本周期</AppButton>
        ) : null}
      </AppCard>

      <View style={styles.metricGrid}>
        <CycleMetric label="总训练量" unit="kg" value={formatNumber(overview.totalVolume)} />
        <CycleMetric label="完成组数" unit="组" value={`${overview.totalSets}`} />
        <CycleMetric label="总次数" unit="次" value={`${overview.totalReps}`} />
        <CycleMetric label="累计时长" unit="" value={formatDuration(overview.totalDurationSeconds)} />
        <CycleMetric label="预计热量" unit="kcal" value={formatNumber(overview.estimatedCalories)} />
        <CycleMetric label="完整报告" unit="份" value={`${overview.reportCount}`} />
      </View>

      <SectionHeader subtitle="点击记录进入单次训练报告。" title="周期训练记录" />
      {sessions.length === 0 ? (
        <EmptyState description="该周期内还没有已完成训练。训练完成后会出现在这里。" title="周期暂无训练记录" />
      ) : (
        <View style={styles.sessionList}>
          {sessions.map((session) => (
            <AppCard key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionIcon}>
                <Ionicons color={colors.primary} name="barbell-outline" size={20} />
              </View>
              <View style={styles.flex}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">{session.title}</AppText>
                <AppText tone="muted" variant="caption">
                  {session.date} · {session.completedSets} 组 · {formatNumber(session.totalVolume)} kg
                </AppText>
              </View>
              <AppButton
                onPress={() => router.push({ pathname: '/report/[sessionId]', params: { sessionId: session.id } } as never)}
                variant="ghost"
              >
                报告
              </AppButton>
            </AppCard>
          ))}
        </View>
      )}
    </>
  );
}

function CycleMetric({ label, unit, value }: { label: string; unit: string; value: string }) {
  return (
    <AppCard style={styles.metricCard}>
      <AppText tone="muted" variant="caption">{label}</AppText>
      <View style={styles.metricValue}>
        <AppText variant="subtitle" weight="900">{value}</AppText>
        {unit ? <AppText tone="muted" variant="caption">{unit}</AppText> : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1, gap: spacing.xs },
  flexButton: { flex: 1 },
  heroCard: { gap: spacing.md },
  heroHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  metricCard: { flexBasis: '48%', flexGrow: 1, gap: spacing.xs, minWidth: 140 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricValue: { alignItems: 'baseline', flexDirection: 'row', gap: spacing.xs },
  progressFill: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 8 },
  progressHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  progressTrack: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, height: 8, overflow: 'hidden' },
  sessionCard: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  sessionIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 },
  sessionList: { gap: spacing.sm },
  skeleton: { backgroundColor: colors.surfaceMuted, borderRadius: radius.lg },
  skeletonHero: { height: 220 },
  skeletonTile: { flex: 1, height: 110 },
  skeletonWrap: { gap: spacing.md },
});
