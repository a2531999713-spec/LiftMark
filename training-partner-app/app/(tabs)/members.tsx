import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, MetricCard, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { MAX_GROUP_MEMBERS } from '@/domain/member/member.validation';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing } from '@/theme';

type PartnerStats = {
  streakDays: number;
  totalVolume: number;
  weeklySessions: number;
};

type NoticeState = {
  message: string;
  title: string;
};

function formatKg(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

function calculateStreakDays(dates: string[]): number {
  const dateSet = new Set(dates);
  const cursor = new Date();
  let streak = 0;

  for (let index = 0; index < 30; index += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!dateSet.has(key)) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

export default function MembersRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [stats, setStats] = useState<PartnerStats>({ streakDays: 0, totalVolume: 0, weeklySessions: 0 });
  const [isLocalRuleVisible, setLocalRuleVisible] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const nextMembers = await repositories.memberRepository.listMembers(nextGroup.id);
      const profileEntries = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );
      const sessions = await repositories.workoutRepository.listSessions({ groupId: nextGroup.id, limit: 20 });
      const details = await Promise.all(sessions.map((session) => repositories.workoutRepository.getSessionDetail(session.id)));
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const weeklySessions = sessions.filter((session) => new Date(session.date) >= sevenDaysAgo).length;
      const totalVolume = details
        .flatMap((detail) => detail.sets)
        .filter((set) => set.completed)
        .reduce((sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0), 0);

      setGroup(nextGroup);
      setMembers(nextMembers);
      setProfiles(Object.fromEntries(profileEntries));
      setStats({
        streakDays: calculateStreakDays(sessions.map((session) => session.date)),
        totalVolume,
        weeklySessions,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '搭子加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers]),
  );

  const canAddMember = members.length < MAX_GROUP_MEMBERS;

  return (
    <Screen
      headerRight={
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            canAddMember
              ? guardFeature('add_member', { memberCount: members.length }) && router.push('/member/new')
              : setNotice({
                  title: `本地小组最多支持 ${MAX_GROUP_MEMBERS} 位训练成员`,
                  message: '适合一台设备多人轮换记录。多设备小组能力后续版本开放。',
                })
          }
          style={styles.iconButton}
        >
          <Ionicons color={colors.text} name="person-add-outline" size={20} />
        </Pressable>
      }
      subtitle="本地训练小组、成员 1RM 与搭子协作入口。"
      title="搭子"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="搭子暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <VisualHeroCard
            eyebrow="本地训练小组"
            icon="people-outline"
            imageSource={liftmarkImages.partnerHero}
            subtitle={`${members.length} 成员 · 多人轮换 · 同动作不同重量`}
            title={group?.name ?? '本地训练小组'}
          >
            <View style={styles.heroStats}>
              <View style={styles.heroStatItem}>
                <AppText tone="inverse" variant="caption">
                  本周训练
                </AppText>
                <AppText tone="inverse" variant="subtitle">
                  {stats.weeklySessions} 次
                </AppText>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <AppText tone="inverse" variant="caption">
                  总训练量
                </AppText>
                <AppText tone="inverse" variant="subtitle">
                  {formatKg(stats.totalVolume)}
                </AppText>
              </View>
            </View>
          </VisualHeroCard>

          <AppCard style={styles.localRuleCard} tone="soft">
            <View style={styles.localRuleRow}>
              <Ionicons color={colors.primary} name="information-circle-outline" size={20} />
              <AppText tone="muted" variant="bodySmall" style={styles.localRuleText}>
                当前为本地小组：适合同一台设备多人轮换记录，数据保存在本机。
              </AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setLocalRuleVisible(true)} style={styles.localRuleLink}>
              <AppText tone="brand" variant="caption">
                了解本地小组
              </AppText>
              <Ionicons color={colors.primary} name="chevron-forward" size={16} />
            </Pressable>
          </AppCard>

          <AppCard style={styles.groupCard}>
            <View style={styles.groupHeader}>
              <View style={styles.groupIcon}>
                <Ionicons color={colors.primary} name="people-outline" size={24} />
              </View>
              <View style={styles.groupText}>
                <AppText variant="subtitle">{group?.name ?? '本地训练小组'}</AppText>
                <AppText tone="muted" variant="bodySmall">
                  {members.length} 成员 · 本地数据 · 小组训练
                </AppText>
              </View>
              <Tag label="组长" tone="neutral" />
            </View>

            <View style={styles.metricGrid}>
              <MetricCard label="本周训练" value={`${stats.weeklySessions} 次`} />
              <MetricCard label="总训练量" value={formatKg(stats.totalVolume)} />
              <MetricCard label="连续打卡" value={`${stats.streakDays} 天`} />
            </View>
          </AppCard>

          <SectionHeader
            actionLabel={canAddMember ? '添加' : undefined}
            onActionPress={
              canAddMember
                ? () => {
                    if (guardFeature('add_member', { memberCount: members.length })) router.push('/member/new');
                  }
                : undefined
            }
            subtitle={`已配置 ${members.length}/${MAX_GROUP_MEMBERS} 人`}
            title="成员"
          />

          {members.length === 0 ? (
            <EmptyState
              actionLabel="添加成员"
              description="先添加第一位成员，再输入 1RM 和加重单位。"
              onActionPress={() => {
                if (guardFeature('add_member', { memberCount: members.length })) router.push('/member/new');
              }}
              title="还没有训练搭子"
            />
          ) : null}

          <View style={styles.memberList}>
            {members.map((member) => (
              <PartnerMemberCard
                key={member.id}
                member={member}
                onPress={() => router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } })}
                profile={profiles[member.id] ?? null}
              />
            ))}
          </View>

          {!canAddMember ? (
            <AppCard style={styles.limitCard} tone="soft">
              <AppText variant="bodySmall" weight="900">
                本地小组最多支持 {MAX_GROUP_MEMBERS} 位训练成员
              </AppText>
              <AppText tone="muted" variant="caption">
                适合一台设备多人轮换记录。多设备小组能力后续版本开放。
              </AppText>
            </AppCard>
          ) : (
            <AppButton
              icon="add-outline"
              onPress={() => {
                if (guardFeature('add_member', { memberCount: members.length })) router.push('/member/new');
              }}
            >
              添加成员
            </AppButton>
          )}

          <Modal animationType="slide" transparent visible={isLocalRuleVisible} onRequestClose={() => setLocalRuleVisible(false)}>
            <View style={styles.modalBackdrop}>
              <AppCard style={styles.localRulePanel}>
                <View style={styles.localRulePanelHeader}>
                  <AppText variant="subtitle">本地小组规则</AppText>
                  <Pressable accessibilityRole="button" onPress={() => setLocalRuleVisible(false)} style={styles.modalCloseButton}>
                    <Ionicons color={colors.text} name="close" size={18} />
                  </Pressable>
                </View>
                <RuleItem text="当前版本的小组适合同一台设备多人轮换记录。" />
                <RuleItem text="训练数据保存在本机 SQLite。" />
                <RuleItem text="当前版本组长可以查看本机保存的所有本地成员训练数据。" />
                <RuleItem text="成员加入通过本机添加成员完成，多设备小组能力后续版本开放。" />
                <AppButton onPress={() => setLocalRuleVisible(false)} variant="secondary">
                  我知道了
                </AppButton>
              </AppCard>
            </View>
          </Modal>

          <AppModalSheet
            onClose={() => setNotice(null)}
            position="center"
            subtitle={notice?.message}
            title={notice?.title ?? '提示'}
            visible={Boolean(notice)}
          >
            <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
          </AppModalSheet>

          <AuthGateSheets {...sheets} />
        </>
      ) : null}
    </Screen>
  );
}

