import { router, Stack, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, AppState, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppScopeProvider } from '@/application/scope';
import { initializeLocalDatabase } from '@/data/local';
import { useAuthStore } from '@/store/authStore';
import { sync, getLastSyncAt } from '@/sync/syncOrchestrator';
import { colors, spacing } from '@/theme';
import * as Notifications from 'expo-notifications';
import { reconcileTrainingReminderSchedules } from '@/services/trainingReminderService';
import { resolvePostLoginDestination } from '@/features/onboarding/application/postLoginDestination';

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
        // loadCurrentUser already starts account-scoped recovery. Starting a
        // second sync here can win the global lock and drop required recovery.
        void reconcileTrainingReminderSchedules().catch((error) => console.warn('[app] reminder reconcile failed', error));
      }
    }
    void boot().catch((error) => {
      console.error('启动初始化失败', error);
    });
  }, []);

  useEffect(() => {
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data;
      // Reminder payload can become stale after plan changes; Today is always safe.
      if (data && typeof data === 'object') router.push('/(tabs)/today' as never);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) handleResponse(response); });
    return () => subscription.remove();
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
      const userId = useAuthStore.getState().user?.id;
      if (!userId) return;
      let cancelled = false;
      void (async () => {
        // New devices must let account-scoped recovery populate existing plans/profiles before onboarding is decided.
        if (authStatus === 'authenticated') {
          await sync().catch(() => undefined);
        }
        const next = await resolvePostLoginDestination(userId);
        if (!cancelled) router.replace(next.destination as never);
      })();
      return () => { cancelled = true; };
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
    <GestureHandlerRootView style={styles.root}>
      <AppScopeProvider>
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
        <Stack.Screen name="report/[sessionId]" options={{ headerShown: false }} />
        <Stack.Screen name="recovery" options={{ headerShown: false }} />
        <Stack.Screen name="achievements" options={{ headerShown: false }} />
        <Stack.Screen name="member/new" options={{ headerShown: false }} />
        <Stack.Screen name="member/[memberId]" options={{ headerShown: false }} />
        <Stack.Screen name="history/manual" options={{ headerShown: false }} />
        <Stack.Screen name="history/manual-set-editor" options={{ headerShown: false }} />
        <Stack.Screen name="history/analytics" options={{ headerShown: false }} />
        <Stack.Screen name="history/exercise/[exerciseId]" options={{ headerShown: false }} />
        <Stack.Screen name="history/group" options={{ headerShown: false }} />
        <Stack.Screen name="history/group/member/[memberId]" options={{ headerShown: false }} />
        <Stack.Screen name="history/group/exercise-compare" options={{ headerShown: false }} />
        <Stack.Screen name="history/group/attendance" options={{ headerShown: false }} />
        <Stack.Screen name="history/group-exercise/[exerciseId]" options={{ headerShown: false }} />
        <Stack.Screen name="history/[sessionId]" options={{ title: '' }} />
        <Stack.Screen name="plan/[planId]" options={{ title: '' }} />
        <Stack.Screen name="plan/library" options={{ title: '' }} />
        <Stack.Screen name="plan/scheme/[schemeId]" options={{ title: '' }} />
        <Stack.Screen name="plan/edit/[planId]" options={{ title: '编辑计划' }} />
        <Stack.Screen name="plan/edit-day/[dayId]" options={{ title: '' }} />
        <Stack.Screen name="plan/cycle/[cycleId]" options={{ headerShown: false }} />
        <Stack.Screen name="plan/create" options={{ title: '创建计划' }} />
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
        <Stack.Screen name="profile/training-reminders" options={{ title: '' }} />
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
      </AppScopeProvider>
    </GestureHandlerRootView>
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
  root: {
    flex: 1,
  },
});
