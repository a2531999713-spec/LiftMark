import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
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
            本次训练进度
          </AppText>
          <AppText tone="brand" variant="caption" weight="900">
            {currentIndex + 1} / {exercises.length}
          </AppText>
        </View>
        <View style={styles.dockNodes}>
          {exercises.map((exercise, index) => {
            const isCompleted = exercise.status === 'completed';
            const isCurrent = exercise.status === 'current';

            return (
              <Pressable
                accessibilityRole="button"
                disabled={!onJumpToExercise || isCurrent}
                key={exercise.id}
                onPress={() => onJumpToExercise?.(index)}
                style={styles.dockNodeSlot}
              >
                <View
                  style={[
                    styles.dockNode,
                    isCompleted && styles.dockNodeCompleted,
                    isCurrent && styles.dockNodeCurrent,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  return (
    <AppCard style={styles.card}>
      <View style={styles.headerRow}>
        <AppText variant="bodySmall" weight="700">
          本次训练进度
        </AppText>
        <AppText tone="brand" variant="caption" weight="700">
          {completedCount + 1} / {exercises.length} 个动作
        </AppText>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.progressContent}
      >
        {exercises.map((exercise, index) => {
          const isCompleted = exercise.status === 'completed';
          const isCurrent = exercise.status === 'current';
          const isUpcoming = exercise.status === 'upcoming';

          return (
            <View key={exercise.id} style={styles.nodeContainer}>
              {index > 0 ? (
                <View style={styles.connector}>
                  <View style={[styles.connectorLine, isCompleted && styles.connectorLineCompleted]} />
                </View>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={!onJumpToExercise || isCurrent}
                onPress={() => onJumpToExercise?.(index)}
                style={[
                  styles.nodeCircle,
                  isCompleted && styles.nodeCompleted,
                  isCurrent && styles.nodeCurrent,
                  isUpcoming && styles.nodeUpcoming,
                ]}
              >
                {isCompleted ? (
                  <Ionicons color={colors.surface} name="checkmark" size={12} />
                ) : isCurrent ? (
                  <View style={styles.nodeInnerCurrent} />
                ) : null}
              </Pressable>
              <AppText
                tone={isCurrent ? 'brand' : isCompleted ? 'muted' : 'subtle'}
                variant="caption"
                weight={isCurrent ? '700' : '400'}
                numberOfLines={1}
                style={styles.nodeName}
              >
                {exercise.name.length > 4 ? exercise.name.slice(0, 4) : exercise.name}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  dock: {
    gap: spacing.xxs,
  },
  dockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dockNodes: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dockNodeSlot: {
    flex: 1,
    height: 10,
    justifyContent: 'center',
  },
  dockNode: {
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    height: 4,
  },
  dockNodeCompleted: {
    backgroundColor: colors.textSubtle,
  },
  dockNodeCurrent: {
    backgroundColor: colors.brand,
    height: 6,
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressContent: {
    alignItems: 'flex-start',
    gap: 0,
    paddingVertical: spacing.xs,
  },
  nodeContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 0,
  },
  connector: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 10,
  },
  connectorLine: {
    backgroundColor: colors.border,
    height: 2,
    width: 10,
  },
  connectorLineCompleted: {
    backgroundColor: '#7F8A98',
  },
  nodeCircle: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  nodeCompleted: {
    backgroundColor: '#7F8A98',
    borderColor: '#7F8A98',
  },
  nodeCurrent: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  nodeUpcoming: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  nodeInnerCurrent: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 10,
    width: 10,
  },
  nodeName: {
    marginTop: spacing.xxs,
    maxWidth: 54,
    textAlign: 'center',
  },
});
