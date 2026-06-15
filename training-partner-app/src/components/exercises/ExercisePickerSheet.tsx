import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import type {
  CreateCustomExerciseInput,
} from '@/data/repositories/exerciseRepository';
import type {
  Equipment,
  Exercise,
  ExerciseCategory,
  ExerciseSource,
} from '@/domain/exercise/exercise.types';
import { colors, radius, spacing, typography } from '@/theme';

import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Tag } from '../ui';

type ExercisePickerSheetProps = {
  exercises: Exercise[];
  onClose: () => void;
  onCreateCustomExercise: (input: CreateCustomExerciseInput) => Promise<Exercise>;
  onSelect: (exercise: Exercise) => void;
  selectedExerciseIds?: string[];
  title?: string;
  visible: boolean;
};

type SourceFilter = ExerciseSource | 'all';

const sourceFilters: { label: string; value: SourceFilter }[] = [
  { label: '全部', value: 'all' },
  { label: '系统动作', value: 'system' },
  { label: '我的动作', value: 'custom' },
];

const categoryOptions: { label: string; value: ExerciseCategory }[] = [
  { label: '胸', value: 'chest' },
  { label: '背', value: 'back' },
  { label: '肩', value: 'shoulder' },
  { label: '腿', value: 'legs' },
  { label: '手臂', value: 'arms' },
  { label: '核心', value: 'core' },
  { label: '小腿', value: 'calves' },
  { label: '全身', value: 'full_body' },
  { label: '其他', value: 'other' },
];

const equipmentOptions: { label: string; value: Equipment }[] = [
  { label: '杠铃', value: 'barbell' },
  { label: '哑铃', value: 'dumbbell' },
  { label: '器械', value: 'machine' },
  { label: '绳索', value: 'cable' },
  { label: '自重', value: 'bodyweight' },
  { label: '史密斯', value: 'smith' },
  { label: '其他', value: 'other' },
];

const categoryLabels = Object.fromEntries(categoryOptions.map((item) => [item.value, item.label])) as Record<ExerciseCategory, string>;
const equipmentLabels = Object.fromEntries(equipmentOptions.map((item) => [item.value, item.label])) as Record<Equipment, string>;

