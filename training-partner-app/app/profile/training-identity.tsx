import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { Avatar } from '@/components/avatar';
import { AppButton, AppCard, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, spacing } from '@/theme';

function formatKg(value?: number) {
  return value ? `${value} kg` : '未设置';
}

export default function TrainingIdentityRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [member, setMember] = useState<GroupMember | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!group) throw new Error('默认小组尚未初始化。');
      if (group.id !== selectedGroupId) {
        setSelectedGroupId(group.id);
      }
      const members = await repositories.memberRepository.listMembers(group.id);
      const current = members[0] ?? null;
      setMember(current);
      setProfile(current ? await repositories.memberRepository.getMemberProfile(current.id) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练档案加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen safeTop={false}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error && !member ? (
        <EmptyState
          actionLabel="创建训练档案"
          description="创建训练档案后，可以计算建议重量并记录训练。"
          onActionPress={() => {
            if (guardFeature('add_member', { memberCount: 0 })) router.push('/member/new' as never);
          }}
          title="还没有训练档案"
        />
      ) : null}

      {!isLoading && !error && member ? (
        <>
          <AppCard style={styles.identityCard} tone="dark">
            <Avatar
              avatarLocalUri={profile?.avatarLocalUri}
              avatarThumbUrl={profile?.avatarThumbUrl}
              avatarUrl={profile?.avatarUrl ?? member.avatarUrl}
              name={member.displayName}
              size={58}
            />
            <View style={styles.identityText}>
              <AppText tone="inverse" variant="title" weight="900">
                {member.displayName}的训练档案
              </AppText>
              <Tag label={member.role === 'owner' ? '组长' : '成员'} tone="dark" />
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <SettingsRow label="体重" value={formatKg(profile?.bodyweight)} />
            <SettingsRow label="深蹲 1RM" value={formatKg(profile?.squat1RM)} />
            <SettingsRow label="卧推 1RM" value={formatKg(profile?.bench1RM)} />
            <SettingsRow label="硬拉 1RM" value={formatKg(profile?.deadlift1RM)} />
            <SettingsRow label="推举 1RM" value={formatKg(profile?.overheadPress1RM)} />
            <SettingsRow label="杠铃加重单位" value={`${profile?.barbellIncrement ?? 2.5} kg`} />
            <SettingsRow label="哑铃加重单位" value={`${profile?.dumbbellIncrement ?? 2.5} kg`} />
          </AppCard>

          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) {
                  router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } });
                }
              }}
            >
              编辑档案
            </AppButton>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) router.push('/settings/members' as never);
              }}
              variant="secondary"
            >
              切换成员
            </AppButton>
          </View>
        </>
      ) : null}

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  identityCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  identityText: {
    flex: 1,
    gap: spacing.sm,
  },
});
