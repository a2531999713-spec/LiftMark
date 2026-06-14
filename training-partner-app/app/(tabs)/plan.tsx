import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ActionCard, AppButton, AppCard, AppText, EmptyState, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import {
  DEFAULT_CYCLE_WEEK_COUNT,
} from '@/domain/plan/defaultCycle';
import type { PhaseType, PlanTemplate } from '@/domain/plan/plan.types';
import {
  describeSchemeGoal,
  describeSchemeLevel,
  listSystemTrainingSchemes,
  type SystemTrainingScheme,
} from '@/domain/plan/systemSchemes';
import { pickImportedPlanDocument } from '@/services/planDocumentService';
import { createCurrentPlanFile, PlanFileError, serializePlanFile } from '@/services/planFileService';
import { colors, radius, spacing, typography } from '@/theme';

function showComingSoon(feature: string) {
  Alert.alert('开发中', `该功能正在开发中，后续版本开放。\n\n${feature}`);
}

function describePlanSource(source: PlanTemplate['source']) {
  const labels: Record<PlanTemplate['source'], string> = {
    system: '系统方案',
    user: '手动创建',
    system_copy: '来自系统方案',
    blank_created: '空白创建',
    imported: '导入计划',
    duplicated: '复制计划',
  };
  return labels[source];
}

function clampPlanWeek(week: number, plan: PlanTemplate | null) {
  const maxWeek = plan?.durationWeeks ?? DEFAULT_CYCLE_WEEK_COUNT;
  return Math.min(maxWeek, Math.max(1, Math.round(week)));
}

