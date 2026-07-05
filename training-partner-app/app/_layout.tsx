import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';

import { initializeLocalDatabase } from '@/data/local';
import { useAuthStore } from '@/store/authStore';
import { sync, getLastSyncAt } from '@/sync/syncOrchestrator';
import { colors, spacing } from '@/theme';

const SYNC_THROTTLE_MS = 30_000;

function triggerAppSync(): void {
  if (Date.now() - getLastSyncAt() < SYNC_THROTTLE_MS) {
    return;
  }
  void sync().catch((error) => {
    console.warn('[app] sync failed', error instanceof Error ? error.message : error);
  });
}

export default function RootLayout() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const segments = useSegments();

  useEffect(() => {
    async function boot() {
      await initializeLocalDatabase();
      await useAuthStore.getState().loadCurrentUser();

      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        // 启动时触发同步（pull + push），受 30 秒节流控制
        triggerAppSync();
      }
    }
    void boot().catch((error) => {
      console.error('启动初始化失败', error);
    });
  }, []);

  // App 从后台回到前台时触发同步（30 秒节流）
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        triggerAppSync();
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (authStatus === 'checking') return;

    const isLoginRoute = segments[0] === 'account' && segments[1] === 'login';
    const rootSegment = segments[0] as string | undefined;
    const publicRoutes = ['terms', 'privacy', 'about'];
    const isPublicRoute = publicRoutes.includes(rootSegment ?? '') || rootSegment === 'legal';

    if (authStatus === 'unauthenticated' && !isLoginRoute && !isPublicRoute) {
      router.replace('/account/login' as never);
      return;
    }

    if ((authStatus === 'authenticated' || authStatus === 'offline_authenticated') && isLoginRoute) {
      router.replace('/onboarding/training-profile' as never);
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
    <Stack
      screenOptions={{
        headerBackButtonDisplayMode: 'minimal',
        headerBackTitle: '',
        headerTitleAlign: 'center',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="workout/[sessionId]" options={{ headerShown: false }} />
      <Stack.Screen name="workout/summary/[sessionId]" options={{ headerShown: false }} />
      <Stack.Screen name="member/new" options={{ headerShown: false }} />
      <Stack.Screen name="member/[memberId]" options={{ headerShown: false }} />
      <Stack.Screen name="history/manual" options={{ title: '' }} />
      <Stack.Screen name="history/analytics" options={{ headerShown: false }} />
      <Stack.Screen name="history/exercise/[exerciseId]" options={{ headerShown: false }} />
      <Stack.Screen name="history/group-exercise/[exerciseId]" options={{ headerShown: false }} />
      <Stack.Screen name="history/[sessionId]" options={{ title: '' }} />
      <Stack.Screen name="plan/[planId]" options={{ title: '' }} />
      <Stack.Screen name="plan/edit/[planId]" options={{ title: '' }} />
      <Stack.Screen name="plan/edit-day/[dayId]" options={{ title: '' }} />
      <Stack.Screen name="plan/create" options={{ title: '' }} />
      <Stack.Screen name="account/index" options={{ title: '' }} />
      <Stack.Screen name="account/login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/training-profile" options={{ headerShown: false }} />
      <Stack.Screen name="account/settings" options={{ headerShown: false }} />
      <Stack.Screen name="account/security" options={{ headerShown: false }} />
      <Stack.Screen name="profile/avatar" options={{ headerShown: false }} />
      <Stack.Screen name="profile/index" options={{ headerShown: false }} />
      <Stack.Screen name="profile/edit" options={{ headerShown: false }} />
      <Stack.Screen name="profile/nickname" options={{ headerShown: false }} />
      <Stack.Screen name="profile/account" options={{ headerShown: false }} />
      <Stack.Screen name="profile/body-metrics" options={{ headerShown: false }} />
      <Stack.Screen name="profile/training-identity" options={{ title: '' }} />
      <Stack.Screen name="profile/groups" options={{ title: '' }} />
      <Stack.Screen name="profile/preferences" options={{ title: '' }} />
      <Stack.Screen name="profile/data" options={{ title: '' }} />
      <Stack.Screen name="profile/privacy" options={{ title: '' }} />
      <Stack.Screen name="profile/sync" options={{ title: '' }} />
      <Stack.Screen name="profile/membership" options={{ headerShown: false }} />
      <Stack.Screen name="groups/switch" options={{ headerShown: false }} />
      <Stack.Screen name="groups/manage" options={{ title: '管理小组与成员' }} />
      <Stack.Screen name="sync/index" options={{ title: '' }} />
      <Stack.Screen name="backup/index" options={{ headerShown: false }} />
      <Stack.Screen name="preferences/index" options={{ title: '' }} />
      <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
      <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
      <Stack.Screen name="feedback" options={{ headerShown: false }} />
      <Stack.Screen name="settings/members" options={{ title: '' }} />
      <Stack.Screen name="settings/member-units" options={{ title: '' }} />
      <Stack.Screen name="activation" options={{ headerShown: false }} />
      <Stack.Screen name="about" options={{ headerShown: false }} />
      <Stack.Screen name="terms" options={{ title: '' }} />
      <Stack.Screen name="privacy" options={{ title: '' }} />
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
