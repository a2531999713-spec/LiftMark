import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, MetricCard, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import { estimateOneRM } from '@/domain/history/history-analysis';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { GroupWorkoutConsentSummary } from '@/domain/sync/workoutSync.types';
import { summarizeWorkoutSets } from '@/domain/workout/workout.service';
import type { WorkoutSessionDetail, WorkoutSummary } from '@/domain/workout/workout.types';
import {
  buildGroupWorkoutConsentSummary,
  getConsentStatusLabel,
  getConsentStatusTone,
  requestMemberConsentPlaceholder,
} from '@/services/groupWorkoutConsentService';
import { colors, radius, spacing } from '@/theme';

type SummaryView = {
  bestExerciseName: string;
  bestEstimatedOneRM: number | null;
  durationMinutes: number;
  memberRows: { completedRate: number; memberId: string; memberName: string; volume: number }[];
  totalVolume: number;
};

type NoticeState = {
  message: string;
  title: string;
};

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatDuration(detail: WorkoutSessionDetail | null): number {
  if (!detail?.session.startedAt) {
    return 0;
  }

  const end = detail.session.finishedAt ? new Date(detail.session.finishedAt).getTime() : Date.now();
  const start = new Date(detail.session.startedAt).getTime();
  return Math.max(1, Math.round((end - start) / 60000));
}