export default function PlanRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const systemSchemes = useMemo(() => listSystemTrainingSchemes(), []);
  const [group, setGroup] = useState<Group | null>(null);
  const [activePlan, setActivePlan] = useState<PlanTemplate | null>(null);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);
  const [selectedScheme, setSelectedScheme] = useState<SystemTrainingScheme | null>(null);
  const [draftPlanName, setDraftPlanName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextGroup = await repositories.groupRepository.getDefaultGroup();
      if (!nextGroup) {
        throw new Error('默认小组尚未初始化。');
      }

      const [nextActivePlan, nextUserPlans] = await Promise.all([
        repositories.planRepository.getPlanById(nextGroup.activePlanId),
        repositories.planRepository.listUserPlans(),
      ]);

      setGroup(nextGroup);
      setActivePlan(nextActivePlan);
      setUserPlans(nextUserPlans);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadPlans();
    }, [loadPlans]),
  );

  const resolvePhaseTypeForWeek = useCallback(
    async (planId: string, week: number): Promise<PhaseType> => {
      const phases = await repositories.planRepository.listPlanPhases(planId);
      return phases.find((phase) => week >= phase.startWeek && week <= phase.endWeek)?.type ?? phases[0]?.type ?? 'custom';
    },
    [repositories],
  );

  const saveWeek = useCallback(
    async (week: number) => {
      if (!group) {
        return;
      }

      const currentWeek = clampPlanWeek(week, activePlan);
      const updated = await repositories.groupRepository.updateGroup(group.id, {
        currentPhaseType: await resolvePhaseTypeForWeek(group.activePlanId, currentWeek),
        currentWeek,
      });
      setGroup(updated);
    },
    [activePlan, group, repositories, resolvePhaseTypeForWeek],
  );

  const toggleFriday = useCallback(async () => {
    if (!group) {
      return;
    }

    const updated = await repositories.groupRepository.updateGroup(group.id, {
      fridayEnabled: !group.fridayEnabled,
      fridayStrategy: group.fridayEnabled ? 'default_rest' : 'allow_weak',
    });
    setGroup(updated);
  }, [group, repositories]);

  const setCurrentPlan = useCallback(
    async (plan: PlanTemplate) => {
      if (!group) {
        return;
      }

      setIsWorking(true);
      try {
        const updated = await repositories.groupRepository.updateGroup(group.id, {
          activePlanId: plan.id,
          currentPhaseType: await resolvePhaseTypeForWeek(plan.id, 1),
          currentWeek: 1,
        });
        setGroup(updated);
        setActivePlan(plan);
        Alert.alert('已设为当前计划', `训练页将读取“${plan.name}”。`);
      } catch (setError) {
        Alert.alert('设置失败', setError instanceof Error ? setError.message : '设置当前计划失败。');
      } finally {
        setIsWorking(false);
      }
    },
    [group, repositories, resolvePhaseTypeForWeek],
  );

  const exportPlan = useCallback(
    async (plan: PlanTemplate) => {
      setIsWorking(true);
      try {
        const planFile = await createCurrentPlanFile(repositories, plan.id);
        const json = serializePlanFile(planFile);
        Alert.alert(
          '导出计划',
          `已生成 .liftmark.json 内容，大小约 ${Math.ceil(json.length / 1024)} KB。文件保存/分享能力正在接入中。`,
        );
      } catch (exportError) {
        Alert.alert('导出失败', exportError instanceof Error ? exportError.message : '导出计划失败。');
      } finally {
        setIsWorking(false);
      }
    },
    [repositories],
  );

  const importPlan = useCallback(async () => {
    setIsWorking(true);
    try {
      const picked = await pickImportedPlanDocument();
      if (!picked) {
        return;
      }

      const importedPlan = await repositories.planRepository.importUserPlan({
        alternatives: picked.draft.alternatives,
        days: picked.draft.plan.days,
        exercises: picked.draft.exercises,
        phases: picked.draft.plan.phases,
        planExercises: picked.draft.plan.exercises,
        template: picked.draft.plan.template,
      });
      setUserPlans(await repositories.planRepository.listUserPlans());

      Alert.alert('计划已导入', `“${importedPlan.name}”已成为我的计划。\n\n是否设为当前训练计划？`, [
        { text: '稍后', style: 'cancel' },
        {
          text: '设为当前',
          onPress: () => {
            void setCurrentPlan(importedPlan);
          },
        },
      ]);
    } catch (importError) {
      if (importError instanceof PlanFileError) {
        Alert.alert('计划文件格式不兼容', '这个文件不是练刻 LiftMark 支持的计划文件。');
        return;
      }

      Alert.alert('导入失败', importError instanceof Error ? importError.message : '计划导入失败。');
    } finally {
      setIsWorking(false);
    }
  }, [repositories, setCurrentPlan]);

  const openSchemeDetail = useCallback((scheme: SystemTrainingScheme) => {
    Alert.alert(
      scheme.title,
      [
        scheme.subtitle,
        `目标：${describeSchemeGoal(scheme.goal)}`,
        `适合人群：${describeSchemeLevel(scheme.level)}`,
        `频率：每周 ${scheme.frequencyPerWeek} 练`,
        `周期：${scheme.durationWeeks} 周`,
        `结构：${scheme.dayStructure}`,
        scheme.description,
      ].join('\n'),
    );
  }, []);

  const openUseScheme = useCallback((scheme: SystemTrainingScheme) => {
    if (!scheme.isAvailable || !scheme.templatePlanId) {
      showComingSoon(scheme.title);
      return;
    }

    setSelectedScheme(scheme);
    setDraftPlanName(scheme.title.replace('方案', '计划'));
  }, []);

  const closeUseScheme = useCallback(() => {
    setSelectedScheme(null);
    setDraftPlanName('');
  }, []);

  const confirmUseSelectedScheme = useCallback(
    async (makeActive: boolean) => {
      if (!selectedScheme) {
        return;
      }

      setIsWorking(true);
      try {
        const plan = await repositories.planRepository.copySystemSchemeToUserPlan({
          scheme: selectedScheme,
          name: draftPlanName,
        });
        const nextUserPlans = await repositories.planRepository.listUserPlans();
        setUserPlans(nextUserPlans);

        if (makeActive && group) {
          const updated = await repositories.groupRepository.updateGroup(group.id, {
            activePlanId: plan.id,
            currentPhaseType: await resolvePhaseTypeForWeek(plan.id, 1),
            currentWeek: 1,
          });
          setGroup(updated);
          setActivePlan(plan);
        }

        closeUseScheme();
        Alert.alert(
          '已生成我的计划',
          makeActive
            ? `“${plan.name}”已复制并设为当前计划。`
            : `“${plan.name}”已复制到我的计划。`,
        );
      } catch (copyError) {
        Alert.alert('复制失败', copyError instanceof Error ? copyError.message : '使用系统方案失败。');
      } finally {
        setIsWorking(false);
      }
    },
    [closeUseScheme, draftPlanName, group, repositories, resolvePhaseTypeForWeek, selectedScheme],
  );

  const confirmDeletePlan = useCallback((plan: PlanTemplate) => {
    Alert.alert('确认删除计划？', `删除“${plan.name}”前需要确认。删除能力将在后续接入软删除策略。`, [
      { text: '取消', style: 'cancel' },
      { text: '开发中', style: 'destructive', onPress: () => showComingSoon('删除计划') },
    ]);
  }, []);

  const activePlanWeeks = activePlan?.durationWeeks ?? DEFAULT_CYCLE_WEEK_COUNT;
  const activePlanProgress = Math.min(100, Math.round((group?.currentWeek ?? 1) / activePlanWeeks * 100));

  return (
    <Screen
      headerRight={
        <Pressable accessibilityRole="button" onPress={() => showComingSoon('计划设置')} style={styles.iconButton}>
          <Ionicons color={colors.text} name="add-circle-outline" size={21} />
        </Pressable>
      }
      subtitle="当前计划、我的计划、系统方案、创建和导入。"
      title="计划"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

      {error ? <EmptyState title="计划暂时无法加载" description={error} /> : null}

      {!isLoading && !error && group ? (
        <>
          <VisualHeroCard
            eyebrow="当前计划"
            icon="clipboard-outline"
            imageSource={liftmarkImages.planHero}
            minHeight={230}
            subtitle={`第 ${group.currentWeek}/${activePlanWeeks} 周 · 当前阶段：${group.currentPhaseType}`}
            title={activePlan?.name ?? '还没有当前计划'}
          >
            <View style={styles.planMetaRow}>
              <Tag label={`${activePlan?.frequencyPerWeek ?? 0} 天/周`} tone="dark" />
              <Tag label={`${activePlanWeeks} 周周期`} tone="dark" />
              <Tag label={group.currentPhaseType} tone="dark" />
            </View>
            <View style={styles.progressTrackDark}>
              <View style={[styles.progressFill, { width: `${activePlanProgress}%` }]} />
            </View>
            <View style={styles.inlineActions}>
              <AppButton onPress={() => Alert.alert('当前默认计划', '当前计划会被训练页读取，已作为本地默认执行计划。')} size="sm">
                设为默认计划
              </AppButton>
              <AppButton onPress={() => showComingSoon('停用当前计划')} size="sm" variant="dark">
                停用当前计划
              </AppButton>
            </View>
          </VisualHeroCard>

          <View style={styles.weekControls}>
            <AppButton disabled={group.currentWeek <= 1} onPress={() => void saveWeek(group.currentWeek - 1)} size="sm" variant="secondary">
              上一周
            </AppButton>
            <AppButton disabled={group.currentWeek >= activePlanWeeks} onPress={() => void saveWeek(group.currentWeek + 1)} size="sm">
              下一周
            </AppButton>
          </View>

          <View style={styles.actionGrid}>
            <ActionCard icon="add-outline" label="创建计划" onPress={() => router.push('/plan/create')} />
            <ActionCard icon="download-outline" label="导入计划" onPress={() => void importPlan()} />
          </View>

          <SectionHeader subtitle="从空白创建、系统方案复制或文件导入后，都会出现在这里。" title="我的计划" />
          {userPlans.length === 0 ? (
            <EmptyState
              actionLabel="选择系统方案"
              description="你还没有自己的训练计划。可以从系统方案开始，也可以从空白创建。"
              onActionPress={() => showComingSoon('系统方案筛选')}
              title="你还没有自己的训练计划"
            />
          ) : (
            <View style={styles.list}>
              {userPlans.map((plan) => {
                const isActive = plan.id === group.activePlanId;
                return (
                  <AppCard key={plan.id} style={styles.planCard}>
                    <View style={styles.planRow}>
                      <View style={styles.planRowText}>
                        <AppText variant="subtitle">{plan.name}</AppText>
                        <AppText tone="muted" variant="caption">
                          {describePlanSource(plan.source)} · {plan.durationWeeks} 周 · 每周 {plan.frequencyPerWeek} 练
                        </AppText>
                      </View>
                      <Tag label={isActive ? '使用中' : '我的计划'} tone={isActive ? 'success' : 'neutral'} />
                    </View>
                    <View style={styles.inlineActions}>
                      <AppButton onPress={() => showComingSoon('编辑计划')} size="sm" variant="secondary">
                        编辑
                      </AppButton>
                      <AppButton disabled={isActive} onPress={() => void setCurrentPlan(plan)} size="sm">
                        设为当前计划
                      </AppButton>
                    </View>
                    <View style={styles.inlineActions}>
                      <AppButton onPress={() => void exportPlan(plan)} size="sm" variant="secondary">
                        导出计划
                      </AppButton>
                      <AppButton onPress={() => confirmDeletePlan(plan)} size="sm" variant="ghost">
                        更多
                      </AppButton>
                    </View>
                  </AppCard>
                );
              })}
            </View>
          )}

          <SectionHeader title="本周安排" />
          <AppCard style={styles.weekCard}>
            <View style={styles.weekRow}>
              <AppText variant="bodySmall" weight="900">
                周一到周四
              </AppText>
              <AppText tone="muted" variant="bodySmall">
                主训练日
              </AppText>
            </View>
            <View style={styles.weekRow}>
              <AppText variant="bodySmall" weight="900">
                周五补弱
              </AppText>
              <Pressable onPress={() => void toggleFriday()} style={styles.togglePill}>
                <AppText tone={group.fridayEnabled ? 'brand' : 'muted'} variant="caption">
                  {group.fridayEnabled ? '已开启' : '默认休息'}
                </AppText>
              </Pressable>
            </View>
          </AppCard>

          <SectionHeader subtitle="系统方案只是模板，点击使用后才会复制为我的计划。" title="系统方案" />
          <View style={styles.list}>
            {systemSchemes.map((scheme) => (
              <AppCard key={scheme.id} style={styles.schemeCard}>
                <View style={styles.planRow}>
                  <View style={styles.schemeIcon}>
                    <Ionicons color={colors.primary} name="barbell-outline" size={20} />
                  </View>
                  <View style={styles.planRowText}>
                    <AppText variant="subtitle">{scheme.title}</AppText>
                    <AppText tone="muted" variant="caption">
                      {scheme.subtitle}
                    </AppText>
                  </View>
                  <Tag label={scheme.isAvailable ? '完整可用' : '开发中'} tone={scheme.isAvailable ? 'success' : 'neutral'} />
                </View>
                <View style={styles.tagRow}>
                  <Tag label={describeSchemeGoal(scheme.goal)} tone="brand" />
                  <Tag label={describeSchemeLevel(scheme.level)} tone="accent" />
                  <Tag label={`每周 ${scheme.frequencyPerWeek} 练`} tone="neutral" />
                  <Tag label={`${scheme.durationWeeks} 周`} tone="neutral" />
                </View>
                <AppText tone="muted" variant="bodySmall">
                  {scheme.dayStructure}
                </AppText>
                <View style={styles.inlineActions}>
                  <AppButton onPress={() => openSchemeDetail(scheme)} size="sm" variant="secondary">
                    查看详情
                  </AppButton>
                  <AppButton disabled={!scheme.isAvailable} onPress={() => openUseScheme(scheme)} size="sm">
                    使用此方案
                  </AppButton>
                </View>
              </AppCard>
            ))}
          </View>

          {isWorking ? (
            <AppText tone="muted" variant="bodySmall">
              正在处理计划...
            </AppText>
          ) : null}
        </>
      ) : null}

      <Modal animationType="fade" transparent visible={Boolean(selectedScheme)} onRequestClose={closeUseScheme}>
        <View style={styles.modalBackdrop}>
          <AppCard style={styles.modalCard}>
            <AppText variant="title">复制为我的计划</AppText>
            <AppText tone="muted" variant="bodySmall">
              系统方案不会直接执行。确认后会生成一份可编辑、可记录的本地用户计划。
            </AppText>
            <TextInput
              onChangeText={setDraftPlanName}
              placeholder="计划名称"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={draftPlanName}
            />
            <View style={styles.modalButtons}>
              <AppButton onPress={closeUseScheme} variant="secondary">
                取消
              </AppButton>
              <AppButton onPress={() => void confirmUseSelectedScheme(false)} variant="secondary">
                复制为我的计划
              </AppButton>
              <AppButton onPress={() => void confirmUseSelectedScheme(true)}>复制并设为当前</AppButton>
            </View>
          </AppCard>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  currentCard: {
    gap: spacing.lg,
  },
  currentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  currentMain: {
    flex: 1,
    gap: spacing.xs,
  },
  progressTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  progressTrackDark: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: '100%',
  },
  planMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  weekControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  list: {
    gap: spacing.sm,
  },
  planCard: {
    gap: spacing.md,
  },
  planRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  planRowText: {
    flex: 1,
    gap: 2,
  },
  weekCard: {
    gap: spacing.sm,
  },
  weekRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  togglePill: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  schemeCard: {
    gap: spacing.md,
  },
  schemeIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: colors.overlay,
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    gap: spacing.md,
    maxWidth: 480,
    width: '100%',
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    color: colors.text,
    fontSize: typography.sizes.body,
    minHeight: 48,
    paddingHorizontal: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
});
