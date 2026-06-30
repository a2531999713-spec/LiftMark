import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { LogoutButton, ProfileMenuItem, ProfileSection } from '@/components/profile';
import { AppText, Screen } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';
import { colors, radius, spacing } from '@/theme';

export default function AccountSettingsRoute() {
  const { isLoading, logout } = useAuthStore();

  const confirmLogout = useCallback(() => {
    Alert.alert('确认退出登录？', '退出后将无法使用账号相关功能，但本机训练记录不会被删除。', [
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

  return (
    <Screen safeTop={false}>
      <ProfileSection icon="shield-checkmark-outline" title="安全与权益">
        <ProfileMenuItem
          description="手机号、密码、登录设备"
          icon="lock-closed-outline"
          label="账号安全"
          onPress={() => router.push('/account/security' as never)}
        />
        <ProfileMenuItem
          description="会员权益、激活码"
          icon="diamond-outline"
          label="会员与激活"
          onPress={() => router.push('/profile/membership' as never)}
        />
      </ProfileSection>
      <View style={styles.logoutPanel}>
        <View style={styles.logoutText}>
          <AppText variant="bodySmall" weight="900">
            退出当前账号
          </AppText>
          <AppText tone="muted" variant="caption">
            仅退出账号登录状态，本机训练记录会保留。
          </AppText>
        </View>
        <LogoutButton disabled={isLoading} onPress={confirmLogout} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logoutPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  logoutText: {
    gap: spacing.xs,
  },
});