type PartnerMemberCardProps = {
  member: GroupMember;
  onPress: () => void;
  profile: MemberProfile | null;
};

function PartnerMemberCard({ member, onPress, profile }: PartnerMemberCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.memberCard, pressed && styles.pressed]}>
      <Avatar
        avatarLocalUri={profile?.avatarLocalUri}
        avatarThumbUrl={profile?.avatarThumbUrl}
        avatarUrl={profile?.avatarUrl ?? member.avatarUrl}
        name={member.displayName}
        size={46}
      />
      <View style={styles.memberMain}>
        <View style={styles.memberTop}>
          <AppText variant="subtitle">{member.displayName}</AppText>
          <Tag label={member.role === 'owner' ? '组长' : '成员'} tone="neutral" />
        </View>
        <AppText tone="muted" variant="caption">
          {profile?.bodyweight ? `${profile.bodyweight} kg` : '体重未设置'}
        </AppText>
        <View style={styles.liftRow}>
          <LiftValue label="卧推" value={profile?.bench1RM} />
          <LiftValue label="深蹲" value={profile?.squat1RM} />
          <LiftValue label="硬拉" value={profile?.deadlift1RM} />
        </View>
      </View>
    </Pressable>
  );
}

function LiftValue({ label, value }: { label: string; value?: number }) {
  return (
    <View style={styles.liftValue}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="caption">{value ? `${value} kg` : '-'}</AppText>
    </View>
  );
}

function RuleItem({ text }: { text: string }) {
  return (
    <View style={styles.ruleItem}>
      <View style={styles.ruleDot} />
      <AppText tone="muted" variant="bodySmall" style={styles.ruleText}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  groupCard: {
    gap: spacing.lg,
  },
  localRuleCard: {
    gap: spacing.sm,
  },
  localRuleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  localRuleText: {
    flex: 1,
  },
  localRuleLink: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  heroStats: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
  },
  heroStatItem: {
    gap: 2,
  },
  heroDivider: {
    backgroundColor: 'rgba(255,255,255,0.26)',
    height: 44,
    width: 1,
  },
  groupHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  groupText: {
    flex: 1,
    gap: 2,
  },
  metricGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberList: {
    gap: spacing.sm,
  },
  memberCard: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  memberMain: {
    flex: 1,
    gap: spacing.xs,
  },
  memberTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  liftRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  liftValue: {
    flex: 1,
    gap: 1,
  },
  limitCard: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  pressed: {
    opacity: 0.82,
  },
  modalBackdrop: {
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  localRulePanel: {
    gap: spacing.md,
  },
  localRulePanelHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalCloseButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  ruleItem: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  ruleDot: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 7,
    marginTop: 8,
    width: 7,
  },
  ruleText: {
    flex: 1,
  },
});
