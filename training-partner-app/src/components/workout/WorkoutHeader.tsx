import { Ionicons } from '@expo/vector-icons';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type WorkoutHeaderProps = {
  phaseLabel: string;
  onBack: () => void;
  onEndWorkout: () => void;
};

export function WorkoutHeader({ phaseLabel, onBack, onEndWorkout }: WorkoutHeaderProps) {
  function handleEndWorkout() {
    Alert.alert(
      '确认结束本次训练？',
      '已记录的数据会保存，未完成动作将不会计入完成组。',
      [
        { text: '继续训练', style: 'cancel' },
        { text: '保存并结束', style: 'destructive', onPress: onEndWorkout },
      ],
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Pressable accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <Ionicons color={colors.textStrong} name="arrow-back" size={22} />
        </Pressable>
        <View style={styles.titleGroup}>
          <AppText variant="subtitle" weight="800">
            训练中
          </AppText>
          <AppText tone="muted" variant="caption">
            {phaseLabel}
          </AppText>
        </View>
        <Pressable accessibilityRole="button" onPress={handleEndWorkout} style={styles.endButton}>
          <AppText tone="brand" variant="caption" weight="700">
            结束训练
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  titleGroup: {
    flex: 1,
    gap: 2,
    marginLeft: spacing.xs,
  },
  endButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
});
