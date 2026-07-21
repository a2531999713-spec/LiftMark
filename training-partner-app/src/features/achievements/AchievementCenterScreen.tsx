import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { selectNextMilestone, sortAchievementGroups } from '@/domain/achievement/achievement-engine';
import { colors, radius, spacing } from '@/theme';
import { AchievementGroupCard } from './AchievementProgressCard';
import { AchievementSummaryCard } from './AchievementSummaryCard';
import { remainingAchievementText } from './achievementPresentation';
import { TrainingContinuityStrip } from './TrainingContinuityStrip';
import { useAchievementSnapshot } from './useAchievementSnapshot';

export function AchievementCenterScreen() {
  const { isLoading, remoteFailed, snapshot, source } = useAchievementSnapshot();
  const groups = snapshot ? sortAchievementGroups(snapshot.achievements) : null;
  const next = snapshot ? selectNextMilestone(snapshot.achievements) : null;
  const ratio = next && next.target > 0 ? Math.min(1, next.progress / next.target) : 0;

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.pageHeader}>
        <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>
        <View style={styles.pageHeaderText}>
          <AppText variant="headline" weight="900">成就与里程碑</AppText>
          <AppText style={styles.pageSubtitle} tone="muted" variant="bodySmall">每一次训练，都是向更好的自己迈进。</AppText>
        </View>
        <View style={styles.headerSpacer} />
      </View>
      {isLoading && !snapshot ? <ActivityIndicator color={colors.primary} /> : null}
      {!isLoading && !snapshot ? (
        <EmptyState title="成就暂时无法加载" description="训练数据仍安全保存在本机，请稍后重试。" />
      ) : null}
      {snapshot ? (
        <>
          <AppCard padded={false} style={styles.continuityCard}>
            <AchievementSummaryCard embedded metrics={snapshot.metrics} />
            <View style={styles.continuityDivider} />
            <TrainingContinuityStrip embedded weeks={snapshot.activityWeeks} />
          </AppCard>

          <AppCard style={styles.milestone}>
            <View style={styles.milestoneHeader}>
              <View style={styles.milestoneIcon}><Ionicons color={colors.primary} name="flag-outline" size={22} /></View>
              <View style={styles.milestoneText}>
                <AppText tone="muted" variant="caption" weight="900">下一里程碑</AppText>
                <AppText variant="subtitle" weight="900">{next?.name ?? '当前里程碑已全部完成'}</AppText>
              </View>
              {next ? <AppText tone="brand" variant="bodySmall" weight="900">{remainingAchievementText(next)}</AppText> : null}
            </View>
            {next ? (
              <>
                <View style={styles.progressLabels}>
                  <AppText variant="bodySmall" weight="900">{Math.floor(next.progress)} / {next.target}</AppText>
                  <AppText tone="muted" variant="caption">{Math.round(ratio * 100)}%</AppText>
                </View>
                <View style={styles.track}><View style={[styles.progress, { width: `${ratio * 100}%` }]} /></View>
                <AppText tone="muted" variant="caption">连续性按活跃训练周记录，不要求每天训练。</AppText>
              </>
            ) : (
              <AppText tone="muted" variant="bodySmall">后续版本会继续增加新的训练目标。</AppText>
            )}
          </AppCard>

          {groups && groups.inProgress.length > 0 ? (
            <View style={styles.section}><SectionHeader title="进行中" /><AchievementGroupCard achievements={groups.inProgress} /></View>
          ) : null}
          {groups && groups.achieved.length > 0 ? (
            <View style={styles.section}><SectionHeader title="已解锁" /><AchievementGroupCard achievements={groups.achieved} /></View>
          ) : null}
          <AppText style={styles.note} tone="muted" variant="caption">
            成就来自有效完成的训练、计划周期和恢复评估。新的训练周可以随时重新开始。 · {source === 'merged' ? '已同步' : remoteFailed ? '离线计算' : '本地进度待同步'}
          </AppText>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignItems: 'center', borderRadius: radius.pill, height: 44, justifyContent: 'center', width: 44 },
  content: { paddingTop: spacing.md },
  continuityCard: { overflow: 'hidden' },
  continuityDivider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
  headerSpacer: { width: 44 },
  milestone: { gap: spacing.sm },
  milestoneHeader: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  milestoneIcon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.pill, height: 46, justifyContent: 'center', width: 46 },
  milestoneText: { flex: 1, minWidth: 0 },
  note: { textAlign: 'center' },
  pageHeader: { alignItems: 'center', flexDirection: 'row' },
  pageHeaderText: { alignItems: 'center', flex: 1, gap: spacing.xxs },
  pageSubtitle: { textAlign: 'center' },
  progress: { backgroundColor: colors.primary, borderRadius: radius.pill, height: 6 },
  progressLabels: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  section: { gap: spacing.sm },
  track: { backgroundColor: colors.backgroundElevated, borderRadius: radius.pill, height: 6, overflow: 'hidden' },
});
