import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { spacing } from '@/theme';

export default function AccountRoute() {
  const { isLoggedIn, loadCurrentUser, user } = useAuthStore();

  useFocusEffect(
    useCallback(() => {
      void loadCurrentUser();
    }, [loadCurrentUser]),
  );

  return (
    <Screen safeTop={false}>
      {!isLoggedIn || !user ? (
        <EmptyState
          actionLabel="登录 / 注册"
          description="登录后可以管理账号资料和会员状态。未登录仍可查看公开协议页面。"
          onActionPress={() => router.push('/account/login' as never)}
          title="当前未登录"
        />
      ) : (
        <>
          <AppCard style={styles.card}>
            <Tag label="已登录" tone="success" />
            <AppText variant="title" weight="900">
              {user.displayName}
            </AppText>
            <SettingsRow label="练刻 ID" value={user.liftmarkId} />
            <SettingsRow label="手机号" value={user.phone ?? '未绑定'} />
            <SettingsRow label="邮箱" value={user.email ?? '未绑定'} />
          </AppCard>
          <AppButton onPress={() => router.push('/account/security' as never)} variant="secondary">
            账号安全
          </AppButton>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
});
