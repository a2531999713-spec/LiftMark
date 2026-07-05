import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import type { ReactNode } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AccountMenuRow, ProfileSummaryCard } from '@/components/account';
import { AppText, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import { resolveDefaultTrainingMember } from '@/domain/member/member-selection';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { getAccountProfileCache, getAvatarDisplay, type AccountProfileCache } from '@/services/avatar';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, spacing } from '@/theme';

function maskPhone(phone?: string) {
  if (!phone) return undefined;
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)} **** ${phone.slice(-4)}`;
}

function membershipLabel(tier: ReturnType<typeof useAuthStore.getState>['membershipTier']) {
  if (tier === 'lifetime') return '永久会员';
  if (tier === 'pro') return '高级会员';
  return '免费版';
}

function syncLabel(authStatus: ReturnType<typeof useAuthStore.getState>['authStatus']) {
  if (authStatus === 'authenticated') return '可手动同步';
  if (authStatus === 'offline_authenticated') return '本机保存';
  if (authStatus === 'unauthenticated') return '未登录';
  return '检查中';
}

export default function ProfileIndexRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authStatus, loadCurrentUser, membershipTier, user } = useAuthStore();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [currentGroup, setCurrentGroup] = useState<Group | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      await loadCurrentUser();
      const latestUser = useAuthStore.getState().user;
      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }
      if (group.id !== selectedGroupId) {
        setSelectedGroupId(group.id);
      }
      const members = await repositories.memberRepository.listMembers(group.id);
      const member = resolveDefaultTrainingMember(members, latestUser?.id);
      const [profile, cachedProfile] = await Promise.all([
        member ? repositories.memberRepository.getMemberProfile(member.id) : Promise.resolve(null),
        latestUser ? getAccountProfileCache(latestUser.id) : Promise.resolve(null),
      ]);

      setCurrentGroup(group);
      setCurrentMember(member);
      setCurrentProfile(profile);
      setAccountProfile(cachedProfile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '账号中心加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentUser, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const displayName =
    accountProfile?.displayName?.trim() ||
    user?.displayName?.trim() ||
    currentMember?.displayName ||
    '练刻用户';
  const avatarDisplay = getAvatarDisplay({
    accountProfile,
    fallbackLocalUri: currentProfile?.avatarLocalUri,
    fallbackThumbUrl: currentProfile?.avatarThumbUrl,
    fallbackUrl: currentProfile?.avatarUrl ?? currentMember?.avatarUrl,
    user,
  });
  const phoneMasked = accountProfile?.phoneMasked ?? maskPhone(user?.phone);
  const version = Constants.expoConfig?.version ?? '0.1.0';

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.textStrong} name="chevron-back" size={25} />
        </Pressable>
        <AppText style={styles.headerTitle} variant="title" weight="900">
          账号中心
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      {error ? (
        <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="资料暂时不可用" />
      ) : null}

      {!isLoading && !error ? (
        <>
          <ProfileSummaryCard
            avatarLocalUri={avatarDisplay.avatarLocalUri}
            avatarThumbUrl={avatarDisplay.avatarThumbUrl}
            avatarUrl={avatarDisplay.avatarUrl}
            displayName={displayName}
            liftmarkId={accountProfile?.liftmarkId ?? user?.liftmarkId}
            membershipLabel={membershipLabel(membershipTier)}
            onAvatarPress={() => router.push('/profile/avatar' as never)}
            onPress={() => router.push('/profile/account' as never)}
            phoneMasked={phoneMasked}
            syncLabel={syncLabel(authStatus)}
          />

          <ProfileGroup title="账号资料">
            <AccountMenuRow icon="image-outline" label="修改头像" onPress={() => router.push('/profile/avatar' as never)} />
            <AccountMenuRow
              icon="person-outline"
              label="修改昵称"
              onPress={() => router.push('/profile/nickname' as never)}
              trailing={displayName}
            />
            <AccountMenuRow icon="id-card-outline" label="账号信息" onPress={() => router.push('/profile/account' as never)} />
          </ProfileGroup>

          <ProfileGroup title="小组与同步">
            <AccountMenuRow
              icon="swap-horizontal-outline"
              label="切换小组"
              onPress={() => router.push('/groups/switch' as never)}
              trailing={currentGroup?.name ?? '未设置'}
            />
            <AccountMenuRow icon="people-outline" label="管理小组与成员" onPress={() => router.push('/groups/manage' as never)} />
            <AccountMenuRow
              icon="cloud-outline"
              label="云同步状态"
              onPress={() => router.push('/sync' as never)}
              trailing={syncLabel(authStatus)}
            />
            <AccountMenuRow icon="server-outline" label="数据备份" onPress={() => router.push('/backup' as never)} />
          </ProfileGroup>

          <ProfileGroup title="偏好与权益">
            <AccountMenuRow icon="barbell-outline" label="训练偏好" onPress={() => router.push('/preferences' as never)} />
            <AccountMenuRow
              icon="diamond-outline"
              label="会员 / 激活码"
              onPress={() => router.push('/profile/membership' as never)}
              trailing={membershipLabel(membershipTier)}
            />
          </ProfileGroup>

          <ProfileGroup title="法务与支持">
            <AccountMenuRow icon="shield-checkmark-outline" label="隐私政策" onPress={() => router.push('/legal/privacy' as never)} />
            <AccountMenuRow icon="document-text-outline" label="用户协议" onPress={() => router.push('/legal/terms' as never)} />
            <AccountMenuRow icon="chatbubble-ellipses-outline" label="反馈与建议" onPress={() => router.push('/feedback' as never)} />
            <AccountMenuRow
              icon="information-circle-outline"
              label="关于练刻"
              onPress={() => router.push('/about' as never)}
              trailing={`版本 ${version}`}
            />
          </ProfileGroup>
        </>
      ) : null}
    </Screen>
  );
}

function ProfileGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.section}>
      <AppText style={styles.sectionTitle} variant="subtitle" weight="900">
        {title}
      </AppText>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    color: colors.textStrong,
  },
  loading: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
  section: {
    gap: spacing.md,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    color: colors.textStrong,
    paddingHorizontal: spacing.xs,
  },
});
