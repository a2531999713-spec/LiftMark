import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, StyleSheet, View } from 'react-native';

import { liftmarkImages } from '@/assets/images';
import { AppText } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { WorkoutExerciseRecord } from '@/domain/workout/workout.types';
import { colors, radius, shadows, spacing } from '@/theme';

type ExerciseHeroCardProps = {
  exercise: Exercise | null;
  record: WorkoutExerciseRecord;
  currentSetIndex: number;
  totalSets: number;
};

const categoryLabels: Record<string, string> = {
  chest: '胸部',
  back: '背部',
  shoulder: '肩部',
  legs: '腿部',
  arms: '手臂',
  core: '核心',
  calves: '小腿',
  full_body: '全身',
  other: '其他',
};

const movementLabels: Record<string, string> = {
  horizontal_push: '水平推',
  vertical_push: '垂直推',
  horizontal_pull: '水平拉',
  vertical_pull: '垂直拉',
  squat: '蹲',
  hinge: '铰链',
  isolation: '孤立',
  carry: '搬运',
  core: '核心',
  other: '其他',
};

function formatRestLabel(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) {
    return '无固定休息';
  }
  return `${seconds} 秒`;
}

export function ExerciseHeroCard({ exercise, record, currentSetIndex, totalSets }: ExerciseHeroCardProps) {
  const muscleLabel = exercise ? (categoryLabels[exercise.category] ?? exercise.targetMuscle) : '';
  const patternLabel = exercise ? (movementLabels[exercise.movementPattern] ?? '') : '';

  return (
    <View style={styles.card}>
      <ImageBackground
        imageStyle={styles.heroImage}
        resizeMode="cover"
        source={liftmarkImages.trainingHero}
        style={styles.heroBg}
      >
        <View style={styles.scrim} />
      </ImageBackground>
      <View style={styles.overlay}>
        <View style={styles.tagRow}>
          <View style={styles.priorityBadge}>
            <AppText style={styles.priorityText} tone="inverse" variant="subtitle" weight="900">
              {record.priority}
            </AppText>
          </View>
          <View style={styles.setProgressTag}>
            <AppText style={styles.progressText} tone="inverse" variant="bodySmall" weight="900">
              {currentSetIndex} / {totalSets}
            </AppText>
          </View>
        </View>
        <View style={styles.mainInfo}>
          <AppText style={styles.exerciseTitle} tone="inverse" variant="headline" weight="900">
            {exercise?.name ?? record.exerciseId}
          </AppText>
          {muscleLabel || patternLabel ? (
            <AppText style={styles.subtitle} tone="inverse" variant="bodySmall">
              {muscleLabel}{muscleLabel && patternLabel ? ' · ' : ''}{patternLabel}
            </AppText>
          ) : null}
        </View>
        <View style={styles.restRow}>
          <Ionicons color="#FFFFFF" name="hourglass-outline" size={16} />
          <AppText style={styles.restText} tone="inverse" variant="bodySmall" weight="800">
            休息建议 {formatRestLabel(record.plannedRestSeconds)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    height: 190,
    overflow: 'hidden',
    ...shadows.hero,
  },
  heroBg: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  heroImage: {
    opacity: 1,
  },
  scrim: {
    backgroundColor: colors.overlay,
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  overlay: {
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  tagRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityBadge: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.sm,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  priorityText: {
    lineHeight: 24,
  },
  setProgressTag: {
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    borderRadius: radius.sm,
    height: 38,
    justifyContent: 'center',
    minWidth: 64,
    paddingHorizontal: spacing.md,
  },
  progressText: {
    lineHeight: 18,
  },
  mainInfo: {
    gap: spacing.xs,
  },
  exerciseTitle: {
    fontSize: 34,
    lineHeight: 40,
  },
  subtitle: {
    color: '#D8DEE8',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  restRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  restText: {
    lineHeight: 20,
  },
});
