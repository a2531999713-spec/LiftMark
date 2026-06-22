import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { initializeLocalDatabase } from '@/data/local';

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      console.warn('Web 暂不作为第一阶段验收目标，跳过 native SQLite 初始化。');
      return;
    }

    void initializeLocalDatabase().catch((error) => {
      console.error('本地数据库初始化失败', error);
    });
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
      <Stack.Screen name="settings/members" options={{ title: '成员资料' }} />
      <Stack.Screen name="settings/member-units" options={{ title: '加重单位' }} />
      <Stack.Screen name="activation" options={{ title: '输入激活码' }} />
      <Stack.Screen name="about" options={{ title: '关于练刻' }} />
    </Stack>
  );
}
