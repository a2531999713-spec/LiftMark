import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppButton, AppCard, AppText, Tag } from '@/components/ui';
import type { ExercisePriority } from '@/domain/plan/plan.types';
import { colors, radius, spacing } from '@/theme';

import type { PlanExerciseDraft, PlanExerciseMap } from './planEditTypes';

type PlanExerciseEditorProps = {
  canMoveDown: boolean;
  canMoveUp: boolean;
  exercise: PlanExerciseDraft;
  exerciseMap: PlanExerciseMap;
  onChange: (patch: Partial<PlanExerciseDraft>) => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onRemove: () => void;
};

const priorities: ExercisePriority[] = ['A', 'B', 'C'];

export function PlanExerciseEditor({
  canMoveDown,
  canMoveUp,
  exercise,
  exerciseMap,
  onChange,
  onMoveDown,
  onMoveUp,
  onRemove,
}: PlanExerciseEditorProps) {
  const detail = exerciseMap[exercise.exerciseId];

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.orderBadge}>
          <AppText tone="inverse" variant="caption" weight="900">
            {exercise.orderIndex + 1}
          </AppText>
        </View>
        <View style={styles.titleBlock}>
          <AppText numberOfLines={1} variant="bodySmall" weight="900">
            {detail?.name ?? '训练动作'}
          </AppText>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {detail ? `${detail.targetMuscle} · ${detail.equipment}` : '动作库'}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={onRemove} style={styles.iconButton}>
          <Ionicons color={colors.danger} name="trash-outline" size={18} />
        </Pressable>
      </View>

      <View style={styles.controlGrid}>
        <Stepper label="组数" onChange={(sets) => onChange({ sets })} value={exercise.sets} />
        <Stepper label="次数" onChange={(reps) => onChange({ reps })} value={exercise.reps} />
      </View>

      <View style={styles.footer}>
        <View style={styles.priorityRow}>
          {priorities.map((priority) => (
            <Pressable
              accessibilityRole="button"
              key={priority}
              onPress={() => onChange({ priority })}
              style={[styles.priorityChip, exercise.priority === priority && styles.priorityChipActive]}
            >
              <AppText tone={exercise.priority === priority ? 'inverse' : 'muted'} variant="caption" weight="900">
                {priority}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.moveRow}>
          <Tag label={`${exercise.sets}x${exercise.reps}`} tone="neutral" />
          <AppButton disabled={!canMoveUp} onPress={onMoveUp} size="sm" variant="ghost">
            上移
          </AppButton>
          <AppButton disabled={!canMoveDown} onPress={onMoveDown} size="sm" variant="ghost">
            下移
          </AppButton>
        </View>
      </View>
    </AppCard>
  );
}

function Stepper({
  label,
  onChange,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  value: number;
}) {
  return (
    <View style={styles.stepper}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" onPress={() => onChange(Math.max(1, value - 1))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="remove-outline" size={18} />
        </Pressable>
        <AppText variant="bodySmall" weight="900">
          {value}
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => onChange(value + 1)} style={styles.stepButton}>
          <Ionicons color={colors.text} name="add-outline" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  controlGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  footer: {
    gap: spacing.sm,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  moveRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  orderBadge: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  priorityChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 44,
  },
  priorityChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  stepper: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
});
