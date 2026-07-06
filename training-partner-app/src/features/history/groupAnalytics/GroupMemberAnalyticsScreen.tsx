import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppModalSheet, AppText, Avatar, EmptyState, Screen, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import {
  BackHeader,
  ChartCard,
  InsightList,
  MetricGrid,
  SectionCard,
} from '@/features/history/shared/HistoryUi';
import {
  buildVolumeTrend,
  formatKg,
  formatPercent,
  getSummaryMetrics,
  loadHistoryDataset,
  summarizeSessions,
  type HistoryDataset,
} from '@/features/history/shared/historyViewModel';

export function GroupMemberAnalyticsScreen() {
  const { memberId } = useLocalSearchParams<{ memberId: string }>();
  const { range, setRange } = useDateRange('30d');
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setDataset(await loadHistoryDataset(range));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '成员分析加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const activeMemberId = selectedMemberId ?? memberId ?? null;
  const member = dataset?.members.find((item) => item.id === activeMemberId) ?? dataset?.members[0] ?? null;
  const memberProfile = member ? dataset?.profilesByMemberId[member.id] ?? null : null;
  const contribution = dataset?.memberContributions.find((item) => item.member.id === member?.id) ?? null;
  const memberSessions = useMemo(
    () => (dataset && member ? summarizeSessions(dataset.details, dataset.exerciseNamesById, member.id) : []),
    [dataset, member],
  );
  const metrics = getSummaryMetrics(memberSessions);
  const volumeTrend = dataset && member ? buildVolumeTrend(memberSessions, range) : { labels: [], values: [] };
  const attendanceValues = volumeTrend.labels.map((label) => {
    const index = volumeTrend.labels.indexOf(label);
    return volumeTrend.values[index] > 0 ? 1 : 0;
  });
  const strongExercises = dataset?.groupAnalysis.exerciseAnalyses
    .map((analysis) => {
      const performance = analysis.members.find((item) => item.memberId === member?.id);
      return performance ? { analysis, performance } : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .slice(0, 4) ?? [];
  const recentSessions = memberSessions.slice(0, 5);
  const insights = [
    metrics.volume > 0 ? `本周期完成 ${formatKg(metrics.volume)} kg 训练量，完成率 ${formatPercent(metrics.completionRate)}。` : '当前周期还没有该成员的有效训练记录。',
    strongExercises[0] ? `${strongExercises[0].analysis.exerciseName} 是当前优势动作，估算 1RM ${strongExercises[0].performance.bestEstimatedOneRM ?? 0}kg。` : '优势动作还在积累样本。',
    contribution?.activeDays ? `近范围内有 ${contribution.activeDays} 个训练日，继续保持稳定出勤。` : '出勤样本不足，可先完成下一次小组训练。',
  ];

  return (
    <Screen contentStyle={styles.screen}>
      <BackHeader
        right={member ? (
          <Pressable accessibilityRole="button" onPress={() => setMemberPickerVisible(true)} style={styles.memberPicker}>
            <Avatar
              avatarLocalUri={memberProfile?.avatarLocalUri}
              avatarThumbUrl={memberProfile?.avatarThumbUrl}
              avatarUrl={memberProfile?.avatarUrl ?? member.avatarUrl}
              name={member.displayName}
              size={28}
            />
            <AppText variant="caption" weight="900">
              {member.displayName}
            </AppText>
            <Ionicons color={colors.textMuted} name="chevron-down" size={14} />
          </Pressable>
        ) : null}
        title="成员分析"
      />
      <DateRangeSelector compact onChange={setRange} range={range} subtitle="成员表现按范围刷新" />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="成员分析暂时无法加载" /> : null}

      {!isLoading && !error && dataset && member && contribution ? (
        <>
          <SectionCard title="成员概况">
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } } as never)} style={styles.heroMember}>
              <Avatar
                avatarLocalUri={memberProfile?.avatarLocalUri}
                avatarThumbUrl={memberProfile?.avatarThumbUrl}
                avatarUrl={memberProfile?.avatarUrl ?? member.avatarUrl}
                name={member.displayName}
                size={72}
              />
              <View style={styles.heroText}>
                <View style={styles.heroTitleRow}>
                  <AppText variant="title" weight="900">
                    {member.displayName}
                  </AppText>
                  <Tag label={member.role === 'owner' ? '组长' : '成员'} tone="accent" />
                </View>
                <AppText tone="brand" variant="bodySmall" weight="900">
                  连续训练 {contribution.streakDays} 天
                </AppText>
              </View>
              <Tag label={contribution.statusLabel === '优秀' ? '本周表现最佳' : contribution.statusLabel} tone="warning" />
            </Pressable>
          </SectionCard>

          <MetricGrid
            items={[
              { delta: '较上期', icon: 'barbell-outline', label: '训练量', unit: 'kg', value: formatKg(metrics.volume) },
              { delta: '较上期', icon: 'layers-outline', label: '完成组数', unit: '组', value: `${metrics.completedSets}` },
              { delta: '较上期', icon: 'calendar-outline', label: '出勤率', value: formatPercent(contribution.sessionCount / Math.max(1, dataset.groupSessions.length)) },
              { delta: '较上期', icon: 'trophy-outline', label: 'PR次数', unit: '次', value: `${contribution.prCount}` },
            ]}
          />

          <ChartCard
            action={<Tag label="较上期" tone="brand" />}
            data={volumeTrend.values}
            formatValue={(value) => `${Math.round(value / 1000)}k`}
            labels={volumeTrend.labels}
            title="每周训练量趋势"
          />

          <ChartCard
            data={attendanceValues}
            formatValue={(value) => `${Math.round(value)}`}
            labels={volumeTrend.labels}
            title="出勤趋势"
            unit="次"
          />

          <SectionCard
            action={
              <AppButton icon="barbell-outline" onPress={() => router.push('/history/group/exercise-compare' as never)} size="sm" variant="secondary">
                查看动作表现
              </AppButton>
            }
            title="个人优势动作"
          >
            <View style={styles.liftGrid}>
              {strongExercises.length === 0 ? (
                <EmptyState description="完成核心动作后，这里会展示该成员的优势动作。" title="暂无优势动作" />
              ) : (
                strongExercises.map(({ analysis, performance }) => (
                  <View key={analysis.exerciseId} style={styles.liftCard}>
                    <AppText variant="bodySmall" weight="900">
                      {analysis.exerciseName}
                    </AppText>
                    <AppText variant="title" weight="900">
                      {performance.bestEstimatedOneRM ?? 0}
                      <AppText tone="muted" variant="caption">
                        {' '}kg
                      </AppText>
                    </AppText>
                    <Tag label={performance.trend === 'up' ? '上升' : performance.trend === 'down' ? '波动' : '稳定'} tone={performance.trend === 'up' ? 'success' : 'neutral'} />
                  </View>
                ))
              )}
            </View>
          </SectionCard>

          <SectionCard title="最近小组训练">
            <View style={styles.sessionList}>
              {recentSessions.map((session) => (
                <Pressable
                  accessibilityRole="button"
                  key={session.id}
                  onPress={() => router.push({ pathname: '/history/[sessionId]', params: { memberId: member.id, scope: 'personal', sessionId: session.id } } as never)}
                  style={styles.sessionRow}
                >
                  <View style={styles.sessionIcon}>
                    <Ionicons color={colors.primary} name="barbell-outline" size={20} />
                  </View>
                  <View style={styles.sessionMain}>
                    <AppText numberOfLines={1} variant="bodySmall" weight="900">
                      {session.title}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      {session.date} · 训练量 {formatKg(session.volume)}kg
                    </AppText>
                  </View>
                  <Tag label="已完成" tone="success" />
                </Pressable>
              ))}
            </View>
          </SectionCard>

          <SectionCard title="洞察与建议">
            <InsightList insights={insights} />
          </SectionCard>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setMemberPickerVisible(false)}
        subtitle="切换后图表、出勤和优势动作会同步刷新"
        title="选择成员"
        visible={memberPickerVisible}
      >
        <ScrollView contentContainerStyle={styles.memberPickerList}>
          {dataset?.members.map((item) => {
            const profile = dataset.profilesByMemberId[item.id];
            const active = item.id === member?.id;
            return (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => {
                  setSelectedMemberId(item.id);
                  setMemberPickerVisible(false);
                  router.setParams({ memberId: item.id });
                }}
                style={[styles.memberPickerRow, active && styles.memberPickerRowActive]}
              >
                <Avatar
                  avatarLocalUri={profile?.avatarLocalUri}
                  avatarThumbUrl={profile?.avatarThumbUrl}
                  avatarUrl={profile?.avatarUrl ?? item.avatarUrl}
                  name={item.displayName}
                  size={42}
                />
                <View style={styles.memberPickerMain}>
                  <AppText numberOfLines={1} variant="bodySmall" weight="900">
                    {item.displayName}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    {item.role === 'owner' ? '组长' : '成员'}
                  </AppText>
                </View>
                {active ? <Ionicons color={colors.primary} name="checkmark-circle" size={20} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </AppModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroMember: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  heroTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  liftCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  liftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  memberPicker: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  memberPickerList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  memberPickerMain: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  memberPickerRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 64,
    padding: spacing.md,
  },
  memberPickerRowActive: {
    borderColor: colors.primary,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  sessionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  sessionList: {
    gap: spacing.sm,
  },
  sessionMain: {
    flex: 1,
    minWidth: 0,
  },
  sessionRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
