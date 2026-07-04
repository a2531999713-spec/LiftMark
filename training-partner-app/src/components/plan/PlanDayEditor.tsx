import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, SectionHeader } from '@/components/ui';
import type { Weekday } from '@/domain/plan/plan.types';
import { colors, radius, spacing, typography } from '@/theme';

import { PlanExerciseEditor } from './PlanExerciseEditor';
import type { PlanDayDraft, PlanExerciseDraft, PlanExerciseMap } from './planEditTypes';

type PlanDayEditorProps = {
  day: PlanDayDraft;
  exerciseMap: PlanExerciseMap;
  isSaving: boolean;
  onAddExercise: () => void;
  onChangeDay: (patch: Partial<PlanDayDraft>) => void;
  onChangeExercise: (exerciseId: string, patch: Partial<PlanExerciseDraft>) => void;
  onCopyPreviousExerciseParams: () => void;
  onMoveExercise: (exerciseId: string, direction: 'up' | 'down') => void;
  onRemoveExercise: (exerciseId: string) => void;
  onSave: () => void;
};

export function PlanDayEditor({
  day,
  exerciseMap,
  isSaving,
  onAddExercise,
  onChangeDay,
  onChangeExercise,
  onCopyPreviousExerciseParams,
  onMoveExercise,
  onRemoveExercise,
  onSave,
}: PlanDayEditorProps) {
  return (
    <>
      <AppCard style={styles.card} tone="brand">
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <Ionicons color={colors.primary} name="calendar-outline" size={22} />
          </View>
          <View style={styles.heroText}>
            <AppText variant="subtitle">{day.title}</AppText>
            <AppText tone="muted" variant="bodySmall">
              第 {day.week} 周 · 星期 {day.weekday} · {day.exercises.length} 个动作
            </AppText>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader title="训练日信息" />
        <Field label="训练日名称" onChangeText={(title) => onChangeDay({ title })} value={day.title} />
        <Field label="训练重点" onChangeText={(focus) => onChangeDay({ focus })} value={day.focus} />
        <View style={styles.fieldGrid}>
          <NumberField label="周次" onChange={(week) => onChangeDay({ week })} value={day.week} />
          <NumberField
            label="星期"
            max={7}
            onChange={(weekday) => onChangeDay({ weekday: weekday as Weekday })}
            value={day.weekday}
          />
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader subtitle="每个动作可单独设置组数、次数和优先级。" title="动作" />
        <View style={styles.actionRow}>
          <AppButton icon="add-outline" onPress={onAddExercise} size="sm">
            添加动作
          </AppButton>
          <AppButton icon="copy-outline" onPress={onCopyPreviousExerciseParams} size="sm" variant="secondary">
            复制上一动作参数
          </AppButton>
        </View>
        {day.exercises.length === 0 ? (
          <EmptyState actionLabel="添加动作" description="先添加一个动作，再保存训练日。" onActionPress={onAddExercise} title="还没有动作" />
        ) : (
          <View style={styles.exerciseList}>
            {day.exercises.map((exercise, index) => (
              <PlanExerciseEditor
                canMoveDown={index < day.exercises.length - 1}
                canMoveUp={index > 0}
                exercise={exercise}
                exerciseMap={exerciseMap}
                key={exercise.id}
                onChange={(patch) => onChangeExercise(exercise.id, patch)}
                onMoveDown={() => onMoveExercise(exercise.id, 'down')}
                onMoveUp={() => onMoveExercise(exercise.id, 'up')}
                onRemove={() => onRemoveExercise(exercise.id)}
              />
            ))}
          </View>
        )}
      </AppCard>

      <AppButton disabled={isSaving} icon="save-outline" loading={isSaving} onPress={onSave} size="lg">
        保存训练日
      </AppButton>
    </>
  );
}

function Field({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput onChangeText={onChangeText} style={styles.input} value={value} />
    </View>
  );
}

function NumberField({
  label,
  max,
  onChange,
  value,
}: {
  label: string;
  max?: number;
  onChange: (value: number) => void;
  value: number;
}) {
  const nextValue = (value: number) => (max ? Math.min(max, Math.max(1, value)) : Math.max(1, value));
  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" onPress={() => onChange(nextValue(value - 1))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="remove-outline" size={18} />
        </Pressable>
        <AppText variant="bodySmall" weight="900">
          {value}
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => onChange(nextValue(value + 1))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="add-outline" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  card: {
    gap: spacing.md,
  },
  exerciseList: {
    gap: spacing.sm,
  },
  field: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: '46%',
    padding: spacing.md,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 30,
    padding: 0,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