function buildSummaryView(
  detail: WorkoutSessionDetail,
  members: GroupMember[],
  exerciseMap: Record<string, Exercise>,
): SummaryView {
  const totalVolume = detail.sets
    .filter((set) => set.completed)
    .reduce((sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0), 0);
  const best = detail.sets
    .filter((set) => set.completed && (set.actualWeight ?? set.plannedWeight) && (set.actualReps ?? set.plannedReps))
    .map((set) => {
      const record = detail.exercises.find((item) => item.id === set.exerciseRecordId);
      const weight = set.actualWeight ?? set.plannedWeight ?? 0;
      const reps = set.actualReps ?? set.plannedReps ?? 0;
      return {
        estimate: estimateOneRM(weight, reps),
        name: record ? exerciseMap[record.exerciseId]?.name ?? record.exerciseId : '训练动作',
        reps,
        weight,
      };
    })
    .sort((left, right) => right.estimate - left.estimate)[0];

  return {
    bestEstimatedOneRM: best?.estimate ?? null,
    bestExerciseName: best ? `${best.name} ${best.weight} kg x ${best.reps}` : '暂无最佳动作',
    durationMinutes: formatDuration(detail),
    memberRows: members.map((member) => {
      const memberSets = detail.sets.filter((set) => set.memberId === member.id);
      const completed = memberSets.filter((set) => set.completed);
      const volume = completed.reduce(
        (sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
        0,
      );

      return {
        completedRate: memberSets.length > 0 ? completed.length / memberSets.length : 0,
        memberId: member.id,
        memberName: member.displayName,
        volume,
      };
    }),
    totalVolume,
  };
}

export default function WorkoutSummaryRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [summary, setSummary] = useState<WorkoutSummary | null>(null);
  const [view, setView] = useState<SummaryView | null>(null);
  const [profilesByMemberId, setProfilesByMemberId] = useState<Record<string, MemberProfile | null>>({});
  const [consentSummary, setConsentSummary] = useState<GroupWorkoutConsentSummary | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      const allMembers = await repositories.memberRepository.listMembers(nextDetail.session.groupId);
      const participantIds = new Set(nextDetail.sets.map((set) => set.memberId));
      const members =
        participantIds.size > 0
          ? allMembers.filter((member) => participantIds.has(member.id))
          : allMembers;
      const memberProfiles = await Promise.all(
        members.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ] as const),
      );
      const exercises = await repositories.exerciseRepository.listExercisesByIds(
        nextDetail.exercises.map((exercise) => exercise.exerciseId),
      );
      const exerciseMap = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));

      setDetail(nextDetail);
      setSummary(summarizeWorkoutSets(sessionId, nextDetail.sets));
      setView(buildSummaryView(nextDetail, members, exerciseMap));
      setProfilesByMemberId(Object.fromEntries(memberProfiles));
      setConsentSummary(buildGroupWorkoutConsentSummary(nextDetail, members, members[0]?.id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练总结加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, sessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadSummary();
    }, [loadSummary]),
  );

  const completionRate = summary && summary.totalSets > 0 ? summary.completedSets / summary.totalSets : 0;

  return (
    <Screen
      headerRight={<Ionicons color={colors.text} name="share-outline" size={22} />}
      subtitle={detail?.session.title ?? '已完成训练'}
      title="训练总结"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="训练总结暂时无法加载" description={error} /> : null}

      {!isLoading && !error && summary && view ? (
        <>
          <VisualHeroCard
            eyebrow="训练总结"
            icon="trophy-outline"
            imageSource={liftmarkImages.historyHero}
            minHeight={190}
            subtitle={`本次训练总量 ${Math.round(view.totalVolume).toLocaleString('zh-CN')} kg`}
            title={`${formatPercent(completionRate)} 完成度`}
          >
            <View style={styles.summaryHeroStats}>
              <View style={styles.heroText}>
                <AppText tone="inverse" variant="caption">
                  最佳动作
                </AppText>
                <AppText tone="inverse" variant="bodySmall" weight="900">
                  {view.bestExerciseName}
                </AppText>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroText}>
                <AppText tone="inverse" variant="caption">
                  时长
                </AppText>
                <AppText tone="inverse" variant="subtitle">
                  {view.durationMinutes} min
                </AppText>
              </View>
            </View>
          </VisualHeroCard>
          <AppCard style={styles.hero}>
            <View style={styles.heroText}>
              <AppText tone="muted" variant="bodySmall">
                完成度与训练量
              </AppText>
              <AppText tone="brand" variant="display">
                {formatPercent(completionRate)}
              </AppText>
              <AppText tone="muted" variant="bodySmall">
                本次训练总量 {Math.round(view.totalVolume).toLocaleString('zh-CN')} kg
              </AppText>
            </View>
            <View style={styles.trophy}>
              <Ionicons color={colors.warning} name="trophy" size={44} />
            </View>
          </AppCard>

          <View style={styles.metricGrid}>
            <MetricCard label="预估 1RM" value={view.bestEstimatedOneRM ? `${view.bestEstimatedOneRM} kg` : '样本不足'} />
            <MetricCard label="总训练时长" value={`${view.durationMinutes} min`} />
          </View>

          <SectionHeader title="成员表现" />
          <View style={styles.memberList}>
            {view.memberRows.map((row) => (
              <AppCard key={row.memberId} style={styles.memberCard}>
                <Avatar
                  avatarLocalUri={profilesByMemberId[row.memberId]?.avatarLocalUri}
                  avatarThumbUrl={profilesByMemberId[row.memberId]?.avatarThumbUrl}
                  avatarUrl={profilesByMemberId[row.memberId]?.avatarUrl}
                  name={row.memberName}
                  size={36}
                />
                <View style={styles.memberMain}>
                  <AppText variant="bodySmall" weight="900">
                    {row.memberName}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    总量 {Math.round(row.volume).toLocaleString('zh-CN')} kg
                  </AppText>
                </View>
                <Tag label={formatPercent(row.completedRate)} tone={row.completedRate >= 0.9 ? 'success' : 'warning'} />
              </AppCard>
            ))}
          </View>

          {consentSummary?.hasOtherMembers ? (
            <GroupWorkoutConsentCard
              onKeepLocal={() =>
                setNotice({
                  title: '已保存训练记录',
                  message: '已按当前训练记录处理。成员确认和云同步接入前，不会自动写入其他成员账号。',
                })
              }
              onRequestConsent={() =>
                setNotice({
                  title: '发送确认',
                  message: requestMemberConsentPlaceholder(),
                })
              }
              profilesByMemberId={profilesByMemberId}
              summary={consentSummary}
            />
          ) : null}

          <AppCard style={styles.analysisCard}>
            <SectionHeader title="表现分析" />
            <View style={styles.analysisRow}>
              <AppText tone="muted" variant="bodySmall">
                本次最佳动作
              </AppText>
              <AppText variant="bodySmall" weight="900">
                {view.bestExerciseName}
              </AppText>
            </View>
            <View style={styles.analysisRow}>
              <AppText tone="muted" variant="bodySmall">
                下次建议
              </AppText>
              <AppText tone="brand" variant="bodySmall" weight="900">
                完成率稳定，可继续推进
              </AppText>
            </View>
            <View style={styles.analysisRow}>
              <AppText tone="muted" variant="bodySmall">
                恢复建议
              </AppText>
              <AppText tone="warning" variant="bodySmall" weight="900">
                中等疲劳，建议保证睡眠 7-8 小时
              </AppText>
            </View>
          </AppCard>

          <View style={styles.buttonRow}>
            <AppButton onPress={() => router.replace('/(tabs)/history')} style={styles.button} variant="secondary">
              返回记录
            </AppButton>
            <AppButton onPress={() => Alert.alert('训练总结', '当前页面已经是本次总结，可继续查看各项数据。')} style={styles.button}>
              再看一次总结
            </AppButton>
          </View>
        </>
      ) : null}

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </Screen>
  );
}

