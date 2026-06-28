import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { EmptyState, Screen } from '@/components/ui';
import { LogoutButton, ProfileHeroCard, ProfileMenuItem } from '@/components/profile';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import {
  getAccountProfileCache,
  getAvatarDisplay,
  updateAccountAvatarFromPicker,
  type AccountProfileCache,
} from '@/services/avatar';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function SettingsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { isLoading: isAuthLoading, loadCurrentUser, logout, user } = useAuthStore();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesByMemberId, setProfilesByMemberId] = useState<Record<string, MemberProfile | null>>({});
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMember = members[0] ?? null;
  const currentProfile = currentMember ? (profilesByMemberId[currentMember.id] ?? null) : null;
  const avatarDisplay = getAvatarDisplay({
    accountProfile,
    fallbackLocalUri: currentProfile?.avatarLocalUri,
    fallbackThumbUrl: currentProfile?.avatarThumbUrl,
    fallbackUrl: currentProfile?.avatarUrl ?? currentMember?.avatarUrl,
    user,
  });

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      await loadCurrentUser();
      const latestUser = useAuthStore.getState().user;
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const [nextMembers, nextPlan, nextAccountProfile] = await Promise.all([
        repositories.memberRepository.listMembers(nextGroup.id),
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
        latestUser ? getAccountProfileCache(latestUser.id) : Promise.resolve(null),
      ]);
      const profiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );

      setGroup(nextGroup);
      setMembers(nextMembers);
      setActivePlan(nextPlan);
      setAccountProfile(nextAccountProfile);
      setProfilesByMemberId(Object.fromEntries(profiles));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '我的页面加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentUser, repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const confirmLogout = useCallback(() => {
    Alert.alert('确定退出当前账号？', '退出后需要重新登录才能使用账号相关功能。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: () => {
          void logout();
        },
      },
    ]);
  }, [logout]);

  const pickAvatar = useCallback(async () => {
    if (!user) return;
    const result = await updateAccountAvatarFromPicker(user, 'library');
    if (result.ok) {
      setAccountProfile(result.profile);
    }
  }, [user]);

  return (
    <Screen contentStyle={styles.screen}>
      {isLoading || isAuthLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? (
        <EmptyState
          actionLabel="重新加载"
          description={error}
          onActionPress={() => void loadProfile()}
          title="数据加载失败"
        />
      ) : null}

      {!isLoading && !error ? (
        <>
          <ProfileHeroCard
            avatarLocalUri={avatarDisplay.avatarLocalUri}
            avatarThumbUrl={avatarDisplay.avatarThumbUrl}
            avatarUrl={avatarDisplay.avatarUrl}
            currentPlanName={activePlan?.name}
            group={group}
            memberCount={members.length}
            onAvatarPress={() => void pickAvatar()}
            onGroupPress={() => router.push('/profile/groups' as never)}
            onPlanPress={() => router.push('/(tabs)/plan' as never)}
            onPress={() => router.push('/account' as never)}
            phoneMasked={accountProfile?.phoneMasked}
            user={user}
          />

          <View style={styles.menuGroup}>
            <ProfileMenuItem
              description="体重、力量记录、加重单位"
              icon="person-outline"
              label="训练档案"
              onPress={() => router.push('/profile/training-identity' as never)}
            />
            <ProfileMenuItem
              description="管理训练成员和角色"
              icon="people-outline"
              label="小组成员"
              onPress={() => router.push('/profile/groups' as never)}
            />
            <ProfileMenuItem
              description="单位、记录方式、休息计时"
              icon="settings-outline"
              label="偏好设置"
              onPress={() => router.push('/profile/preferences' as never)}
            />
            <ProfileMenuItem
              description="安全、同步、会员"
              icon="shield-checkmark-outline"
              label="账号设置"
              onPress={() => router.push('/account/settings' as never)}
            />
          </View>

          <View style={styles.singleGroup}>
            <ProfileMenuItem
              description="关于练刻、意见反馈、协议"
              icon="information-circle-outline"
              label="关于练刻"
              onPress={() => router.push('/about' as never)}
            />
          </View>

          <LogoutButton disabled={isAuthLoading} onPress={confirmLogout} />
        </>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  singleGroup: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
