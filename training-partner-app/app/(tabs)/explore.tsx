import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppText, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import {
  describeSchemeGoal,
  describeSchemeLevel,
  listSystemTrainingSchemes,
  SYSTEM_SCHEME_CLASSIC_PPL_ID,
  type SystemTrainingScheme,
} from '@/domain/plan/systemSchemes';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function ExploreRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const systemSchemes = useMemo(() => listSystemTrainingSchemes(), []);
  const featuredSchemes = useMemo(() => systemSchemes.filter((scheme) => scheme.isAvailable).slice(0, 3), [systemSchemes]);
  const upcomingSchemes = useMemo(() => systemSchemes.filter((scheme) => !scheme.isAvailable), [systemSchemes]);
  const pplScheme = useMemo(
    () => systemSchemes.find((scheme) => scheme.id === SYSTEM_SCHEME_CLASSIC_PPL_ID) ?? null,
    [systemSchemes],
  );
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);

  const loadExploreState = useCallback(async () => {
    await initializeLocalDatabase();
    setUserPlans(await repositories.planRepository.listUserPlans());
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadExploreState();
    }, [loadExploreState]),
  );

  const findCopiedPlan = useCallback(
    (schemeId: string) => userPlans.find((plan) => plan.originSchemeId === schemeId || (schemeId === SYSTEM_SCHEME_CLASSIC_PPL_ID && plan.name.includes('经典三分化 PPL'))),
    [userPlans],
  );

  const openScheme = useCallback(
    (scheme: SystemTrainingScheme) => {
      router.push({ pathname: '/plan/scheme/[schemeId]', params: { schemeId: scheme.id } } as never);
    },
    [],
  );

  const openPpl = useCallback(() => {
    if (!pplScheme) {
      return;
    }

    openScheme(pplScheme);
  }, [openScheme, pplScheme]);

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/settings')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="settings-outline" size={20} />
        </Pressable>
      }
      title="探索"
    >
      <Pressable accessibilityRole="button" onPress={() => router.push('/plan/library' as never)} style={styles.searchBox}>
        <Ionicons color={colors.textMuted} name="search-outline" size={18} />
        <AppText tone="muted" variant="bodySmall">
          搜索训练计划
        </AppText>
      </Pressable>

      <VisualHeroCard
        eyebrow="推荐方案"
        icon="barbell-outline"
        imageSource={liftmarkImages.exploreHero}
        subtitle="推 / 拉 / 腿三天循环，适合每周训练 3 天，兼顾增肌和基础力量。"
        title="经典三分化 PPL"
      >
        <View style={styles.heroActions}>
          <AppButton icon="barbell-outline" onPress={openPpl} size="sm">
            查看 PPL
          </AppButton>
          <AppButton icon="calendar-outline" onPress={() => router.push('/(tabs)/today')} size="sm" variant="dark">
            去训练
          </AppButton>
        </View>
      </VisualHeroCard>

      <AppCard style={styles.myPlanCard}>
        <View style={styles.toolHeader}>
          <View style={styles.partnerText}>
            <AppText variant="subtitle">我的计划</AppText>
            <AppText tone="muted" variant="caption">
              {userPlans.length > 0 ? `已有 ${userPlans.length} 个可执行计划` : '复制系统方案后会出现在这里'}
            </AppText>
          </View>
          <AppButton onPress={() => router.push('/(tabs)/plan')} size="sm" variant="secondary">
            查看
          </AppButton>
        </View>
      </AppCard>

      <AppCard style={styles.partnerCard} tone="brand">
        <View style={styles.partnerText}>
          <AppText variant="subtitle">找搭子，一起更强</AppText>
          <AppText tone="muted" variant="bodySmall">
            小组支持多人同练，同动作不同重量，轮流记录。
          </AppText>
        </View>
        <AppButton onPress={() => router.push('/(tabs)/members')} size="sm">
          去找搭子
        </AppButton>
      </AppCard>

      <View style={styles.quickGrid}>
        <QuickEntry
          icon="add-circle-outline"
          label="补录训练"
          onPress={() => {
            if (guardFeature('manual_history')) router.push('/history/manual' as never);
          }}
        />
        <QuickEntry
          icon="bar-chart-outline"
          label="训练分析"
          onPress={() => {
            if (guardFeature('advanced_history')) router.push('/history/analytics' as never);
          }}
        />
      </View>

      <SectionHeader subtitle="推荐方案最多展示 3 个，更多模板会逐步开放。" title="推荐计划" />

      <View style={styles.planList}>
        {featuredSchemes.map((scheme) => {
          const copiedPlan = findCopiedPlan(scheme.id);
          return (
            <Pressable
              accessibilityRole="button"
              key={scheme.id}
              onPress={() => openScheme(scheme)}
              style={({ pressed }) => [styles.planCard, pressed && styles.pressed]}
            >
              <View style={styles.planThumb}>
                <Ionicons color={colors.surface} name="barbell-outline" size={20} />
              </View>
              <View style={styles.planBody}>
                <View style={styles.planTitleRow}>
                  <AppText numberOfLines={1} variant="bodySmall" weight="900">
                    {scheme.title}
                  </AppText>
                  {copiedPlan ? <Tag label="已复制" tone="success" /> : null}
                </View>
                <AppText numberOfLines={2} tone="muted" variant="caption">
                  {scheme.subtitle}
                </AppText>
                <View style={styles.planMetaRow}>
                  <Tag label={describeSchemeGoal(scheme.goal)} tone="brand" />
                  <Tag label={describeSchemeLevel(scheme.level)} tone="accent" />
                  <Tag label={`每周 ${scheme.frequencyPerWeek} 天`} tone="neutral" />
                </View>
              </View>
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          );
        })}
        {upcomingSchemes.length > 0 ? (
          <AppCard style={styles.moreCard} tone="soft">
            <View style={styles.toolHeader}>
              <View style={styles.partnerText}>
                <AppText variant="bodySmall" weight="900">
                  更多方案开发中
                </AppText>
                <AppText tone="muted" variant="caption">
                  {upcomingSchemes
                    .slice(0, 4)
                    .map((scheme) => scheme.title)
                    .join('、')}
                  {upcomingSchemes.length > 4 ? ` 等 ${upcomingSchemes.length} 个` : ''}
                </AppText>
              </View>
              <Tag label="已收起" tone="neutral" />
            </View>
          </AppCard>
        ) : null}
      </View>

      <AppButton icon="library-outline" onPress={() => router.push('/plan/library' as never)} variant="secondary">
        查看完整推荐计划库
      </AppButton>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function QuickEntry({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickEntry, pressed && styles.pressed]}>
      <View style={styles.toolIcon}>
        <Ionicons color={colors.primary} name={icon} size={18} />
      </View>
      <AppText style={styles.toolLabel} variant="bodySmall" weight="900">
        {label}
      </AppText>
      <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  myPlanCard: {
    gap: spacing.md,
  },
  toolHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickEntry: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 60,
    padding: spacing.lg,
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  toolIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  toolLabel: {
    flex: 1,
  },
  partnerCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  partnerText: {
    flex: 1,
    gap: spacing.xs,
  },
  planList: {
    gap: spacing.md,
  },
  planCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  planThumb: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  planBody: {
    flex: 1,
    gap: spacing.xs,
  },
  planTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  moreCard: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  schemePreview: {
    gap: spacing.md,
    padding: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
});
