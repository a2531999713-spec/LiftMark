import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { EditableAvatar } from '@/components/avatar';
import { AppModalSheet, AppText, EmptyState, Screen, SecondaryPageHeader } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import {
  deleteAccountAvatar,
  getAccountProfileCache,
  getAvatarDisplay,
  updateAccountAvatarFromPicker,
  type AccountProfileCache,
} from '@/services/avatar';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function AvatarRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { isLoggedIn, loadCurrentUser, user } = useAuthStore();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MemberProfile | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
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
      const member = members[0] ?? null;
      setCurrentMember(member);
      setCurrentProfile(member ? await repositories.memberRepository.getMemberProfile(member.id) : null);
      setAccountProfile(latestUser ? await getAccountProfileCache(latestUser.id) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '头像资料加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentUser, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const pickAvatar = async () => {
    if (!user || isWorking) return;
    setIsWorking(true);
    const result = await updateAccountAvatarFromPicker(user, 'library');
    setIsWorking(false);
    if (!result.ok) {
      setNotice({ title: '头像未更新', message: result.message });
      return;
    }
    setAccountProfile(result.profile);
    if (currentMember) {
      const nextProfile = await repositories.memberRepository.updateProfile(currentMember.id, {
        avatarLocalUri: result.profile.avatarLocalUri,
        avatarThumbUrl: result.profile.avatarThumbUrl,
        avatarUpdatedAt: result.profile.avatarUpdatedAt,
        avatarUrl: result.profile.avatarUrl,
      });
      setCurrentProfile(nextProfile);
    }
    setNotice({ title: '头像已更新', message: '头像已保存并上传。' });
  };

  const removeAvatar = async () => {
    if (!user) return;
    setIsWorking(true);
    const profile = await deleteAccountAvatar(user);
    setIsWorking(false);
    setAccountProfile(profile);
    if (currentMember) {
      const nextProfile = await repositories.memberRepository.updateProfile(currentMember.id, {
        avatarLocalUri: undefined,
        avatarThumbUrl: undefined,
        avatarUpdatedAt: profile.avatarUpdatedAt,
        avatarUrl: undefined,
      });
      setCurrentProfile(nextProfile);
    }
    setNotice({ title: '头像已删除', message: '账号头像已清空。' });
  };

  return (
    <Screen contentStyle={styles.screen}>
      <SecondaryPageHeader
        avatarUri={avatarDisplay.avatarLocalUri ?? avatarDisplay.avatarThumbUrl ?? avatarDisplay.avatarUrl}
        caption="头像"
        subtitle="账号头像会同步到当前小组训练成员，训练中和记录页保持一致。"
        title={user?.displayName ?? '练刻用户'}
      />
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? (
        <EmptyState title="加载失败" description={error} actionLabel="重新加载" onActionPress={() => void load()} />
      ) : null}

      {!isLoading && !error && (!isLoggedIn || !user) ? (
        <EmptyState
          actionLabel="登录"
          description="登录后可以设置头像。"
          onActionPress={() => router.push('/account/login' as never)}
          title="未登录"
        />
      ) : null}

      {!isLoading && !error && isLoggedIn && user ? (
        <View style={styles.content}>
          <View style={styles.avatarWrap}>
            <EditableAvatar
              avatarLocalUri={avatarDisplay.avatarLocalUri}
              avatarThumbUrl={avatarDisplay.avatarThumbUrl}
              avatarUrl={avatarDisplay.avatarUrl}
              name={user.displayName}
              onPress={() => void pickAvatar()}
              size={120}
            />
            {isWorking ? (
              <View style={styles.workingOverlay}>
                <ActivityIndicator color={colors.surface} />
              </View>
            ) : null}
          </View>

          <AppText variant="body" tone="muted" style={styles.hint}>
            点击头像从相册选择
          </AppText>

          {accountProfile?.avatarUrl || accountProfile?.avatarLocalUri ? (
            <Pressable onPress={() => void removeAvatar()} style={styles.removeBtn}>
              <AppText variant="bodySmall" tone="danger">删除头像</AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <Pressable onPress={() => setNotice(null)} style={styles.modalBtn}>
          <AppText variant="subtitle" weight="700" style={styles.modalBtnText}>知道了</AppText>
        </Pressable>
      </AppModalSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: {
    alignSelf: 'center',
    position: 'relative',
  },
  content: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xxl,
  },
  hint: {
    textAlign: 'center',
  },
  modalBtn: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    width: '100%',
  },
  modalBtnText: {
    color: colors.surface,
  },
  removeBtn: {
    paddingVertical: spacing.sm,
  },
  screen: {
    paddingBottom: spacing.xxxxl,
  },
  workingOverlay: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    borderRadius: 60,
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
