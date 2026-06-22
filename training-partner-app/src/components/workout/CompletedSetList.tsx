import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { SaveWorkoutSetInput, WorkoutSet } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

const rpeOptions = [6, 7, 8, 9, 10];
const rirOptions = [0, 1, 2, 3, 4, 5];

function formatNumber(value: number | undefined, fallback = '0'): string {
  if (value === undefined) {
    return fallback;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

type CompletedSetItemProps = {
  memberName: string;
  onDelete: () => void;
  onSavePatch: (patch: Omit<SaveWorkoutSetInput, 'id'>) => void;
  set: WorkoutSet;
};

function CompletedSetItem({ memberName, onDelete, onSavePatch, set }: CompletedSetItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(set.notes ?? '');
  const [editWeight, setEditWeight] = useState(formatNumber(set.actualWeight ?? set.plannedWeight));
  const [editReps, setEditReps] = useState(formatNumber(set.actualReps ?? set.plannedReps));
  const [editRpe, setEditRpe] = useState(set.rpe);
  const [editRir, setEditRir] = useState(set.rir);

  function toggleEdit() {
    if (isEditing) {
      onSavePatch({
        actualWeight: parseFloat(editWeight) || (set.actualWeight ?? set.plannedWeight),
        actualReps: parseInt(editReps, 10) || (set.actualReps ?? set.plannedReps),
        rpe: editRpe,
        rir: editRir,
        notes: notesDraft.trim() || undefined,
      });
    }
    setIsEditing((current) => !current);
  }

  function handleDelete() {
    Alert.alert('删除已完成组', `确定删除第 ${set.setNumber} 组记录吗？`, [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: onDelete },
    ]);
  }

  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <View style={styles.itemInfo}>
          <View style={styles.itemTitleRow}>
            <AppText variant="bodySmall" weight="800">
              {set.setNumber} 组
            </AppText>
            <AppText tone="brand" variant="caption" weight="900">
              {memberName}
            </AppText>
          </View>
          <AppText tone="muted" variant="caption">
            {formatNumber(set.actualWeight ?? set.plannedWeight)} kg × {set.actualReps ?? set.plannedReps ?? 0}
            {set.rpe !== undefined ? ` · RPE ${formatNumber(set.rpe)}` : ''}
            {set.rir !== undefined ? ` · RIR ${formatNumber(set.rir)}` : ''}
          </AppText>
        </View>
        <View style={styles.itemActions}>
          <Pressable accessibilityRole="button" onPress={toggleEdit} style={styles.editButton}>
            <Ionicons
              color={isEditing ? colors.brand : colors.darkMuted}
              name={isEditing ? 'checkmark-outline' : 'create-outline'}
              size={16}
            />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleDelete} style={styles.deleteButton}>
            <Ionicons color={colors.danger} name="trash-outline" size={16} />
          </Pressable>
        </View>
      </View>
      {isEditing ? (
        <View style={styles.editArea}>
          <View style={styles.editRow}>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setEditWeight}
              placeholder="重量"
              placeholderTextColor={colors.textMuted}
              style={styles.editInput}
              value={editWeight}
            />
            <TextInput
              keyboardType="number-pad"
              onChangeText={setEditReps}
              placeholder="次数"
              placeholderTextColor={colors.textMuted}
              style={styles.editInput}
              value={editReps}
            />
          </View>
          <View style={styles.editOptionRow}>
            {rpeOptions.map((option) => {
              const isActive = editRpe === option;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={`rpe-${option}`}
                  onPress={() => setEditRpe(isActive ? undefined : option)}
                  style={[styles.editPill, isActive && styles.editPillActive]}
                >
                  <AppText tone={isActive ? 'inverse' : 'muted'} variant="caption" weight="800">
                    {option}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.editOptionRow}>
            {rirOptions.map((option) => {
              const isActive = editRir === option;
              return (
                <Pressable
                  accessibilityRole="button"
                  key={`rir-${option}`}
                  onPress={() => setEditRir(isActive ? undefined : option)}
                  style={[styles.editPill, isActive && styles.editPillActive]}
                >
                  <AppText tone={isActive ? 'inverse' : 'muted'} variant="caption" weight="800">
                    {option}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

type CompletedSetListProps = {
  completedSets: WorkoutSet[];
  memberNameMap: Map<string, string>;
  onUndoLatestRound: () => void;
  onDeleteSet: (setId: string) => void;
  onSavePatch: (set: WorkoutSet, patch: Omit<SaveWorkoutSetInput, 'id'>) => void;
};

export function CompletedSetList({
  completedSets,
  memberNameMap,
  onUndoLatestRound,
  onDeleteSet,
  onSavePatch,
}: CompletedSetListProps) {
  if (completedSets.length === 0) {
    return null;
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons color={colors.success} name="checkmark-circle-outline" size={16} />
          <AppText variant="bodySmall" weight="700">
            已完成组
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={onUndoLatestRound} style={styles.undoButton}>
          <Ionicons color={colors.textMuted} name="arrow-undo-outline" size={14} />
          <AppText tone="muted" variant="caption">
            撤销
          </AppText>
        </Pressable>
      </View>
      {completedSets.map((set) => (
        <CompletedSetItem
          key={set.id}
          memberName={memberNameMap.get(set.memberId) ?? '成员'}
          onDelete={() => onDeleteSet(set.id)}
          onSavePatch={(patch) => onSavePatch(set, patch)}
          set={set}
        />
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  undoButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  item: {
    borderColor: colors.border,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.sm,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  editArea: {
    gap: spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    color: colors.textStrong,
    flex: 1,
    fontSize: 14,
    height: 36,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  editOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  editPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    minWidth: 36,
    paddingHorizontal: spacing.xs,
  },
  editPillActive: {
    backgroundColor: colors.brand,
  },
});
