import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppText, EmptyState, Screen, SectionHeader } from '@/components/ui';
import { initializeLocalDatabase, createLocalRepositories } from '@/data/local';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';
import { SystemSchemeCard } from '@/features/plan-library/SystemSchemeCard';
import {
  defaultSystemPlanLibraryFilters,
  filterSystemPlanLibrary,
  sortSystemPlanLibrary,
  type SystemPlanEquipmentFilter,
  type SystemPlanFrequencyFilter,
  type SystemPlanGoalFilter,
  type SystemPlanLevelFilter,
} from '@/features/plan-library/systemPlanLibrary';
import { findExistingSystemSchemeCopy } from '@/features/plan-library/systemSchemeCopyService';
import { colors, radius, spacing } from '@/theme';
import type { PlanTemplate } from '@/domain/plan/plan.types';

const goalOptions: { label: string; value: SystemPlanGoalFilter }[] = [
  { label: '全部', value: 'all' }, { label: '增肌', value: 'hypertrophy' },
  { label: '力量', value: 'strength' }, { label: '减脂', value: 'fat_loss' },
  { label: '通用', value: 'general' },
];
const frequencyOptions: { label: string; value: SystemPlanFrequencyFilter }[] = [
  { label: '全部', value: 'all' }, { label: '2 天', value: '2' }, { label: '3 天', value: '3' },
  { label: '4 天', value: '4' }, { label: '其他', value: 'other' },
];
const levelOptions: { label: string; value: SystemPlanLevelFilter }[] = [
  { label: '全部', value: 'all' }, { label: '新手', value: 'beginner' },
  { label: '进阶', value: 'intermediate' }, { label: '通用', value: 'general' },
];
const equipmentOptions: { label: string; value: SystemPlanEquipmentFilter }[] = [
  { label: '全部', value: 'all' }, { label: '健身房', value: 'gym' },
  { label: '居家哑铃', value: 'home_dumbbell' },
];

export default function SystemPlanLibraryRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const schemes = useMemo(() => listSystemTrainingSchemes(), []);
  const [filters, setFilters] = useState(defaultSystemPlanLibraryFilters);
  const [userPlans, setUserPlans] = useState<PlanTemplate[]>([]);

  useFocusEffect(useCallback(() => {
    let cancelled = false;
    void (async () => {
      await initializeLocalDatabase();
      const plans = await repositories.planRepository.listUserPlans();
      if (!cancelled) setUserPlans(plans);
    })();
    return () => { cancelled = true; };
  }, [repositories]));

  const filtered = useMemo(() => {
    const catalogOrder = schemes.map((scheme) => scheme.id);
    return sortSystemPlanLibrary(filterSystemPlanLibrary(schemes, filters), catalogOrder);
  }, [filters, schemes]);
  const recommended = filtered.filter((scheme) => scheme.isAvailable && scheme.isRecommended).slice(0, 2);
  const recommendedIds = new Set(recommended.map((scheme) => scheme.id));
  const available = filtered.filter((scheme) => scheme.isAvailable && !recommendedIds.has(scheme.id));
  const unavailable = filtered.filter((scheme) => !scheme.isAvailable);

  const openScheme = (schemeId: string) => {
    router.push({ pathname: '/plan/scheme/[schemeId]', params: { schemeId } } as never);
  };

  return (
    <Screen title="推荐计划库" subtitle="先看完整结构，再复制成自己的训练计划。">
      <TextInput
        accessibilityLabel="搜索系统训练方案"
        onChangeText={(query) => setFilters((current) => ({ ...current, query }))}
        placeholder="搜索计划名称或标签"
        placeholderTextColor={colors.textSubtle}
        style={styles.search}
        value={filters.query}
      />
      <View style={styles.filters}>
        <FilterRow label="目标" options={goalOptions} value={filters.goal} onChange={(goal) => setFilters((current) => ({ ...current, goal }))} />
        <FilterRow label="频率" options={frequencyOptions} value={filters.frequency} onChange={(frequency) => setFilters((current) => ({ ...current, frequency }))} />
        <FilterRow label="水平" options={levelOptions} value={filters.level} onChange={(level) => setFilters((current) => ({ ...current, level }))} />
        <FilterRow label="器械" options={equipmentOptions} value={filters.equipment} onChange={(equipment) => setFilters((current) => ({ ...current, equipment }))} />
      </View>

      {filtered.length === 0 ? (
        <EmptyState
          title="没有符合条件的方案"
          description="换一个训练目标、频率或器械条件再看看。"
          actionLabel="清除筛选"
          onActionPress={() => setFilters(defaultSystemPlanLibraryFilters)}
        />
      ) : null}

      {recommended.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="优先推荐" subtitle="从当前可用目录中优先展示两套稳定方案。" />
          {recommended.map((scheme) => (
            <SystemSchemeCard
              copiedPlan={findExistingSystemSchemeCopy(userPlans, scheme.id)}
              key={scheme.id}
              onPress={() => openScheme(scheme.id)}
              recommendationReason={scheme.recommendationReason}
              scheme={scheme}
            />
          ))}
        </View>
      ) : null}

      {available.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="全部可用" subtitle="可查看每周训练日、动作处方和预计时长。" />
          {available.map((scheme) => (
            <SystemSchemeCard copiedPlan={findExistingSystemSchemeCopy(userPlans, scheme.id)} key={scheme.id} onPress={() => openScheme(scheme.id)} scheme={scheme} />
          ))}
        </View>
      ) : null}

      {unavailable.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="仍在完善" subtitle="可以查看说明，但不能复制到我的计划。" />
          {unavailable.map((scheme) => <SystemSchemeCard key={scheme.id} onPress={() => openScheme(scheme.id)} scheme={scheme} />)}
        </View>
      ) : null}
      <AppButton onPress={() => router.back()} variant="ghost">返回计划页</AppButton>
    </Screen>
  );
}

function FilterRow<T extends string>({ label, onChange, options, value }: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.filterRow}>
      <AppText style={styles.filterLabel} variant="caption" weight="800">{label}</AppText>
      <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
        {options.map((option, index) => {
          const selected = option.value === value;
          return (
            <Pressable key={`${option.value}-${index}`} onPress={() => onChange(option.value)} style={[styles.chip, selected && styles.chipSelected]}>
              <AppText tone={selected ? 'inverse' : 'muted'} variant="caption">{option.label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipSelected: { backgroundColor: colors.dark },
  chips: { gap: spacing.sm, paddingRight: spacing.lg },
  filterLabel: { width: 38 },
  filterRow: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  filters: { gap: spacing.sm },
  search: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.md, borderWidth: 1, color: colors.text, fontSize: 15, minHeight: 48, paddingHorizontal: spacing.lg },
  section: { gap: spacing.md },
});
