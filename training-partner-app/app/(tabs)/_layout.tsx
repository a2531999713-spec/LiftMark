import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors, layout } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ color, name, size }: { color: ColorValue; name: IoniconName; size: number }) {
  return <Ionicons color={String(color)} name={name} size={Math.min(size, layout.tabIconSize)} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSubtle,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 0.5,
          height: layout.tabBarHeight,
          paddingBottom: 6,
          paddingTop: 5,
        },
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: '首页',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="home-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: '计划',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="clipboard-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '记录',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="bar-chart-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="person-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
