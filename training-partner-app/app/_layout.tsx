import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { initializeLocalDatabase } from '@/data/local';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';

export default function RootLayout() {
  const authStatus = useAuthStore((state) => state.authStatus);
  const segments = useSegments();

  useEffect(() => {
    async function boot() {
      await initializeLocalDatabase();
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
      <Stack.Screen name="member/new" options={{ title: '' }} />
      <Stack.Screen name="member/[memberId]" options={{ title: '' }} />
      <Stack.Screen name="history/manual" options={{ title: '' }} />
      <Stack.Screen name="history/analytics" options={{ headerShown: false }} />
      <Stack.Screen name="history/group-exercise/[exerciseId]" options={{ headerShown: false }} />
      <Stack.Screen name="history/[sessionId]" options={{ title: '' }} />
      <Stack.Screen name="plan/[planId]" options={{ title: '' }} />
      <Stack.Screen name="plan/create" options={{ title: '' }} />
      <Stack.Screen name="account/index" options={{ title: '' }} />
      <Stack.Screen name="account/login" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding/training-profile" options={{ headerShown: false }} />
      <Stack.Screen name="account/settings" options={{ title: '' }} />
      <Stack.Screen name="account/security" options={{ title: '' }} />
      <Stack.Screen name="profile/avatar" options={{ title: '' }} />
      <Stack.Screen name="profile/training-identity" options={{ title: '' }} />
      <Stack.Screen name="profile/groups" options={{ title: '' }} />
      <Stack.Screen name="profile/preferences" options={{ title: '' }} />
      <Stack.Screen name="profile/data" options={{ title: '' }} />
      <Stack.Screen name="profile/privacy" options={{ title: '' }} />
      <Stack.Screen name="profile/sync" options={{ title: '' }} />
      <Stack.Screen name="profile/membership" options={{ title: '' }} />
      <Stack.Screen name="settings/members" options={{ title: '' }} />
      <Stack.Screen name="settings/member-units" options={{ title: '' }} />
      <Stack.Screen name="activation" options={{ title: '' }} />
      <Stack.Screen name="about" options={{ title: '' }} />
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
