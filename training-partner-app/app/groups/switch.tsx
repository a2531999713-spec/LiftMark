import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Screen, SettingsRow, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing } from '@/theme';

export default function GroupSwitchRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [groups, setGroups] = useState<Group[]>([]);
  const [plansByGroupId, setPlansByGroupId] = useState<Record<string, PlanTemplate | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await initializeLocalDatabase();
      const nextGroups = await repositories.groupRepository.listGroups();
      const plans = await Promise.all(
        nextGroups.map(async (group) => [
          group.id,
          group.activePlanId ? await repositories.planRepository.getPlanById(group.activePlanId) : null,
        ]),
      );
      setGroups(nextGroups);
      setPlansByGroupId(Object.fromEntries(plans));
      if (!selectedGroupId && nextGroups[0]) {
        setSelectedGroupId(nextGroups[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '小组列表加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, selectedGroupId, setSelectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen contentStyle={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.textStrong} name="chevron-back" size={25} />
        </Pressable>
        <AppText style={styles.headerTitle} variant="title" weight="900">
          切换小组
        </AppText>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState actionLabel="重新加载" description={error} onActionPress={() => void load()} title="小组不可用" /> : null}

      {!isLoading && !error ? (
        <AppCard style={styles.card}>
          {groups.length === 0 ? (
            <AppText tone="muted" variant="bodySmall">
              还没有小组。请先在管理小组与成员中创建。
            </AppText>
          ) : null}
          {groups.map((group) => {
            const selected = group.id === selectedGroupId;
            return (
              <Pressable
                accessibilityRole="button"
                key={group.id}
                onPress={() => setSelectedGroupId(group.id)}
                style={({ pressed }) => [styles.groupRow, selected && styles.groupRowActive, pressed && styles.pressed]}
              >
                <View style={styles.groupText}>
                  <AppText numberOfLines={1} variant="subtitle" weight="900">
                    {group.name}
                  </AppText>
                  <AppText numberOfLines={1} tone="muted" variant="bodySmall">
                    第 {group.currentWeek} 周 · {plansByGroupId[group.id]?.name ?? '未设置计划'}
                  </AppText>
                </View>
                {selected ? <Tag label="当前" tone="brand" /> : <AppText tone="muted" variant="caption" weight="800">切换</AppText>}
              </Pressable>
            );
          })}
          <SettingsRow label="管理入口" value="首页头像菜单 / 训练小组" />
        </AppCard>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  card: {
    gap: spacing.sm,
  },
  groupRow: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 72,
    padding: spacing.md,
  },
  groupRowActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  groupText: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerSpacer: {
    width: 44,
  },
  headerTitle: {
    color: colors.textStrong,
  },
  pressed: {
    opacity: 0.72,
  },
  screen: {
    gap: spacing.lg,
  },
});
