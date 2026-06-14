import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

function TabIcon({ color, name, size }: { color: ColorValue; name: IoniconName; size: number }) {
  return <Ionicons color={String(color)} name={name} size={size} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '800',
        },
        tabBarStyle: {
          borderTopColor: colors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="explore"
        options={{
          title: '探索',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="search-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="members"
        options={{
          title: '搭子',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="people-outline" size={size} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: '训练',
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="barbell-outline" size={size} />,
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
          title: '设置',
          href: null,
          tabBarIcon: ({ color, size }) => <TabIcon color={color} name="settings-outline" size={size} />,
        }}
      />
    </Tabs>
  );
}
