import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, GroupMemberRole } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

function roleLabel(role: GroupMemberRole) {
  if (role === 'owner') return '组长';
  if (role === 'coach') return '教练';
  if (role === 'guest') return '访客';
  return '成员';
}

export default function ProfileGroupsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
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
      setError(loadError instanceof Error ? loadError.message : '小组成员加载失败。');
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

  return (
    <Screen subtitle="管理训练成员和角色。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="数据加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.card}>
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <AppText numberOfLines={1} variant="title" weight="900">
                  {group?.name ?? '默认训练小组'}
                </AppText>
                <AppText tone="muted" variant="bodySmall">
                  {members.length} 名成员
                </AppText>
              </View>
            </View>
            <SettingsRow label="当前计划" value={plan?.name ?? '未设置'} />
            <SettingsRow label="当前周次" value={`第 ${group?.currentWeek ?? 1} 周`} />
            <SettingsRow label="我的角色" value={members[0] ? roleLabel(members[0].role) : '未设置'} />
          </AppCard>

          <AppCard style={styles.memberCard}>
            <AppText variant="bodySmall" weight="900">
              成员列表
            </AppText>
            {members.map((member) => (
              <SettingsRow key={member.id} label={member.displayName} value={roleLabel(member.role)} />
            ))}
            {members.length === 0 ? (
              <AppText tone="muted" variant="bodySmall">
                还没有成员，添加后可为不同训练者分别记录重量和计划表现。
              </AppText>
            ) : null}
          </AppCard>

          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) router.push('/settings/members' as never);
              }}
            >
              管理成员
            </AppButton>
            <AppButton onPress={() => showDeveloping('切换小组')} variant="secondary">
              切换小组
            </AppButton>
            <AppButton
              onPress={() => {
                if (guardFeature('create_group', { groupCount: group ? 1 : 0 })) showDeveloping('创建小组');
              }}
              variant="secondary"
            >
              创建小组
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
  card: {
    gap: spacing.md,
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  memberCard: {
    gap: spacing.sm,
  },
});
