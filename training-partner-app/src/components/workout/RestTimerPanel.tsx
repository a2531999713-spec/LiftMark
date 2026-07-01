import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type RestTimerPanelProps = {
  currentMemberName?: string;
  currentSetLabel?: string;
  elapsedSeconds?: number;
  nextMemberName?: string;
  nextSetLabel?: string;
  onStartNextSet: () => void;
  plannedSeconds?: number;
  remainingSeconds: number;
};

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

export function RestTimerPanel({
  currentMemberName,
  currentSetLabel,
  elapsedSeconds = 0,
  nextMemberName,
  nextSetLabel,
  onStartNextSet,
  plannedSeconds,
  remainingSeconds,
}: RestTimerPanelProps) {
  const actionLabel = remainingSeconds > 0 ? '提前开始下一组' : '开始下一组';
  const nextLabel = nextMemberName
    ? `${nextMemberName} · ${nextSetLabel ?? '下一组'}`
    : nextSetLabel ?? '下一组';

  return (
    <View style={styles.panel}>
      <View style={styles.timerBlock}>
        <AppText tone="muted" variant="caption">
          {currentMemberName ? `${currentMemberName} 休息中` : '休息倒计时'}
        </AppText>
        <AppText tone="brand" variant="subtitle" weight="900">
          {formatTimer(remainingSeconds)}
        </AppText>
        <AppText tone="muted" variant="caption">
          已休 {formatTimer(elapsedSeconds)} · 建议 {plannedSeconds ? formatTimer(plannedSeconds) : '未设置'}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {currentSetLabel ?? '当前组'} → {nextLabel}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" onPress={onStartNextSet} style={styles.startButton}>
        <Ionicons color={colors.surface} name={remainingSeconds > 0 ? 'play-forward' : 'play'} size={17} />
        <AppText tone="inverse" variant="caption" weight="900">
          {actionLabel}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 64,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.md,
    width: 132,
  },
  timerBlock: {
    flex: 1,
    gap: 2,
  },
});