export function ExercisePickerSheet({
  exercises,
  onClose,
  onCreateCustomExercise,
  onSelect,
  selectedExerciseIds = [],
  title = '选择动作',
  visible,
}: ExercisePickerSheetProps) {
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<SourceFilter>('all');
  const [category, setCategory] = useState<ExerciseCategory | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [isCreateVisible, setCreateVisible] = useState(false);

  const filteredExercises = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return exercises
      .filter((exercise) => source === 'all' || exercise.source === source)
      .filter((exercise) => category === 'all' || exercise.category === category)
      .filter((exercise) => equipment === 'all' || exercise.equipment === equipment)
      .filter((exercise) => {
        if (!normalizedQuery) {
          return true;
        }

        return [exercise.name, exercise.targetMuscle, exercise.secondaryMuscle, exercise.equipment]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(normalizedQuery));
      });
  }, [category, equipment, exercises, query, source]);

  return (
    <>
      <AppModalSheet
        contentStyle={styles.sheetContent}
        onClose={onClose}
        subtitle="搜索系统动作和我的动作，也可以快速新建自定义动作。"
        title={title}
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
            {sourceFilters.map((item) => (
              <FilterChip
                active={source === item.value}
                key={item.value}
                label={item.label}
                onPress={() => setSource(item.value)}
              />
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            <FilterChip active={category === 'all'} label="全部肌群" onPress={() => setCategory('all')} />
            {categoryOptions.map((item) => (
              <FilterChip
                active={category === item.value}
                key={item.value}
                label={item.label}
                onPress={() => setCategory(item.value)}
              />
            ))}
          </View>
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.filterRow}>
            <FilterChip active={equipment === 'all'} label="全部器械" onPress={() => setEquipment('all')} />
            {equipmentOptions.map((item) => (
              <FilterChip
                active={equipment === item.value}
                key={item.value}
                label={item.label}
                onPress={() => setEquipment(item.value)}
              />
            ))}
          </View>
        </ScrollView>

        <AppButton icon="add-outline" onPress={() => setCreateVisible(true)} variant="secondary">
          快速新建动作
        </AppButton>

        {filteredExercises.length === 0 ? (
          <EmptyState
            actionLabel="新建动作"
            description="没有找到匹配动作，可以快速创建一个自定义动作。"
            onActionPress={() => setCreateVisible(true)}
            title="暂无匹配动作"
          />
        ) : (
          <ScrollView style={styles.exerciseScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.exerciseList}>
              {filteredExercises.map((exercise) => {
                const active = selectedExerciseIds.includes(exercise.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={exercise.id}
                    onPress={() => onSelect(exercise)}
                    style={({ pressed }) => [
                      styles.exerciseRow,
                      active && styles.exerciseRowActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.exerciseIcon}>
                      <Ionicons color={active ? colors.surface : colors.primary} name="barbell-outline" size={18} />
                    </View>
                    <View style={styles.exerciseText}>
                      <AppText numberOfLines={1} variant="bodySmall" weight="900">
                        {exercise.name}
                      </AppText>
                      <AppText numberOfLines={1} tone="muted" variant="caption">
                        {exercise.targetMuscle} · {equipmentLabels[exercise.equipment]}
                      </AppText>
                    </View>
                    <View style={styles.exerciseTags}>
                      <Tag label={exercise.source === 'custom' ? '自定义' : '系统'} tone={exercise.source === 'custom' ? 'brand' : 'neutral'} />
                      {active ? <Tag label="已选" tone="success" /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        )}
      </AppModalSheet>

      <CreateCustomExerciseSheet
        onClose={() => setCreateVisible(false)}
        onCreate={async (input) => {
          const exercise = await onCreateCustomExercise(input);
          setCreateVisible(false);
          onSelect(exercise);
        }}
        visible={isCreateVisible}
      />
    </>
  );
}

function CreateCustomExerciseSheet({
  onClose,
  onCreate,
  visible,
}: {
  onClose: () => void;
  onCreate: (input: CreateCustomExerciseInput) => Promise<void>;
  visible: boolean;
}) {
  const [name, setName] = useState('');
  const [targetMuscle, setTargetMuscle] = useState('');
  const [category, setCategory] = useState<ExerciseCategory>('other');
  const [equipment, setEquipment] = useState<Equipment>('other');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const save = async () => {
    setIsSaving(true);
    setError(null);

    try {
      await onCreate({
        category,
        equipment,
        movementPattern: 'other',
        name,
        notes,
        targetMuscle,
      });
      setName('');
      setTargetMuscle('');
      setCategory('other');
      setEquipment('other');
      setNotes('');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '新建动作失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppModalSheet
      onClose={onClose}
      position="center"
      subtitle="第一版只保存名称、主要肌群、器械和备注。后续可继续完善动作库。"
      title="新建自定义动作"
      visible={visible}
    >
      <View style={styles.formGrid}>
        <InputBlock label="动作名称" onChangeText={setName} placeholder="例如 单臂绳索划船" value={name} />
        <InputBlock label="主要肌群" onChangeText={setTargetMuscle} placeholder="例如 背部" value={targetMuscle} />
      </View>

      <View style={styles.optionBlock}>
        <AppText tone="muted" variant="caption">
          肌群
        </AppText>
        <View style={styles.filterRowWrap}>
          {categoryOptions.map((item) => (
            <FilterChip
              active={category === item.value}
              key={item.value}
              label={item.label}
              onPress={() => setCategory(item.value)}
            />
          ))}
        </View>
      </View>

      <View style={styles.optionBlock}>
        <AppText tone="muted" variant="caption">
          器械
        </AppText>
        <View style={styles.filterRowWrap}>
          {equipmentOptions.map((item) => (
            <FilterChip
              active={equipment === item.value}
              key={item.value}
              label={item.label}
              onPress={() => setEquipment(item.value)}
            />
          ))}
        </View>
      </View>

      <InputBlock multiline label="备注" onChangeText={setNotes} placeholder="可选，例如动作要点或替代说明" value={notes} />

      {error ? (
        <AppCard style={styles.errorCard} tone="soft">
          <AppText tone="danger" variant="caption">
            {error}
          </AppText>
        </AppCard>
      ) : null}

      <View style={styles.modalButtons}>
        <AppButton onPress={onClose} variant="secondary">
          取消
        </AppButton>
        <AppButton disabled={isSaving} onPress={() => void save()}>
          {isSaving ? '保存中...' : '保存并选择'}
        </AppButton>
      </View>
    </AppModalSheet>
  );
}

function FilterChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.filterChip, active && styles.filterChipActive]}>
      <AppText tone={active ? 'inverse' : 'default'} variant="caption" weight="900">
        {label}
      </AppText>
    </Pressable>
  );
}

function InputBlock({
  label,
  multiline = false,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  multiline?: boolean;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <View style={styles.inputBlock}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={[styles.input, multiline && styles.multilineInput]}
        value={value}
      />
    </View>
  );
}

export function formatExerciseCategory(category: ExerciseCategory): string {
  return categoryLabels[category];
}

export function formatExerciseEquipment(equipment: Equipment): string {
  return equipmentLabels[equipment];
}

const styles = StyleSheet.create({
  errorCard: {
    padding: spacing.md,
  },
  exerciseIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  exerciseList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 74,
    padding: spacing.md,
  },
  exerciseRowActive: {
    borderColor: colors.primary,
  },
  exerciseScroll: {
    maxHeight: 360,
  },
  exerciseTags: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  filterChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
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
  filterRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  formGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 30,
    padding: 0,
  },
  inputBlock: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: '46%',
    padding: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  multilineInput: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  optionBlock: {
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
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
  sheetContent: {
    gap: spacing.md,
  },
});