function GroupWorkoutConsentCard({
  onKeepLocal,
  onRequestConsent,
  profilesByMemberId,
  summary,
}: {
  onKeepLocal: () => void;
  onRequestConsent: () => void;
  profilesByMemberId: Record<string, MemberProfile | null>;
  summary: GroupWorkoutConsentSummary;
}) {
  return (
    <AppCard style={styles.consentCard}>
      <SectionHeader title="同步到成员数据" />
      <AppText tone="muted" variant="bodySmall">
        {summary.primaryMessage}
      </AppText>
      <View style={styles.consentList}>
        {summary.members.map((member) => (
          <View key={member.memberId} style={styles.consentRow}>
            <Avatar
              avatarLocalUri={profilesByMemberId[member.memberId]?.avatarLocalUri}
              avatarThumbUrl={profilesByMemberId[member.memberId]?.avatarThumbUrl}
              avatarUrl={profilesByMemberId[member.memberId]?.avatarUrl}
              name={member.memberName}
              size={36}
            />
            <View style={styles.memberMain}>
              <AppText variant="bodySmall" weight="900">
                {member.memberName}
              </AppText>
              <AppText tone="muted" variant="caption">
                {member.description}
              </AppText>
            </View>
            <Tag label={getConsentStatusLabel(member.status)} tone={getConsentStatusTone(member.status)} />
          </View>
        ))}
      </View>
      <View style={styles.consentActions}>
        <AppButton onPress={onKeepLocal} style={styles.button} variant="secondary">
          已保存训练记录
        </AppButton>
        <AppButton onPress={onRequestConsent} style={styles.button}>
          发送确认
        </AppButton>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  heroText: {
    flex: 1,
    gap: spacing.xs,
  },
  summaryHeroStats: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroDivider: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    height: 44,
    width: 1,
  },
  trophy: {
    alignItems: 'center',
    backgroundColor: colors.warningSoft,
    borderRadius: radius.lg,
    height: 88,
    justifyContent: 'center',
    width: 88,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  memberMain: {
    flex: 1,
    gap: 2,
  },
  analysisCard: {
    gap: spacing.sm,
  },
  analysisRow: {
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  button: {
    flex: 1,
  },
  consentActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  consentCard: {
    gap: spacing.md,
  },
  consentList: {
    gap: spacing.sm,
  },
  consentRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
});
