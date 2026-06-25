import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

function formatKg(value?: number) {
  return value ? `${value} kg` : '未设置';
}

export default function TrainingIdentityRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [member, setMember] = useState<GroupMember | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const group = await repositories.groupRepository.getDefaultGroup();
      if (!group) throw new Error('默认小组尚未初始化。');
      const members = await repositories.memberRepository.listMembers(group.id);
      const current = members[0] ?? null;
      setMember(current);
      setProfile(current ? await repositories.memberRepository.getMemberProfile(current.id) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练身份加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen title="我的训练身份" subtitle="账号 user 和训练成员 member 分开管理。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error && !member ? (
        <EmptyState
          actionLabel="创建训练身份"
          description="创建训练身份后，可以计算建议重量并记录训练。"
          onActionPress={() => {
            if (guardFeature('add_member', { memberCount: 0 })) router.push('/member/new' as never);
          }}
          title="还没有训练身份"
        />
      ) : null}

      {!isLoading && !error && member ? (
        <>
          <AppCard style={styles.identityCard} tone="dark">
            <View style={styles.avatar}>
              <AppText tone="inverse" variant="title" weight="900">
                {member.displayName.slice(0, 1)}
              </AppText>
            </View>
            <View style={styles.identityText}>
              <AppText tone="inverse" variant="title" weight="900">
                当前成员：{member.displayName}
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
            <SettingsRow label="哑铃加重单位" value={`${profile?.dumbbellIncrement ?? 2} kg`} />
          </AppCard>

          <AppCard style={styles.card} tone="soft">
            <AppText variant="bodySmall" weight="900">
              账号 user 和训练成员 member 必须区分
            </AppText>
            <AppText tone="muted" variant="caption">
              账号用于登录、会员、同步、权限和恢复。成员用于 1RM、训练记录、建议重量和计划执行。
            </AppText>
          </AppCard>

          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) {
                  router.push({ pathname: '/member/[memberId]', params: { memberId: member.id } });
                }
              }}
            >
              编辑训练档案
            </AppButton>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) router.push('/settings/members' as never);
              }}
              variant="secondary"
            >
              切换当前成员
            </AppButton>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) {
                  setNotice({ title: '认领本机成员', message: '该功能正在开发中，后续版本开放。' });
                }
              }}
              variant="secondary"
            >
              认领本机成员
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

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 58,
    justifyContent: 'center',
    width: 58,
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
