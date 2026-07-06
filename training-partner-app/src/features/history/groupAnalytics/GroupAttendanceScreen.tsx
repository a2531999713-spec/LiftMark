import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton, AppText, Avatar, EmptyState, Screen, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { DateRangeSelector, useDateRange } from '@/features/history/shared/DateRangeSelector';
import { buildRecentDates, getWeekdayLabel } from '@/features/history/shared/dateRange';
import {
  BackHeader,
  HorizontalBarRow,
  InsightList,
  MetricGrid,
  SectionCard,
  VerticalBars,
} from '@/features/history/shared/HistoryUi';
import {
  buildAttendanceView,
  formatPercent,
  loadHistoryDataset,
  type AttendanceView,
  type HistoryDataset,
} from '@/features/history/shared/historyViewModel';

export function GroupAttendanceScreen() {
  const { range, setRange } = useDateRange('month');
  const [dataset, setDataset] = useState<HistoryDataset | null>(null);
  const [view, setView] = useState<AttendanceView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextDataset = await loadHistoryDataset(range);
      setDataset(nextDataset);
      setView(buildAttendanceView(nextDataset));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '出勤分析加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const attendanceByDate = useMemo(() => {
    if (!dataset) return {};
    return Object.fromEntries(
      dataset.groupSessions.map((session) => [
        session.date,
        session.participantCount > 0 ? session.completedMembers / session.participantCount : 0,
      ]),
    ) as Record<string, number>;
  }, [dataset]);
  const dates = buildRecentDates(range.fromDate, range.toDate, 12);
  const insights = view
    ? [
        `当前范围小组完成率 ${formatPercent(view.averageCompletionRate)}。`,
        `完成 ${view.completedSessions}/${view.plannedSessions} 次可见训练，活跃成员 ${view.activeMembers} 人。`,
        view.missedSessions.length > 0 ? '存在缺席训练，可对待提升成员进行个性化跟进。' : '当前范围没有明显缺席记录。',
      ]
    : [];

  return (
    <Screen contentStyle={styles.screen}>
      <BackHeader title="出勤与完成率" />
      <DateRangeSelector onChange={setRange} range={range} subtitle="选择日期范围查看小组出勤" />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="出勤分析暂时无法加载" /> : null}

      {!isLoading && !error && view && dataset ? (
        <>
          <SectionCard title="出勤日期条">
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.dateHeatRow}>
                {dates.map((date) => {
                  const rate = attendanceByDate[date];
                  const tone = rate === undefined ? 'none' : rate >= 0.8 ? 'good' : rate >= 0.5 ? 'mid' : 'low';
                  return (
                    <View key={date} style={styles.dateHeatItem}>
                      <AppText tone="muted" variant="caption" weight="900">
                        {getWeekdayLabel(date)}
                      </AppText>
                      <AppText variant="caption" weight="900">
                        {date.slice(8)}
                      </AppText>
                      <View style={[styles.heatDot, styles[tone]]} />
                    </View>
                  );
                })}
              </View>
            </ScrollView>
            <View style={styles.legendRow}>
              <Legend color={colors.success} label="出勤良好 ≥80%" />
              <Legend color={colors.warning} label="出勤一般" />
              <Legend color={colors.danger} label="出勤较低" />
              <Legend color={colors.textSubtle} label="未安排" />
            </View>
          </SectionCard>

          <MetricGrid
            items={[
              { delta: '较上期', icon: 'calendar-outline', label: '计划训练次数', unit: '次', value: `${view.plannedSessions}` },
              { delta: '较上期', icon: 'barbell-outline', label: '完成训练次数', unit: '次', value: `${view.completedSessions}` },
              { delta: '较上期', icon: 'radio-button-on-outline', label: '平均完成率', value: formatPercent(view.averageCompletionRate) },
              { delta: '较上期', icon: 'people-outline', label: '活跃成员', unit: '人', value: `${view.activeMembers}` },
            ]}
          />

          <SectionCard action={<Tag label="按周" tone="neutral" />} title="计划与完成次数">
            <VerticalBars bars={view.trend.map((point) => ({ label: point.label, value: point.completed }))} />
            <View style={styles.completionRows}>
              {view.trend.map((point) => (
                <HorizontalBarRow
                  key={point.label}
                  label={point.label}
                  meta={`计划 ${point.planned} · 完成 ${point.completed}`}
                  ratio={point.rate}
                  right={
                    <AppText variant="caption" weight="900">
                      {formatPercent(point.rate)}
                    </AppText>
                  }
                />
              ))}
            </View>
          </SectionCard>

          <SectionCard action={<Tag label="按出勤率排序" tone="neutral" />} title="成员出勤与完成情况">
            <View style={styles.memberRows}>
              {view.memberRows
                .slice()
                .sort((left, right) => right.completionRate - left.completionRate)
                .map((row) => (
                  <Pressable
                    accessibilityRole="button"
                    key={row.member.id}
                    onPress={() => router.push({ pathname: '/history/group/member/[memberId]', params: { memberId: row.member.id } } as never)}
                    style={styles.memberRow}
                  >
                    <Avatar
                      avatarLocalUri={dataset.profilesByMemberId[row.member.id]?.avatarLocalUri}
                      avatarThumbUrl={dataset.profilesByMemberId[row.member.id]?.avatarThumbUrl}
                      avatarUrl={dataset.profilesByMemberId[row.member.id]?.avatarUrl ?? row.member.avatarUrl}
                      name={row.member.displayName}
                      size={38}
                    />
                    <View style={styles.memberMain}>
                      <AppText variant="bodySmall" weight="900">
                        {row.member.displayName}
                      </AppText>
                      <HorizontalBarRow
                        label={`${row.completedSessions}/${view.plannedSessions}`}
                        ratio={row.completionRate}
                        right={
                          <AppText variant="caption" weight="900">
                            {formatPercent(row.completionRate)}
                          </AppText>
                        }
                      />
                    </View>
                    <Tag label={row.status} tone={row.status === '优秀' ? 'success' : row.status === '稳定' ? 'warning' : 'danger'} />
                  </Pressable>
                ))}
            </View>
          </SectionCard>

          <SectionCard action={<Tag label={`${view.missedSessions.length} 条`} tone="neutral" />} title="缺席与补录（最近）">
            {view.missedSessions.length === 0 ? (
              <EmptyState description="当前范围没有缺席训练。" title="暂无缺席记录" />
            ) : (
              <View style={styles.missedList}>
                {view.missedSessions.map((session) => (
                  <View key={session.sessionId} style={styles.missedRow}>
                    <View style={styles.missedIcon}>
                      <Ionicons color={colors.primary} name="calendar-outline" size={18} />
                    </View>
                    <View style={styles.missedMain}>
                      <AppText variant="bodySmall" weight="900">
                        {session.date} · {session.title}
                      </AppText>
                      <AppText tone="muted" variant="caption">
                        {session.absentMembers.length} 人缺席
                      </AppText>
                    </View>
                    <View style={styles.absentAvatars}>
                      {session.absentMembers.slice(0, 3).map((member) => (
                        <Avatar
                          avatarLocalUri={dataset.profilesByMemberId[member.id]?.avatarLocalUri}
                          avatarThumbUrl={dataset.profilesByMemberId[member.id]?.avatarThumbUrl}
                          avatarUrl={dataset.profilesByMemberId[member.id]?.avatarUrl ?? member.avatarUrl}
                          key={member.id}
                          name={member.displayName}
                          size={28}
                        />
                      ))}
                    </View>
                    <AppButton onPress={() => router.push('/history/manual' as never)} size="sm" variant="secondary">
                      补录
                    </AppButton>
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
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  absentAvatars: {
    flexDirection: 'row',
  },
  completionRows: {
    gap: spacing.sm,
  },
  dateHeatItem: {
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 52,
  },
  dateHeatRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingRight: spacing.md,
  },
  good: {
    backgroundColor: colors.success,
  },
  heatDot: {
    borderRadius: radius.pill,
    height: 18,
    width: 18,
  },
  legendDot: {
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  legendItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  low: {
    backgroundColor: colors.danger,
  },
  memberMain: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  memberRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  memberRows: {
    gap: spacing.md,
  },
  mid: {
    backgroundColor: colors.warning,
  },
  missedIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  missedList: {
    gap: spacing.md,
  },
  missedMain: {
    flex: 1,
    minWidth: 0,
  },
  missedRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  none: {
    backgroundColor: colors.textSubtle,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
});
