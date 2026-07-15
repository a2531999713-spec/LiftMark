import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppCard,
  AppText,
  MiniLineChart,
  Screen,
  SecondaryPageHeader,
  Tag,
} from '@/components/ui';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';
import { createLocalRepositories } from '@/data/local/repositories';
import { resolveDefaultTrainingMember } from '@/domain/member/member-selection';
import {
  applyConsecutiveLowRecoveryRule,
  calculateRecoveryScore,
} from '@/domain/recovery/recovery-engine';
import type {
  RecoveryAssessmentResult,
  RecoveryLog,
  RecoveryScoreValues,
  RecoveryTrendSummary,
} from '@/domain/recovery/recovery.types';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { scheduleSyncDebounced } from '@/sync/syncOrchestrator';
import { colors, radius, spacing } from '@/theme';

import {
  formatRecoveryDate,
  getAssessmentForLog,
  getRecoveryDraftFromLog,
  getRecoveryRecommendationLabel,
  recoveryScoreItems,
} from './recoveryPresentation';

type LoadState = 'loading' | 'ready' | 'error';
type SaveState = 'idle' | 'editing' | 'saving' | 'saved' | 'error';

function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function RecoveryScreen() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const params = useLocalSearchParams<{ memberId?: string }>();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const userId = useAuthStore((state) => state.user?.id);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState('当前成员');
  const [todayLog, setTodayLog] = useState<RecoveryLog | null>(null);
  const [trend, setTrend] = useState<RecoveryTrendSummary>({
    logs: [],
    averageScore: null,
    goodCount: 0,
    lowCount: 0,
    hasConsecutiveLowStatus: false,
  });
  const [draft, setDraft] = useState<RecoveryScoreValues>(getRecoveryDraftFromLog(null));

  const load = useCallback(async () => {
    setLoadState('loading');
    setError(null);
    try {
      const ownerUserId = await getRequiredCurrentUserId();
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!group) throw new Error('请先创建或选择一个训练小组。');
      const members = await repositories.memberRepository.listMembers(group.id);
      const selectedMember =
        members.find((member) => member.id === params.memberId) ??
        resolveDefaultTrainingMember(members, userId) ??
        members[0] ??
        null;
      if (!selectedMember) throw new Error('当前小组还没有可评估的训练成员。');
      const scope = { ownerUserId, memberId: selectedMember.id };
      const [daily, nextTrend] = await Promise.all([
        repositories.recoveryRepository.getDailyLog({ ...scope, date: localDateString() }),
        repositories.recoveryRepository.getRecentAssessmentTrend({ ...scope, limit: 10 }),
      ]);
      setMemberId(selectedMember.id);
      setMemberName(selectedMember.displayName);
      setTodayLog(daily);
      setTrend(nextTrend);
      setDraft(getRecoveryDraftFromLog(daily));
      setSaveState(daily ? 'saved' : 'idle');
      setLoadState('ready');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '恢复状态暂时无法加载。');
      setLoadState('error');
    }
  }, [params.memberId, repositories, selectedGroupId, userId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const draftAssessment = useMemo(() => calculateRecoveryScore(draft), [draft]);
  const savedAssessment = todayLog ? getAssessmentForLog(todayLog) : null;
  const displayedAssessment = saveState === 'editing' ? draftAssessment : savedAssessment ?? draftAssessment;

  const updateScore = (key: keyof RecoveryScoreValues, value: number) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaveState('editing');
  };

  const save = async () => {
    if (!memberId) return;
    setSaveState('saving');
    setError(null);
    try {
      const ownerUserId = await getRequiredCurrentUserId();
      const base = calculateRecoveryScore(draft);
      const previous = trend.logs
        .filter((log) => log.date !== localDateString())
        .slice(0, 2)
        .map((log) => ({ recommendation: log.recommendation, totalScore: log.totalScore }));
      const assessment = applyConsecutiveLowRecoveryRule(base, previous);
      const saved = await repositories.recoveryRepository.upsertDailyLog({
        ...draft,
        ownerUserId,
        memberId,
        date: localDateString(),
        totalScore: assessment.totalScore,
        recommendation: assessment.recommendation,
      });
      const nextTrend = await repositories.recoveryRepository.getRecentAssessmentTrend({
        ownerUserId,
        memberId,
        limit: 10,
      });
      setTodayLog(saved);
      setTrend(nextTrend);
      setSaveState('saved');
      scheduleSyncDebounced();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存失败，请重试。');
      setSaveState('error');
    }
  };

  if (loadState === 'error') {
    return (
      <Screen>
        <SecondaryPageHeader icon="pulse-outline" subtitle="训练前状态记录" title="恢复状态" />
        <AppCard style={styles.errorCard}>
          <AppText variant="subtitle" weight="900">恢复状态暂时无法加载</AppText>
          <AppText tone="muted" variant="bodySmall">{error}</AppText>
          <AppButton onPress={() => void load()} variant="secondary">重新加载</AppButton>
        </AppCard>
      </Screen>
    );
  }

  return (
    <Screen>
      <SecondaryPageHeader
        caption="今日状态"
        icon="pulse-outline"
        meta={memberName}
        subtitle="六项快速评估，只调整当天训练"
        title="恢复状态"
      />

      {loadState === 'loading' ? (
        <AppCard style={styles.loadingCard}>
          <View style={styles.loadingTitle} />
          <View style={styles.loadingLine} />
          <View style={styles.loadingLineShort} />
        </AppCard>
      ) : (
        <>
          <AssessmentSummary assessment={displayedAssessment} saved={Boolean(todayLog) && saveState !== 'editing'} />

          <View style={styles.sectionHeader}>
            <View>
              <AppText variant="title" weight="900">快速评估</AppText>
              <AppText tone="muted" variant="bodySmall">选择最符合今天感受的一档</AppText>
            </View>
            <Tag label={todayLog ? '编辑今日记录' : '首次记录'} tone={todayLog ? 'neutral' : 'brand'} />
          </View>

          <AppCard style={styles.assessmentCard}>
            {recoveryScoreItems.map((item, index) => (
              <ScoreRow
                key={item.key}
                label={item.label}
                labels={item.labels}
                onChange={(value) => updateScore(item.key, value)}
                showDivider={index < recoveryScoreItems.length - 1}
                value={draft[item.key]}
              />
            ))}
          </AppCard>

          {saveState === 'error' ? (
            <View style={styles.inlineError}>
              <AppText tone="danger" variant="bodySmall" weight="800">保存失败</AppText>
              <AppText tone="muted" variant="caption">{error ?? '请检查后重试。'}</AppText>
            </View>
          ) : null}
          {saveState === 'saved' ? (
            <View style={styles.savedNotice}>
              <Ionicons color={colors.success} name="checkmark-circle" size={18} />
              <AppText tone="success" variant="bodySmall" weight="800">今日记录已保存</AppText>
            </View>
          ) : null}
          <AppButton loading={saveState === 'saving'} onPress={() => void save()} size="lg">
            {todayLog ? '保存今日修改' : '保存今日状态'}
          </AppButton>

          <SuggestionCard assessment={displayedAssessment} />

          <AppCard style={styles.applyCard}>
            <View style={styles.applyHeader}>
              <AppText variant="subtitle" weight="900">应用于本次训练</AppText>
              <Tag label="仅本次" tone="brand" />
            </View>
            <AppText tone="muted" variant="bodySmall">
              开始训练时会再次展示调整内容。只有你确认后，才会创建本次动作快照或临时调整未完成组重量。
            </AppText>
            <AppButton onPress={() => router.back()} variant="secondary">返回今日训练</AppButton>
          </AppCard>

          <RecoveryTrendCard trend={trend} />

          <AppCard style={styles.safetyCard} tone="soft">
            <AppText variant="bodySmall" weight="900">安全说明</AppText>
            <AppText tone="muted" variant="caption">
              恢复建议基于你填写的睡眠、疲劳和身体感受生成，仅用于调整当天训练安排，不构成医疗建议。出现持续疼痛、明显不适或受伤情况时，应停止训练并寻求专业帮助。
            </AppText>
          </AppCard>
        </>
      )}
    </Screen>
  );
}

