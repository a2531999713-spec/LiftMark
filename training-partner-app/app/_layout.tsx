import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { initializeLocalDatabase } from '@/data/local';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function RootLayout() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const segments = useSegments();

  useEffect(() => {
    async function boot() {
      if (Platform.OS !== 'web') {
        await initializeLocalDatabase();
      } else {
        console.warn('Web 暂不作为第一阶段验收目标，跳过 native SQLite 初始化。');
      }
      await useAuthStore.getState().loadCurrentUser();
    }
    void boot().catch((error) => {
      console.error('启动初始化失败', error);
    });
  }, []);

  useEffect(() => {
    if (authStatus === 'checking') return;

    const isLoginRoute = segments[0] === 'account' && segments[1] === 'login';
    const publicRoutes = ['terms', 'privacy', 'about'];
    const isPublicRoute = publicRoutes.includes(segments[0] as string);

    if (authStatus === 'unauthenticated' && !isLoginRoute && !isPublicRoute) {
      router.replace('/account/login' as never);
      return;
    }

    if ((authStatus === 'authenticated' || authStatus === 'offline_authenticated') && isLoginRoute) {
      router.replace('/(tabs)/today' as never);
    }
  }, [authStatus, segments]);

  if (authStatus === 'checking') {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="workout/[sessionId]" options={{ headerShown: false }} />
      <Stack.Screen name="workout/summary/[sessionId]" options={{ headerShown: false }} />
      <Stack.Screen name="member/new" options={{ title: '新增成员' }} />
      <Stack.Screen name="member/[memberId]" options={{ title: '成员资料' }} />
      <Stack.Screen name="history/manual" options={{ title: '补录训练' }} />
      <Stack.Screen name="history/analytics" options={{ headerShown: false }} />
      <Stack.Screen name="history/[sessionId]" options={{ title: '训练详情' }} />
      <Stack.Screen name="plan/[planId]" options={{ title: '计划详情' }} />
      <Stack.Screen name="plan/create" options={{ title: '创建计划' }} />
      <Stack.Screen name="account/index" options={{ title: '账号资料' }} />
      <Stack.Screen name="account/login" options={{ headerShown: false }} />
      <Stack.Screen name="account/settings" options={{ title: '账号设置' }} />
      <Stack.Screen name="account/security" options={{ title: '账号安全' }} />
      <Stack.Screen name="profile/avatar" options={{ title: '头像设置' }} />
      <Stack.Screen name="profile/training-identity" options={{ title: '训练身份' }} />
      <Stack.Screen name="profile/groups" options={{ title: '我的小组' }} />
      <Stack.Screen name="profile/preferences" options={{ title: '训练偏好' }} />
      <Stack.Screen name="profile/data" options={{ title: '训练数据' }} />
      <Stack.Screen name="profile/privacy" options={{ title: '数据管理' }} />
      <Stack.Screen name="profile/sync" options={{ title: '云同步' }} />
      <Stack.Screen name="profile/membership" options={{ title: '会员与激活' }} />
      <Stack.Screen name="settings/members" options={{ title: '成员资料' }} />
      <Stack.Screen name="settings/member-units" options={{ title: '加重单位' }} />
      <Stack.Screen name="activation" options={{ title: '激活码兑换' }} />
      <Stack.Screen name="about" options={{ title: '关于练刻' }} />
      <Stack.Screen name="terms" options={{ title: '用户协议' }} />
      <Stack.Screen name="privacy" options={{ title: '隐私政策' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
});
