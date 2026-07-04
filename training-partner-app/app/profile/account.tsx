import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, SettingsRow } from '@/components/ui';
import { getAccountProfileCache, type AccountProfileCache } from '@/services/avatar';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

function maskPhone(phone?: string) {
  if (!phone) return '未设置';
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)} **** ${phone.slice(-4)}`;
}

export default function ProfileAccountRoute() {
  const { loadCurrentUser, user } = useAuthStore();
  const [profile, setProfile] = useState<AccountProfileCache | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await loadCurrentUser();
      const latestUser = useAuthStore.getState().user;
      setProfile(latestUser ? await getAccountProfileCache(latestUser.id) : null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '账号信息加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [loadCurrentUser]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.textStrong} name="chevron-back" size={25} />
        </Pressable>
        <AppText style={styles.headerTitle} variant="title" weight="900">
          账号信息
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="账号信息不可用" /> : null}

      {!isLoading && !error ? (
        <>
          <AppCard style={styles.card}>
            <SettingsRow label="昵称" value={profile?.displayName ?? user?.displayName ?? '未设置'} />
            <SettingsRow label="手机号" value={profile?.phoneMasked ?? maskPhone(user?.phone)} />
            <SettingsRow label="LiftMark ID" value={profile?.liftmarkId ?? user?.liftmarkId ?? '未设置'} />
            <SettingsRow label="登录方式" value={user?.phone ? '手机号账号' : '本机账号'} />
            <SettingsRow label="资料更新时间" value={profile?.updatedAt ? profile.updatedAt.slice(0, 10) : '未同步'} />
          </AppCard>

          <AppCard style={styles.card} tone="soft">
            <AppText variant="bodySmall" weight="900">
              账号资料说明
            </AppText>
            <AppText tone="muted" variant="caption">
              当前页面只展示本机已缓存的账号字段。正式云端资料同步完成后，会在这里补充注册时间、绑定状态和更多安全信息。
            </AppText>
          </AppCard>

          <AppCard style={styles.card}>
            <SettingsRow label="App 版本" value={Constants.expoConfig?.version ?? '0.1.0'} />
            <SettingsRow label="Android package" value="com.liftmark.app" />
          </AppCard>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  card: {
    gap: spacing.md,
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
  screen: {
    gap: spacing.lg,
    paddingBottom: spacing.xxxxl,
  },
});
