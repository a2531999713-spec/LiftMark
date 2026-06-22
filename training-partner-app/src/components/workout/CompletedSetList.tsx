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
      <View style={styles.itemTop}>
        <View style={styles.setItemBadge}>
          <AppText variant="caption" weight="900" style={styles.setItemBadgeText}>{set.setNumber}</AppText>
        </View>
        <View style={styles.setItemInfo}>
          <AppText variant="bodySmall" weight="800">{memberName}</AppText>
          <View style={styles.setItemValues}>
            <View style={styles.valueChip}>
              <AppText variant="caption" weight="900" style={styles.valueChipText}>
                {formatNumber(set.actualWeight ?? set.plannedWeight)} kg
              </AppText>
            </View>
            <AppText tone="muted" variant="caption">×</AppText>
            <View style={styles.valueChip}>
              <AppText variant="caption" weight="900" style={styles.valueChipText}>
                {set.actualReps ?? set.plannedReps ?? 0} 次
              </AppText>
            </View>
            {set.rpe !== undefined ? (
              <View style={[styles.valueChip, styles.rpeChip]}>
                <AppText variant="caption" weight="800" style={styles.rpeChipText}>RPE {formatNumber(set.rpe)}</AppText>
              </View>
            ) : null}
            {set.rir !== undefined ? (
              <View style={[styles.valueChip, styles.rirChip]}>
                <AppText variant="caption" weight="800" style={styles.rirChipText}>RIR {formatNumber(set.rir)}</AppText>
              </View>
            ) : null}
          </View>
        </View>
        <View style={styles.itemActions}>
          <Pressable accessibilityRole="button" onPress={toggleEdit} style={styles.editButton}>
            <Ionicons
              color={isEditing ? colors.brand : colors.darkMuted}
              name={isEditing ? 'checkmark-outline' : 'create-outline'}
              size={14}
            />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={handleDelete} style={styles.deleteButton}>
            <Ionicons color={colors.danger} name="trash-outline" size={14} />
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
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    gap: spacing.sm,
    padding: spacing.md,
  },
  itemTop: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  setItemBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  setItemBadgeText: {
    color: colors.surface,
  },
  setItemInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  setItemValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  valueChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  valueChipText: {
    color: colors.textStrong,
  },
  rpeChip: {
    backgroundColor: colors.primarySoft,
  },
  rpeChipText: {
    color: colors.primary,
  },
  rirChip: {
    backgroundColor: colors.accentSoft,
  },
  rirChipText: {
    color: colors.accent,
  },
  itemActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  editButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  deleteButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  editArea: {
    gap: spacing.sm,
  },
  editRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  editInput: {
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surface,
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
