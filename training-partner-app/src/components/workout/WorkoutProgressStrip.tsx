import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type ExerciseProgressItem = {
  id: string;
  name: string;
  status: 'completed' | 'current' | 'upcoming';
};

type WorkoutProgressStripProps = {
  currentIndex: number;
  exercises: ExerciseProgressItem[];
  mode?: 'card' | 'dock';
  onJumpToExercise?: (index: number) => void;
};

export function WorkoutProgressStrip({
  currentIndex,
  exercises,
  mode = 'card',
  onJumpToExercise,
}: WorkoutProgressStripProps) {
  if (exercises.length === 0) {
    return null;
  }

  const completedCount = exercises.filter((e) => e.status === 'completed').length;

  if (mode === 'dock') {
    return (
      <View style={styles.dock}>
        <View style={styles.dockHeader}>
          <AppText variant="caption" weight="800">
            训练进度
          </AppText>
          <AppText tone="brand" variant="caption" weight="900">
            {currentIndex + 1}/{exercises.length}
          </AppText>
        </View>
        <View style={styles.dockProgress}>
          <View style={styles.dockTrack}>
            <View style={[styles.dockFill, { width: `${((currentIndex + 1) / exercises.length) * 100}%` }]} />
          </View>
        </View>
        <View style={styles.dockExercises}>
          {exercises.map((exercise, index) => {
            const isCompleted = exercise.status === 'completed';
            const isCurrent = exercise.status === 'current';

            return (
              <Pressable
                accessibilityRole="button"
                disabled={!onJumpToExercise || isCurrent}
                key={exercise.id}
                onPress={() => onJumpToExercise?.(index)}
                style={[styles.dockExercise, isCurrent && styles.dockExerciseCurrent]}
              >
                <View style={[styles.dockExerciseDot, isCompleted && styles.dockExerciseDotCompleted, isCurrent && styles.dockExerciseDotCurrent]} />
                <AppText
                  numberOfLines={1}
                  variant="caption"
                  weight={isCurrent ? '800' : '400'}
                  style={[styles.dockExerciseName, isCurrent && styles.dockExerciseNameCurrent]}
                >
                  {exercise.name}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="subtitle" weight="900">训练动作</AppText>
        <AppText tone="brand" variant="caption" weight="800">
          {completedCount}/{exercises.length} 完成
        </AppText>
      </View>
      <View style={styles.exerciseList}>
        {exercises.map((exercise, index) => {
          const isCompleted = exercise.status === 'completed';
          const isCurrent = exercise.status === 'current';

          return (
            <Pressable
              accessibilityRole="button"
              disabled={!onJumpToExercise || isCurrent}
              key={exercise.id}
              onPress={() => onJumpToExercise?.(index)}
              style={[
                styles.exerciseCard,
                isCompleted && styles.exerciseCardCompleted,
                isCurrent && styles.exerciseCardCurrent,
              ]}
            >
              <View style={[styles.exerciseIndex, isCompleted && styles.exerciseIndexCompleted, isCurrent && styles.exerciseIndexCurrent]}>
                {isCompleted ? (
                  <Ionicons color={colors.surface} name="checkmark" size={12} />
                ) : (
                  <AppText variant="caption" weight="900" style={[styles.exerciseIndexText, isCurrent && styles.exerciseIndexTextCurrent]}>
                    {index + 1}
                  </AppText>
                )}
              </View>
              <AppText
                numberOfLines={1}
                variant="bodySmall"
                weight={isCurrent ? '900' : '700'}
                style={[styles.exerciseName, isCurrent && styles.exerciseNameCurrent]}
              >
                {exercise.name}
              </AppText>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <AppText variant="caption" weight="800" style={styles.currentBadgeText}>当前</AppText>
                </View>
              )}
              {isCompleted && (
                <Ionicons color={colors.success} name="checkmark-circle" size={16} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  exerciseCardCompleted: {
    backgroundColor: colors.surfaceMuted,
    opacity: 0.7,
  },
  exerciseCardCurrent: {
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  exerciseIndex: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
  },
  exerciseIndexCompleted: {
    backgroundColor: colors.success,
  },
  exerciseIndexCurrent: {
    backgroundColor: colors.primary,
  },
  exerciseIndexText: {
    color: colors.textMuted,
  },
  exerciseIndexTextCurrent: {
    color: colors.surface,
  },
  exerciseName: {
    flex: 1,
    color: colors.textMuted,
  },
  exerciseNameCurrent: {
    color: colors.textStrong,
  },
  currentBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  currentBadgeText: {
    color: colors.surface,
  },

  dock: {
    gap: spacing.sm,
  },
  dockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dockProgress: {
    gap: spacing.xs,
  },
  dockTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 4,
    overflow: 'hidden',
  },
  dockFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  dockExercises: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dockExercise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  dockExerciseCurrent: {
    backgroundColor: colors.primarySoft,
  },
  dockExerciseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.border,
  },
  dockExerciseDotCompleted: {
    backgroundColor: colors.success,
  },
  dockExerciseDotCurrent: {
    backgroundColor: colors.primary,
  },
  dockExerciseName: {
    color: colors.textMuted,
    maxWidth: 80,
  },
  dockExerciseNameCurrent: {
    color: colors.primary,
  },
});
