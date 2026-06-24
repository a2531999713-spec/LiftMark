import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { colors, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ProfileGroupsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [plan, setPlan] = useState<PlanTemplate | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) throw new Error('默认小组尚未初始化。');
      const [nextMembers, nextPlan] = await Promise.all([
        repositories.memberRepository.listMembers(nextGroup.id),
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
      ]);
      setGroup(nextGroup);
      setMembers(nextMembers);
      setPlan(nextPlan);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '小组加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const showDeveloping = (title: string) => setNotice({ title, message: '该功能正在开发中，后续版本开放。' });
  const showInvitePending = () =>
    setNotice({
      title: '邀请成员',
      message: '当前版本暂未开放云端邀请，后续版本支持在线加入小组。',
    });

  return (
    <Screen title="我的小组" subtitle="成员管理、权限设置、邀请管理。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.card}>
            <View style={styles.headerRow}>
              <View>
                <AppText variant="title" weight="900">
                  {group?.name ?? '还没有训练小组'}
                </AppText>
                <AppText tone="muted" variant="bodySmall">
                  {members.length} 成员
                </AppText>
              </View>
              <Tag label="本地小组" tone="neutral" />
            </View>
            <SettingsRow label="当前计划" value={plan?.name ?? '未设置'} />
            <SettingsRow label="我的角色" value={members[0]?.role === 'owner' ? '组长' : '成员'} />
          </AppCard>

          <View style={styles.actions}>
            <AppButton onPress={() => router.push('/settings/members' as never)}>管理成员</AppButton>
            <AppButton onPress={() => showDeveloping('创建小组')} variant="secondary">
              创建小组
            </AppButton>
            <AppButton onPress={() => showDeveloping('加入小组')} variant="secondary">
              加入小组
            </AppButton>
            <AppButton onPress={showInvitePending} variant="secondary">
              邀请成员
            </AppButton>
          </View>

          <AppCard style={styles.card} tone="soft">
            <AppText variant="bodySmall" weight="900">
              当前版本为本地小组
            </AppText>
            <AppText tone="muted" variant="caption">
              适合同一台设备多人轮换记录。未来云同步版本再支持账号登录、邀请成员、多设备同步和授权共享数据。
            </AppText>
          </AppCard>
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

const styles = StyleSheet.create({
  actions: {
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
});
