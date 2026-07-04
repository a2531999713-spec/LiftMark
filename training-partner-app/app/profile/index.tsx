import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { EditableAvatar } from '@/components/avatar';
import { LogoutButton, ProfileMenuItem, ProfileSection } from '@/components/profile';
import { AppCard, AppText, EmptyState, Screen, SecondaryPageHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { getAccountProfileCache, getAvatarDisplay, type AccountProfileCache } from '@/services/avatar';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, spacing } from '@/theme';

function maskPhone(phone?: string) {
  if (!phone) return '未绑定手机号';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

export default function ProfileCenterRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const { authStatus, isLoading: isAuthLoading, isLoggedIn, loadCurrentUser, logout, membershipTier, user } = useAuthStore();
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const avatarDisplay = getAvatarDisplay({
    accountProfile,
    fallbackLocalUri: currentProfile?.avatarLocalUri,
    fallbackThumbUrl: currentProfile?.avatarThumbUrl,
    fallbackUrl: currentProfile?.avatarUrl ?? currentMember?.avatarUrl,
    user,
  });

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      await loadCurrentUser();
      const latestUser = useAuthStore.getState().user;
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (group && group.id !== selectedGroupId) {
        setSelectedGroupId(group.id);
      }

      const members = group ? await repositories.memberRepository.listMembers(group.id) : [];
      const member = members.find((item) => item.userId === latestUser?.id) ?? members[0] ?? null;
      setCurrentMember(member);
      setCurrentProfile(member ? await repositories.memberRepository.getMemberProfile(member.id) : null);
      setAccountProfile(latestUser ? await getAccountProfileCache(latestUser.id) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '个人资料加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentUser, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const handleLogout = useCallback(() => {
    Alert.alert('退出登录？', '退出不会删除本机训练数据。', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出登录',
        style: 'destructive',
        onPress: () => {
          void logout().then(() => router.replace('/account/login' as never));
        },
      },
    ]);
  }, [logout]);

  const displayName = accountProfile?.displayName?.trim() || user?.displayName || currentMember?.displayName || '练刻用户';
  const phone = accountProfile?.phoneMasked ?? maskPhone(user?.phone);
  const syncLabel = authStatus === 'offline_authenticated' ? '离线可用' : isLoggedIn ? '云同步可用' : '未登录';
  const membershipLabel = membershipTier === 'free' ? 'Free' : membershipTier.toUpperCase();

  return (
    <Screen contentStyle={styles.screen} safeTop={false}>
      <SecondaryPageHeader
        caption="个人资料中心"
        icon="person-circle-outline"
        subtitle="头像、昵称、账号安全和同步状态集中管理。"
        title="我的资料"
      />

      {isLoading || isAuthLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="资料暂时不可用" description={error} actionLabel="重新加载" onActionPress={() => void load()} /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.identityCard}>
            <EditableAvatar
              avatarLocalUri={avatarDisplay.avatarLocalUri}
              avatarThumbUrl={avatarDisplay.avatarThumbUrl}
              avatarUrl={avatarDisplay.avatarUrl}
              name={displayName}
              onPress={() => router.push('/profile/avatar' as never)}
              size={84}
            />
            <View style={styles.identityText}>
              <AppText numberOfLines={1} variant="title" weight="900">
                {displayName}
              </AppText>
              <AppText numberOfLines={1} tone="muted" variant="bodySmall">
                {phone}
              </AppText>
              <View style={styles.tagRow}>
                <Tag label={`会员 ${membershipLabel}`} tone={membershipTier === 'free' ? 'neutral' : 'brand'} />
                <Tag label={syncLabel} tone={isLoggedIn ? 'success' : 'warning'} />
              </View>
            </View>
          </AppCard>

          <ProfileSection icon="person-outline" title="账号资料">
            <ProfileMenuItem
              description="更换账号头像，并同步到训练成员头像"
              icon="image-outline"
              label="修改头像"
              onPress={() => router.push('/profile/avatar' as never)}
            />
            <ProfileMenuItem
              description="同步到我的页、成员列表和训练页"
              icon="create-outline"
              label="修改昵称"
              trailing={displayName}
              onPress={() => router.push('/profile/edit' as never)}
            />
            <ProfileMenuItem
              description="登录手机号和账号标识"
              icon="call-outline"
              label="账号信息"
              trailing={phone}
              onPress={() => router.push('/account/settings' as never)}
            />
          </ProfileSection>

          <ProfileSection icon="cloud-upload-outline" title="同步与权益">
            <ProfileMenuItem
              description="查看上传、拉取、队列和头像 URL"
              icon="cloud-upload-outline"
              label="云同步状态"
              tag={syncLabel}
              onPress={() => router.push('/profile/sync' as never)}
            />
            <ProfileMenuItem
              description="会员状态、激活码和权益"
              icon="sparkles-outline"
              label="会员 / 激活码"
              tag={membershipLabel}
              onPress={() => router.push('/profile/membership' as never)}
            />
          </ProfileSection>

          <ProfileSection icon="shield-checkmark-outline" title="安全">
            <ProfileMenuItem
              description="登录安全和账号设置"
              icon="shield-checkmark-outline"
              label="账号安全"
              onPress={() => router.push('/account/settings' as never)}
            />
          </ProfileSection>

          <LogoutButton disabled={isAuthLoading} onPress={handleLogout} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identityCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  identityText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
});