function AssessmentSummary({ assessment, saved }: { assessment: RecoveryAssessmentResult; saved: boolean }) {
  return (
    <AppCard style={styles.summaryCard} tone={assessment.status === 'good' ? 'soft' : 'default'}>
      <View style={styles.summaryTop}>
        <View style={styles.summaryCopy}>
          <AppText variant="title" weight="900">{assessment.title}</AppText>
          <AppText tone="muted" variant="bodySmall">{assessment.summary}</AppText>
        </View>
        <View style={styles.scoreBadge}>
          <AppText tone="brand" variant="title" weight="900">{assessment.totalScore}</AppText>
          <AppText tone="muted" variant="caption">/ 30</AppText>
        </View>
      </View>
      <View style={styles.summaryMeta}>
        <Tag label={getRecoveryRecommendationLabel(assessment.recommendation)} tone={assessment.status === 'good' ? 'success' : assessment.status === 'normal' ? 'brand' : assessment.status === 'low' ? 'warning' : 'danger'} />
        <AppText tone="muted" variant="caption">{saved ? '已保存' : '预览结果'}</AppText>
      </View>
    </AppCard>
  );
}

function ScoreRow({ label, labels, onChange, showDivider, value }: {
  label: string;
  labels: readonly string[];
  onChange: (value: number) => void;
  showDivider: boolean;
  value: number;
}) {
  return (
    <View style={[styles.scoreBlock, showDivider && styles.scoreDivider]}>
      <View style={styles.scoreLabelRow}>
        <AppText variant="bodySmall" weight="900">{label}</AppText>
        <AppText tone="muted" variant="caption">{labels[value - 1]}</AppText>
      </View>
      <View style={styles.scoreOptions}>
        {[1, 2, 3, 4, 5].map((score) => {
          const selected = score === value;
          return (
            <Pressable
              accessibilityLabel={`${label} ${score} 分，${labels[score - 1]}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={score}
              onPress={() => onChange(score)}
              style={({ pressed }) => [
                styles.scoreOption,
                selected && styles.scoreOptionSelected,
                pressed && styles.pressed,
              ]}
            >
              <AppText tone={selected ? 'inverse' : 'muted'} variant="bodySmall" weight="900">{score}</AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function SuggestionCard({ assessment }: { assessment: RecoveryAssessmentResult }) {
  return (
    <AppCard style={styles.suggestionCard}>
      <View style={styles.applyHeader}>
        <AppText variant="subtitle" weight="900">今日训练建议</AppText>
        {assessment.suggestedWeightReductionPercent ? <Tag label={`临时 -${assessment.suggestedWeightReductionPercent}%`} tone="warning" /> : null}
      </View>
      {assessment.reasons.map((reason) => (
        <View key={reason} style={styles.reasonRow}>
          <View style={styles.reasonMark} />
          <AppText style={styles.reasonText} tone="muted" variant="bodySmall">{reason}</AppText>
        </View>
      ))}
    </AppCard>
  );
}

function RecoveryTrendCard({ trend }: { trend: RecoveryTrendSummary }) {
  const chronological = [...trend.logs].reverse();
  return (
    <AppCard style={styles.trendCard}>
      <View style={styles.applyHeader}>
        <View>
          <AppText variant="subtitle" weight="900">最近状态趋势</AppText>
          <AppText tone="muted" variant="caption">最多展示最近 10 条真实记录</AppText>
        </View>
        {trend.averageScore !== null ? <Tag label={`平均 ${trend.averageScore}`} tone="neutral" /> : null}
      </View>
      {trend.logs.length < 3 ? (
        <View style={styles.trendEmpty}>
          <AppText variant="bodySmall" weight="900">再记录几次后可查看恢复趋势</AppText>
          <AppText tone="muted" variant="caption">未记录日期不会补成 0 分。</AppText>
        </View>
      ) : (
        <>
          <MiniLineChart
            data={chronological.map((log) => log.totalScore)}
            formatValue={(value) => `${value} 分`}
            includeZero={false}
            labels={chronological.map((log) => log.date)}
            labelFormatter={(label) => formatRecoveryDate(label)}
            minChartHeight={6}
            unitLabel="分"
          />
          <View style={styles.statRow}>
            <View style={styles.statItem}><AppText variant="title" weight="900">{trend.goodCount}</AppText><AppText tone="muted" variant="caption">状态良好</AppText></View>
            <View style={styles.statItem}><AppText variant="title" weight="900">{trend.lowCount}</AppText><AppText tone="muted" variant="caption">恢复不足</AppText></View>
          </View>
          {trend.hasConsecutiveLowStatus ? (
            <View style={styles.inlineWarning}>
              <AppText tone="warning" variant="bodySmall" weight="800">最近状态持续偏低，可考虑减量或增加恢复日。</AppText>
            </View>
          ) : null}
        </>
      )}
      {trend.logs.slice(0, 3).map((log) => {
        const assessment = getAssessmentForLog(log);
        return (
          <View key={log.id} style={styles.historyRow}>
            <View style={styles.historyDate}><AppText variant="bodySmall" weight="900">{formatRecoveryDate(log.date)}</AppText><AppText tone="muted" variant="caption">{log.totalScore} 分</AppText></View>
            <View style={styles.historyCopy}><AppText variant="bodySmall" weight="800">{assessment.title}</AppText><AppText numberOfLines={1} tone="muted" variant="caption">{assessment.reasons[0]}</AppText></View>
          </View>
        );
      })}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  applyCard: { gap: spacing.md },
  applyHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  assessmentCard: { gap: 0, paddingVertical: spacing.xs },
  errorCard: { gap: spacing.md },
  historyCopy: { flex: 1, gap: 2 },
  historyDate: { gap: 2, width: 72 },
  historyRow: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  inlineError: { backgroundColor: colors.dangerSoft, borderRadius: radius.md, gap: 2, padding: spacing.sm },
  inlineWarning: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.sm },
  loadingCard: { gap: spacing.sm },
  loadingLine: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 16, width: '88%' },
  loadingLineShort: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 16, width: '62%' },
  loadingTitle: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 28, width: '44%' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.97 }] },
  reasonMark: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 7, marginTop: 6, width: 7 },
  reasonRow: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  reasonText: { flex: 1 },
  safetyCard: { gap: spacing.xs },
  savedNotice: { alignItems: 'center', backgroundColor: colors.successSoft, borderRadius: radius.md, flexDirection: 'row', gap: spacing.xs, padding: spacing.sm },
  scoreBadge: { alignItems: 'baseline', flexDirection: 'row', gap: 2 },
  scoreBlock: { gap: spacing.sm, paddingVertical: spacing.md },
  scoreDivider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  scoreLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  scoreOption: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, flex: 1, height: 44, justifyContent: 'center' },
  scoreOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  scoreOptions: { flexDirection: 'row', gap: spacing.xs },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  statItem: { alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: radius.md, flex: 1, padding: spacing.sm },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  suggestionCard: { gap: spacing.sm },
  summaryCard: { gap: spacing.md },
  summaryCopy: { flex: 1, gap: spacing.xs },
  summaryMeta: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryTop: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.md },
  trendCard: { gap: spacing.md },
  trendEmpty: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, gap: spacing.xs, padding: spacing.md },
});
