import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText, EmptyState, Screen } from '@/components/ui';
import { ProfileHeroCard, ProfileMenuItem, ProfileSection } from '@/components/profile';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import {
  getAccountProfileCache,
  getAvatarDisplay,
  type AccountProfileCache,
} from '@/services/avatar';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

export default function SettingsRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authStatus, isLoading: isAuthLoading, loadCurrentUser, membershipTier, user } = useAuthStore();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profilesByMemberId, setProfilesByMemberId] = useState<Record<string, MemberProfile | null>>({});
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentMember = members.find((member) => member.userId === user?.id) ?? members[0] ?? null;
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
      const groups = await repositories.groupRepository.listGroups();
      const nextGroup = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }
      if (nextGroup.id !== selectedGroupId) {
        setSelectedGroupId(nextGroup.id);
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
  }, [loadCurrentUser, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

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
            onAvatarPress={() => router.push('/profile' as never)}
            onGroupPress={() => router.push('/profile/groups' as never)}
            onPlanPress={() => router.push('/(tabs)/plan' as never)}
            onPress={() => router.push('/profile' as never)}
            phoneMasked={accountProfile?.phoneMasked}
            user={user}
          />

          <View style={styles.quickGrid}>
            <QuickActionTile
              icon="cloud-upload-outline"
              label="云同步"
              meta={authStatus === 'offline_authenticated' ? '离线可用' : '查看状态'}
              onPress={() => router.push('/profile/sync' as never)}
            />
            <QuickActionTile
              icon="sparkles-outline"
              label="会员 / 激活码"
              meta={membershipTier === 'free' ? 'Free' : membershipTier.toUpperCase()}
              onPress={() => router.push('/profile/membership' as never)}
            />
            <QuickActionTile
              icon="archive-outline"
              label="数据备份"
              meta="本地与云端"
              onPress={() => router.push('/profile/data' as never)}
            />
            <QuickActionTile
              icon="options-outline"
              label="训练偏好"
              meta="单位和计时"
              onPress={() => router.push('/profile/preferences' as never)}
            />
          </View>

          <ProfileSection icon="barbell-outline" title="训练设置">
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
          </ProfileSection>

          <ProfileSection icon="shield-checkmark-outline" title="数据与隐私">
            <ProfileMenuItem
              description="体重、体脂和围度趋势"
              icon="body-outline"
              label="身体数据"
              onPress={() => router.push('/profile/body-metrics' as never)}
            />
            <ProfileMenuItem
              description="上传、拉取、队列和头像 URL"
              icon="cloud-upload-outline"
              label="同步诊断"
              onPress={() => router.push('/profile/sync' as never)}
            />
            <ProfileMenuItem
              description="导出、备份和本地数据管理"
              icon="archive-outline"
              label="本地数据备份"
              onPress={() => router.push('/profile/data' as never)}
            />
            <ProfileMenuItem
              description="隐私协议、用户协议"
              icon="lock-closed-outline"
              label="隐私与协议"
              onPress={() => router.push('/profile/privacy' as never)}
            />
          </ProfileSection>

          <ProfileSection icon="information-circle-outline" title="关于">
            <ProfileMenuItem
              description="安全、登录和退出"
              icon="shield-checkmark-outline"
              label="账号设置"
              onPress={() => router.push('/account/settings' as never)}
            />
            <ProfileMenuItem
              description="关于练刻、意见反馈、协议"
              icon="information-circle-outline"
              label="关于练刻"
              onPress={() => router.push('/about' as never)}
            />
          </ProfileSection>

        </>
      ) : null}

    </Screen>
  );
}

function QuickActionTile({
  icon,
  label,
  meta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickTile, pressed && styles.pressed]}>
      <View style={styles.quickIcon}>
        <Ionicons color={colors.primary} name={icon} size={20} />
      </View>
      <View style={styles.quickText}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {label}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {meta}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  quickText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  quickTile: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexBasis: '47%',
    flexDirection: 'row',
    flexGrow: 1,
    gap: spacing.sm,
    minHeight: 76,
    padding: spacing.md,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
});
