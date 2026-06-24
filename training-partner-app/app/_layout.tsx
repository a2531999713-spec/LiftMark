import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { initializeLocalDatabase } from '@/data/local';
import { useAuthStore } from '@/store/authStore';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.warn('Web 暂不作为第一阶段验收目标，跳过 native SQLite 初始化。');
      return;
    }

    void initializeLocalDatabase().catch((error) => {
      console.error('本地数据库初始化失败', error);
    });
    void useAuthStore.getState().loadCurrentUser();
  }, []);

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
      <Stack.Screen name="account/login" options={{ title: '登录 / 注册' }} />
      <Stack.Screen name="account/security" options={{ title: '账号安全' }} />
      <Stack.Screen name="profile/training-identity" options={{ title: '训练身份' }} />
      <Stack.Screen name="profile/groups" options={{ title: '我的小组' }} />
      <Stack.Screen name="profile/preferences" options={{ title: '训练偏好' }} />
      <Stack.Screen name="profile/data" options={{ title: '训练数据' }} />
      <Stack.Screen name="profile/privacy" options={{ title: '数据与隐私' }} />
      <Stack.Screen name="profile/sync" options={{ title: '云同步' }} />
      <Stack.Screen name="profile/membership" options={{ title: '会员与激活' }} />
      <Stack.Screen name="settings/members" options={{ title: '成员资料' }} />
      <Stack.Screen name="settings/member-units" options={{ title: '加重单位' }} />
      <Stack.Screen name="activation" options={{ title: '激活码兑换' }} />
      <Stack.Screen name="about" options={{ title: '关于练刻' }} />
    </Stack>
  );
}
