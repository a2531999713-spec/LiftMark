import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { PhaseType, PlanTemplate } from '@/domain/plan/plan.types';
import {
  describeSchemeGoal,
  describeSchemeLevel,
  listSystemTrainingSchemes,
  SYSTEM_SCHEME_CLASSIC_PPL_ID,
  type SystemTrainingScheme,
} from '@/domain/plan/systemSchemes';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

type ActivationPrompt = {
  message: string;
  plan: PlanTemplate;
  title: string;
};

type IconName = ComponentProps<typeof Ionicons>['name'];

function describePlanSource(source: PlanTemplate['source']) {
  const labels: Record<PlanTemplate['source'], string> = {
    system: '系统方案',
    user: '自建计划',
    system_copy: '系统方案副本',
    blank_created: '空白创建',
    imported: '导入计划',
    duplicated: '复制计划',
  };
  return labels[source];
}

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
  const [group, setGroup] = useState<Group | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<SystemTrainingScheme | null>(null);
  const [activationPrompt, setActivationPrompt] = useState<ActivationPrompt | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  const loadExploreState = useCallback(async () => {
    await initializeLocalDatabase();
    const [nextGroup, nextUserPlans] = await Promise.all([
      repositories.groupRepository.getDefaultGroup(),
      repositories.planRepository.listUserPlans(),
    ]);
    setGroup(nextGroup);
    setUserPlans(nextUserPlans);
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadExploreState();
    }, [loadExploreState]),
  );

  const resolvePhaseTypeForPlan = useCallback(
    async (planId: string): Promise<PhaseType> => {
      const phases = await repositories.planRepository.listPlanPhases(planId);
      return phases[0]?.type ?? 'custom';
    },
    [repositories],
  );

  const findCopiedPlan = useCallback(
    (schemeId: string) => userPlans.find((plan) => plan.originSchemeId === schemeId || (schemeId === SYSTEM_SCHEME_CLASSIC_PPL_ID && plan.name.includes('经典三分化 PPL'))),
    [userPlans],
  );

  const setCurrentPlan = useCallback(
    async (plan: PlanTemplate) => {
      if (!group) {
        setNotice({ title: '还没有本地小组', message: '初始化本地小组后，才能设置当前训练计划。' });
        return;
      }

      if (!guardFeature('edit_plan')) {
        return;
      }

      setIsWorking(true);
      try {
        await repositories.groupRepository.updateGroup(group.id, {
          activePlanId: plan.id,
          currentPhaseType: await resolvePhaseTypeForPlan(plan.id),
          currentWeek: 1,
        });
        await loadExploreState();
        setActivationPrompt(null);
        setNotice({
          title: '已设为当前计划',
          message: `训练页将读取“${plan.name}”，今日训练内容会按新计划刷新。`,
        });
      } catch (error) {
        setNotice({ title: '设置失败', message: error instanceof Error ? error.message : '设置当前计划失败。' });
      } finally {
        setIsWorking(false);
      }
    },
    [group, guardFeature, loadExploreState, repositories, resolvePhaseTypeForPlan],
  );

  const copyScheme = useCallback(
    async (scheme: SystemTrainingScheme) => {
      if (!guardFeature('create_plan', { userPlanCount: userPlans.length })) {
        return;
      }

      setIsWorking(true);
      try {
        const plan = await repositories.planRepository.copySystemSchemeToUserPlan({
          name: scheme.title.replace('方案', '计划'),
          scheme,
        });
        const nextUserPlans = await repositories.planRepository.listUserPlans();
        setUserPlans(nextUserPlans);
        setSelectedScheme(null);
        setActivationPrompt({
          plan,
          title: '已复制到我的计划',
          message: `“${plan.name}”已经可以编辑和执行。是否设为当前训练计划？`,
        });
      } catch (error) {
        setNotice({ title: '复制失败', message: error instanceof Error ? error.message : '使用系统方案失败。' });
      } finally {
        setIsWorking(false);
      }
    },
    [guardFeature, repositories, userPlans.length],
  );

  const openScheme = useCallback(
    (scheme: SystemTrainingScheme) => {
      const copiedPlan = findCopiedPlan(scheme.id);
      if (copiedPlan) {
        setActivationPrompt({
          plan: copiedPlan,
          title: '已在我的计划中',
          message: `“${copiedPlan.name}”已经复制过，可以直接设为当前训练计划。`,
        });
        return;
      }

      setSelectedScheme(scheme);
    },
    [findCopiedPlan],
  );

  const openPpl = useCallback(() => {
    if (!pplScheme) {
      setNotice({ title: '方案暂不可用', message: '经典三分化 PPL 模板暂时无法加载。' });
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
      <View style={styles.searchBox}>
        <Ionicons color={colors.textMuted} name="search-outline" size={18} />
        <AppText tone="muted" variant="bodySmall">
          搜索计划、动作
        </AppText>
      </View>

      <VisualHeroCard
        eyebrow="推荐方案"
        icon="barbell-outline"
        imageSource={liftmarkImages.exploreHero}
        subtitle="推 / 拉 / 腿三天循环，适合每周训练 3 天，兼顾增肌和基础力量。"
        title="经典三分化 PPL"
      >
        <View style={styles.heroActions}>
          <AppButton icon="barbell-outline" onPress={openPpl} size="sm">
            使用 PPL
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
            本地小组支持多人同练，同动作不同重量，轮流记录。
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

      {isWorking ? (
        <AppText tone="muted" variant="caption">
          正在处理计划...
        </AppText>
      ) : null}

      <AppModalSheet
        onClose={() => setSelectedScheme(null)}
        subtitle="系统会复制一份到“我的计划”，复制后你可以编辑自己的版本。"
        title="使用此方案？"
        visible={Boolean(selectedScheme)}
      >
        {selectedScheme ? (
          <AppCard style={styles.schemePreview} tone="soft">
            <View style={styles.planMetaRow}>
              <Tag label={describeSchemeGoal(selectedScheme.goal)} tone="brand" />
              <Tag label={describeSchemeLevel(selectedScheme.level)} tone="accent" />
              <Tag label={`每周 ${selectedScheme.frequencyPerWeek} 天`} tone="neutral" />
            </View>
            <AppText variant="bodySmall" weight="900">
              {selectedScheme.title}
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              {selectedScheme.description}
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setSelectedScheme(null)} variant="secondary">
            取消
          </AppButton>
          <AppButton disabled={isWorking} onPress={() => (selectedScheme ? void copyScheme(selectedScheme) : undefined)}>
            复制到我的计划
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setActivationPrompt(null)}
        subtitle={activationPrompt?.message}
        title={activationPrompt?.title ?? '计划已准备好'}
        visible={Boolean(activationPrompt)}
      >
        {activationPrompt ? (
          <AppCard style={styles.schemePreview} tone="soft">
            <AppText variant="bodySmall" weight="900">
              {activationPrompt.plan.name}
            </AppText>
            <AppText tone="muted" variant="caption">
              {describePlanSource(activationPrompt.plan.source)} · {activationPrompt.plan.durationWeeks} 周 · 每周{' '}
              {activationPrompt.plan.frequencyPerWeek} 天
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setActivationPrompt(null)} variant="secondary">
            稍后
          </AppButton>
          <AppButton disabled={isWorking} onPress={() => (activationPrompt ? void setCurrentPlan(activationPrompt.plan) : undefined)}>
            设为当前
          </AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>

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
