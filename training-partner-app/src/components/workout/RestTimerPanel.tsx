import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type RestTimerPanelProps = {
  currentMemberName?: string;
  currentSetLabel?: string;
  elapsedSeconds?: number;
  nextMemberName?: string;
  nextSetLabel?: string;
  plannedSeconds?: number;
  remainingSeconds: number;
  status?: 'ready' | 'resting';
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
  plannedSeconds,
  remainingSeconds,
  status = remainingSeconds > 0 ? 'resting' : 'ready',
}: RestTimerPanelProps) {
  const nextLabel = nextMemberName
    ? `${nextMemberName} · ${nextSetLabel ?? '下一组'}`
    : nextSetLabel ?? '下一组';
  const isReady = status === 'ready' || remainingSeconds <= 0;

  return (
    <View style={[styles.panel, isReady && styles.panelReady]}>
      <View style={styles.timerBlock}>
        <AppText tone="muted" variant="caption">
          {currentMemberName ? `${currentMemberName}${isReady ? ' 已恢复' : ' 正在休息'}` : isReady ? '休息结束' : '休息倒计时'}
        </AppText>
        <AppText tone={isReady ? 'success' : 'brand'} variant="subtitle" weight="900">
          {isReady ? '可以准备下一组' : formatTimer(remainingSeconds)}
        </AppText>
        <AppText tone="muted" variant="caption">
          已休 {formatTimer(elapsedSeconds)} · 建议 {plannedSeconds ? formatTimer(plannedSeconds) : '未设置'}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {currentSetLabel ?? '当前组'} · 下一目标 {nextLabel}
        </AppText>
      </View>
      <View style={[styles.statusBadge, isReady && styles.statusBadgeReady]}>
        <Ionicons
          color={isReady ? colors.success : colors.primary}
          name={isReady ? 'checkmark-circle-outline' : 'timer-outline'}
          size={17}
        />
      </View>
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
  panelReady: {
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
  },
  statusBadge: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  statusBadgeReady: {
    backgroundColor: colors.surface,
  },
  timerBlock: {
    flex: 1,
    gap: 2,
  },
});
