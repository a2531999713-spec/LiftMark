import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SettingsRow } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, GroupMemberRole } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
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
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [plan, setPlan] = useState<PlanTemplate | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isCreateVisible, setCreateVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (preferredGroupId?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const nextGroups = await repositories.groupRepository.listGroups();
      const fallbackGroup = nextGroups[0] ?? null;
      const nextGroup =
        nextGroups.find((item) => item.id === (preferredGroupId ?? selectedGroupId)) ?? fallbackGroup;
      if (!nextGroup) throw new Error('默认小组尚未初始化。');
      const [nextMembers, nextPlan] = await Promise.all([
        repositories.memberRepository.listMembers(nextGroup.id),
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
      ]);
      if (!selectedGroupId || selectedGroupId !== nextGroup.id) {
        setSelectedGroupId(nextGroup.id);
      }
      setGroup(nextGroup);
      setGroups(nextGroups);
      setMembers(nextMembers);
      setPlan(nextPlan);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '小组成员加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const createGroup = async () => {
    if (!group) return;
    const name = newGroupName.trim();
    if (!name) {
      setNotice({ title: '小组名称不能为空', message: '请输入 2-12 个字的小组名称。' });
      return;
    }

    try {
      const created = await repositories.groupRepository.createGroup({
        activePlanId: group.activePlanId,
        currentPhaseType: group.currentPhaseType,
        currentWeek: group.currentWeek,
        fridayEnabled: group.fridayEnabled,
        fridayStrategy: group.fridayStrategy,
        name,
      });
      setNewGroupName('');
      setCreateVisible(false);
      setSelectedGroupId(created.id);
      await load(created.id);
    } catch (createError) {
      setNotice({
        title: '创建小组失败',
        message: createError instanceof Error ? createError.message : '请稍后重试。',
      });
    }
  };

  return (
    <Screen safeTop={false}>
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
            <View style={styles.headerRow}>
              <AppText variant="bodySmall" weight="900">
                当前小组成员
              </AppText>
              <AppText tone="muted" variant="caption">
                {group?.name}
              </AppText>
            </View>
            {members.map((member) => (
              <SettingsRow key={member.id} label={member.displayName} value={roleLabel(member.role)} />
            ))}
            {members.length === 0 ? (
              <AppText tone="muted" variant="bodySmall">
                还没有成员，添加后可为不同训练者分别记录重量和计划表现。
              </AppText>
            ) : null}
          </AppCard>

          <AppCard style={styles.memberCard}>
            <AppText variant="bodySmall" weight="900">
              切换小组
            </AppText>
            {groups.map((item) => (
              <Pressable
                accessibilityRole="button"
                key={item.id}
                onPress={() => {
                  setSelectedGroupId(item.id);
                  void load(item.id);
                }}
                style={({ pressed }) => [
                  styles.groupRow,
                  item.id === group?.id && styles.groupRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.headerText}>
                  <AppText numberOfLines={1} variant="bodySmall" weight="900">
                    {item.name}
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    第 {item.currentWeek} 周 · {item.activePlanId === group?.activePlanId ? '当前计划一致' : '独立计划'}
                  </AppText>
                </View>
                <AppText tone={item.id === group?.id ? 'brand' : 'muted'} variant="caption" weight="900">
                  {item.id === group?.id ? '当前' : '切换'}
                </AppText>
              </Pressable>
            ))}
          </AppCard>

          <View style={styles.actions}>
            <AppButton
              onPress={() => {
                if (guardFeature('start_workout')) router.push('/settings/members' as never);
              }}
            >
              管理成员
            </AppButton>
            <AppButton
              onPress={() => {
                if (guardFeature('create_group', { groupCount: groups.length })) setCreateVisible(true);
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

      <AppModalSheet
        onClose={() => setCreateVisible(false)}
        position="center"
        subtitle="新小组会沿用当前计划指针，但成员和训练记录从空开始。"
        title="创建新小组"
        visible={isCreateVisible}
      >
        <TextInput
          autoFocus
          onChangeText={setNewGroupName}
          placeholder="例如：周末训练组"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          value={newGroupName}
        />
        <View style={styles.modalActions}>
          <AppButton onPress={() => setCreateVisible(false)} variant="secondary">
            取消
          </AppButton>
          <AppButton onPress={() => void createGroup()}>创建并切换</AppButton>
        </View>
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
  groupRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  groupRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
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
  input: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    color: colors.text,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
});
