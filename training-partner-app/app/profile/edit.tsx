import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SecondaryPageHeader } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { GroupMember } from '@/domain/member/member.types';
import { getAccountProfileCache, upsertAccountProfileCache, type AccountProfileCache } from '@/services/avatar';
import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { updateDisplayNameAcrossLocalProfiles } from '@/services/profileSyncService';
import { useAuthStore } from '@/store/authStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing, typography } from '@/theme';

export default function ProfileEditRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const { isLoggedIn, loadCurrentUser, updateLocalUser, user } = useAuthStore();
  const [accountProfile, setAccountProfile] = useState<AccountProfileCache | null>(null);
  const [currentMember, setCurrentMember] = useState<GroupMember | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      await loadCurrentUser();
      const latestUser = useAuthStore.getState().user;
      if (!latestUser) {
        setCurrentMember(null);
        setDisplayName('');
        setAccountProfile(null);
        return;
      }

      const groups = await repositories.groupRepository.listGroups();
      const group = groups.find((item) => item.id === selectedGroupId) ?? groups[0] ?? null;
      if (!group) {
        throw new Error('默认小组尚未初始化。');
      }
      if (group.id !== selectedGroupId) {
        setSelectedGroupId(group.id);
      }

      const [members, profile] = await Promise.all([
        repositories.memberRepository.listMembers(group.id),
        getAccountProfileCache(latestUser.id),
      ]);
      const member = members.find((item) => item.userId === latestUser.id) ?? members[0] ?? null;
      const nextName = profile?.displayName?.trim() || latestUser.displayName || member?.displayName || '练刻用户';

      setAccountProfile(profile);
      setCurrentMember(member);
      setDisplayName(nextName);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '我的资料加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentUser, repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const save = useCallback(async () => {
    const name = displayName.trim();
    if (!user) {
      Alert.alert('请先登录', '登录后才能修改账号昵称。');
      return;
    }
    if (name.length < 1) {
      Alert.alert('昵称不能为空', '请输入 1-16 个字的昵称。');
      return;
    }
    if (name.length > 16) {
      Alert.alert('昵称过长', '昵称最多 16 个字。');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const nextUser = { ...user, displayName: name };
      const updatedProfile = await upsertAccountProfileCache({
        avatarLocalUri: accountProfile?.avatarLocalUri,
        avatarThumbUrl: accountProfile?.avatarThumbUrl,
        avatarUpdatedAt: accountProfile?.avatarUpdatedAt,
        avatarUrl: accountProfile?.avatarUrl ?? user.avatarUrl,
        user: nextUser,
      });
      await updateLocalUser({ displayName: name });

      const { updatedMembers } = await updateDisplayNameAcrossLocalProfiles({
        displayName: name,
        fallbackGroupId: currentMember?.groupId,
        fallbackMemberId: currentMember?.id,
        userId: user.id,
      });
      const updatedMember = updatedMembers.find((member) => member.id === currentMember?.id) ?? currentMember;

      // 同步昵称到服务器
      const session = await readStoredSession();
      if (session?.accessToken) {
        try {
          await apiRequest('/auth/me', {
            method: 'PATCH',
            accessToken: session.accessToken,
            body: { nickname: name },
          });
        } catch (syncError) {
          console.warn('昵称同步到服务器失败', syncError);
        }
      }

      await loadCurrentUser();
      setAccountProfile(updatedProfile);
      setCurrentMember(updatedMember);
      setDisplayName(name);
      Alert.alert('已保存', '昵称已更新到账号资料和当前成员。');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '昵称保存失败。');
    } finally {
      setIsSaving(false);
    }
  }, [accountProfile, currentMember, displayName, loadCurrentUser, updateLocalUser, user]);

  return (
    <Screen>
      <SecondaryPageHeader
        caption="我的资料"
        icon="person-circle-outline"
        subtitle="昵称会同步到账号展示和当前小组里的“我”。"
        tag="资料"
        title="编辑昵称"
      />

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void loadProfile()} title="资料暂时不可用" /> : null}

      {!isLoading && !error && (!isLoggedIn || !user) ? (
        <EmptyState
          actionLabel="去登录"
          description="登录后可以编辑账号昵称。"
          onActionPress={() => router.replace('/account/login' as never)}
          title="当前未登录"
        />
      ) : null}

      {!isLoading && !error && isLoggedIn && user ? (
        <>
          <AppCard style={styles.card}>
            <View style={styles.fieldHeader}>
              <View style={styles.fieldIcon}>
                <Ionicons color={colors.primary} name="person-outline" size={18} />
              </View>
              <View style={styles.fieldTitle}>
                <AppText variant="bodySmall" weight="900">
                  昵称
                </AppText>
                <AppText tone="muted" variant="caption">
                  我的页面、成员列表和训练页都会使用这个名称。
                </AppText>
              </View>
            </View>
            <TextInput
              maxLength={16}
              onChangeText={setDisplayName}
              placeholder="练刻用户"
              placeholderTextColor={colors.textSubtle}
              style={styles.input}
              value={displayName}
            />
          </AppCard>

          <View style={styles.actions}>
            <AppButton disabled={isSaving} icon="save-outline" onPress={() => void save()} size="lg">
              {isSaving ? '保存中...' : '保存昵称'}
            </AppButton>
            <AppButton onPress={() => router.back()} variant="secondary">
              返回
            </AppButton>
          </View>
        </>
      ) : null}
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
  fieldHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  fieldIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fieldTitle: {
    flex: 1,
    gap: 2,
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.sizes.body,
    fontWeight: '900',
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
});
