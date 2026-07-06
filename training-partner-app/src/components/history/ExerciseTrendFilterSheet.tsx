import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppModalSheet, AppText, EmptyState, Tag } from '@/components/ui';
import type { Equipment, ExerciseCategory } from '@/domain/exercise/exercise.types';
import type { ExerciseTrendOption } from '@/features/history/shared/historyViewModel';
import { colors, radius, spacing, typography } from '@/theme';

type ExerciseTrendFilterSheetProps = {
  allowAllOption?: boolean;
  allOptionSubtitle?: string;
  allOptionTitle?: string;
  onClose: () => void;
  onSelect: (exerciseId: string | null) => void;
  options: ExerciseTrendOption[];
  selectedExerciseId: string | null;
  visible: boolean;
};

type CategoryFilter = 'all' | 'recent' | 'frequent' | ExerciseCategory | 'custom';
type EquipmentFilter = 'all' | Equipment;

const categoryFilters: { label: string; value: CategoryFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '最近练过', value: 'recent' },
  { label: '常用', value: 'frequent' },
  { label: '胸', value: 'chest' },
  { label: '背', value: 'back' },
  { label: '腿', value: 'legs' },
  { label: '肩', value: 'shoulder' },
  { label: '手臂', value: 'arms' },
  { label: '核心', value: 'core' },
  { label: '其他', value: 'custom' },
];

const equipmentFilters: { label: string; value: EquipmentFilter }[] = [
  { label: '全部器械', value: 'all' },
  { label: '杠铃', value: 'barbell' },
  { label: '哑铃', value: 'dumbbell' },
  { label: '固定器械', value: 'machine' },
  { label: '自重', value: 'bodyweight' },
  { label: '绳索', value: 'cable' },
];

export function ExerciseTrendFilterSheet({
  allowAllOption = true,
  allOptionSubtitle = '查看整体训练量和单日构成',
  allOptionTitle = '全部动作',
  onClose,
  onSelect,
  options,
  selectedExerciseId,
  visible,
}: ExerciseTrendFilterSheetProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [equipment, setEquipment] = useState<EquipmentFilter>('all');

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return options
      .filter((option) => {
        if (category === 'all') return true;
        if (category === 'recent') return option.isRecent;
        if (category === 'frequent') return option.recordCount >= 3;
        if (category === 'custom') return option.category === 'other' && option.recordCount > 0;
        return option.category === category;
      })
      .filter((option) => equipment === 'all' || option.equipment === equipment)
      .filter((option) => {
        if (!normalizedQuery) return true;
        return [option.name, option.targetMuscle, option.equipmentLabel]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      })
      .sort((left, right) => {
        if (left.isRecent !== right.isRecent) return left.isRecent ? -1 : 1;
        return right.recordCount - left.recordCount || left.name.localeCompare(right.name);
      });
  }, [category, equipment, options, query]);

  const choose = (exerciseId: string | null) => {
    onSelect(exerciseId);
    onClose();
    setQuery('');
  };

  return (
    <AppModalSheet
      contentStyle={styles.content}
      onClose={onClose}
      subtitle="搜索、按肌群或器械筛选，选择后图表和记录列表同步更新"
      title="选择趋势动作"
      visible={visible}
    >
      <View style={styles.searchBox}>
        <Ionicons color={colors.textMuted} name="search-outline" size={18} />
        <TextInput
          onChangeText={setQuery}
          placeholder="搜索动作、肌群或器械"
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
          value={query}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {categoryFilters.map((filter) => (
            <FilterChip
              active={category === filter.value}
              key={filter.value}
              label={filter.label}
              onPress={() => setCategory(filter.value)}
            />
          ))}
        </View>
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRow}>
          {equipmentFilters.map((filter) => (
            <FilterChip
              active={equipment === filter.value}
              key={filter.value}
              label={filter.label}
              onPress={() => setEquipment(filter.value)}
            />
          ))}
        </View>
      </ScrollView>

      {allowAllOption ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => choose(null)}
          style={[styles.optionRow, !selectedExerciseId && styles.optionRowActive]}
        >
          <View style={styles.optionIcon}>
            <Ionicons color={!selectedExerciseId ? colors.surface : colors.primary} name="apps-outline" size={18} />
          </View>
          <View style={styles.optionText}>
            <AppText variant="bodySmall" weight="900">
              {allOptionTitle}
            </AppText>
            <AppText tone="muted" variant="caption">
              {allOptionSubtitle}
            </AppText>
          </View>
          {!selectedExerciseId ? <Ionicons color={colors.primary} name="checkmark-circle" size={20} /> : null}
        </Pressable>
      ) : null}

      {filteredOptions.length === 0 ? (
        <EmptyState description="换一个肌群、器械或搜索词再试。" title="没有匹配动作" />
      ) : (
        <FlatList
          data={filteredOptions}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              onPress={() => choose(item.id)}
              style={({ pressed }) => [
                styles.optionRow,
                selectedExerciseId === item.id && styles.optionRowActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.optionIcon}>
                <Ionicons
                  color={selectedExerciseId === item.id ? colors.surface : colors.primary}
                  name="barbell-outline"
                  size={18}
                />
              </View>
              <View style={styles.optionText}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">
                  {item.name}
                </AppText>
                <AppText numberOfLines={1} tone="muted" variant="caption">
                  {item.targetMuscle || '目标肌群'} · {item.equipmentLabel} · {item.recordCount} 次记录
                  {item.lastTrainingDate ? ` · 最近 ${item.lastTrainingDate.slice(5).replace('-', '/')}` : ''}
                </AppText>
              </View>
              <View style={styles.tagColumn}>
                {item.isRecent ? <Tag label="最近" tone="brand" /> : null}
                {selectedExerciseId === item.id ? <Ionicons color={colors.primary} name="checkmark-circle" size={20} /> : null}
              </View>
            </Pressable>
          )}
          style={styles.list}
        />
      )}
    </AppModalSheet>
  );
}

function FilterChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <AppText tone={active ? 'inverse' : 'default'} variant="caption" weight="900">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.md,
  },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: spacing.md,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  list: {
    maxHeight: 390,
  },
  optionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  optionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.sm,
    minHeight: 74,
    padding: spacing.md,
  },
  optionRowActive: {
    borderColor: colors.primary,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.82,
  },
  searchBox: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
  },
  tagColumn: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
});
