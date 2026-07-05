import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { MAX_GROUP_MEMBERS } from '@/domain/member/member.validation';
import { useAuthGate } from '@/hooks/useAuthGate';
import { syncGroupMembersAvatar } from '@/services/memberSyncService';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function MembersRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const allGroups = await repositories.groupRepository.listGroups();
      const nextGroup = allGroups.find((item) => item.id === selectedGroupId) ?? allGroups[0] ?? null;
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }
      if (nextGroup.id !== selectedGroupId) {
        setSelectedGroupId(nextGroup.id);
      }

      await syncGroupMembersAvatar(nextGroup.id);

      const nextMembers = await repositories.memberRepository.listMembers(nextGroup.id);
      const profileEntries = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );

      setGroup(nextGroup);
      setMembers(nextMembers);
      setProfiles(Object.fromEntries(profileEntries));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '搭子加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers]),
  );

  const canAddMember = members.length < MAX_GROUP_MEMBERS;
  const hasOnlineMembers = members.some((member) => member.memberType === 'real');
  const groupModeLabel = hasOnlineMembers ? '联机小组' : '本地小组';

  const addMember = useCallback(() => {
    if (canAddMember) {
      if (guardFeature('add_member', { memberCount: members.length })) {
        router.push('/member/new');
      }
      return;
    }

    setNotice({
      title: `小组最多支持 ${MAX_GROUP_MEMBERS} 位训练成员`,
      message: '当前设备仍可继续管理已有成员和训练记录。',
    });
  }, [canAddMember, guardFeature, members.length]);

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={addMember} style={styles.iconButton}>
          <Ionicons color={colors.text} name="person-add-outline" size={20} />
        </Pressable>
      }
      subtitle="管理当前设备用于训练记录的小组成员"
      title="搭子"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="搭子暂时无法加载" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.summaryCard}>
            <View style={styles.summaryHeader}>
              <View style={styles.groupIcon}>
                <Ionicons color={colors.primary} name="people-outline" size={22} />
              </View>
              <View style={styles.summaryText}>
                <AppText numberOfLines={1} variant="subtitle">
                  {group?.name ?? '训练小组'}
                </AppText>
                <AppText tone="muted" variant="caption">
                  当前设备可为小组成员记录同一次训练
                </AppText>
              </View>
              <Tag label={groupModeLabel} tone={hasOnlineMembers ? 'brand' : 'neutral'} />
            </View>
            <View style={styles.summaryMetaRow}>
              <SummaryPill icon="person-outline" label={`${members.length}/${MAX_GROUP_MEMBERS} 人`} />
              <SummaryPill icon="phone-portrait-outline" label="本机记录" />
            </View>
          </AppCard>

          <SectionHeader
            actionLabel={canAddMember ? '添加' : undefined}
            onActionPress={canAddMember ? addMember : undefined}
            subtitle="点击成员可编辑昵称、体重、1RM 和加重单位"
            title="小组成员"
          />

          {members.length === 0 ? (
            <EmptyState
              actionLabel="添加成员"
              description="先添加第一位成员，再开始多人训练记录。"
              onActionPress={addMember}
              title="还没有训练成员"
            />
          ) : (
            <View style={styles.memberList}>
              {members.map((member) => (
                <MemberListCard
                  key={member.id}
                  member={member}
                  onPress={() => router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } })}
                  profile={profiles[member.id] ?? null}
                />
              ))}
            </View>
          )}

          {canAddMember ? (
            <AppButton icon="add-outline" onPress={addMember}>
              添加本地成员
            </AppButton>
          ) : (
            <AppCard style={styles.limitCard} tone="soft">
              <AppText variant="bodySmall" weight="900">
                已达到 {MAX_GROUP_MEMBERS} 人上限
              </AppText>
              <AppText tone="muted" variant="caption">
                可继续编辑现有成员资料和训练参数。
              </AppText>
            </AppCard>
          )}

          <AppCard style={styles.tipCard} tone="soft">
            <View style={styles.tipRow}>
              <Ionicons color={colors.textMuted} name="information-circle-outline" size={18} />
              <AppText tone="muted" variant="caption">
                点击成员可编辑参数；进入成员详情可删除非所有者成员。联机邀请和加入入口在账号面板的「训练小组」中。
              </AppText>
            </View>
          </AppCard>

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

function SummaryPill({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.summaryPill}>
      <Ionicons color={colors.textMuted} name={icon} size={15} />
      <AppText tone="muted" variant="caption" weight="900">
        {label}
      </AppText>
    </View>
  );
}

type MemberListCardProps = {
  member: GroupMember;
  onPress: () => void;
  profile: MemberProfile | null;
};

function MemberListCard({ member, onPress, profile }: MemberListCardProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.memberCard, pressed && styles.pressed]}>
      <Avatar
        avatarLocalUri={profile?.avatarLocalUri}
        avatarThumbUrl={profile?.avatarThumbUrl}
        avatarUrl={profile?.avatarUrl ?? member.avatarUrl}
        name={member.displayName}
        size={48}
      />
      <View style={styles.memberMain}>
        <View style={styles.memberTop}>
          <AppText numberOfLines={1} style={styles.memberName} variant="subtitle">
            {member.displayName}
          </AppText>
          <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
        </View>
        <View style={styles.memberTags}>
          {member.role === 'owner' ? <Tag label="我" tone="brand" /> : null}
          <Tag
            label={member.memberType === 'real' ? '已登录成员' : '本地成员'}
            tone={member.memberType === 'real' ? 'success' : 'neutral'}
          />
        </View>
        <View style={styles.memberMetrics}>
          <LiftValue label="体重" value={profile?.bodyweight} />
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
      <AppText numberOfLines={1} variant="caption" weight="900">
        {value ? `${value}kg` : '-'}
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
  summaryCard: {
    gap: spacing.md,
    padding: spacing.lg,
  },
  summaryHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  groupIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  summaryText: {
    flex: 1,
    gap: 2,
  },
  summaryMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  summaryPill: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
  memberMain: {
    flex: 1,
    gap: spacing.xs,
  },
  memberTop: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberName: {
    flex: 1,
  },
  memberTags: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  memberMetrics: {
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
  tipCard: {
    padding: spacing.md,
  },
  tipRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
  },
});
