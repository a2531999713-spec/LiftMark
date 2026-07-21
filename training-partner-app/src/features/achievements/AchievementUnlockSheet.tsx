import { Ionicons } from '@expo/vector-icons';
import type { AchievementProgress } from '@liftmark/shared';
import { StyleSheet, View } from 'react-native';

import { AppButton, AppModalSheet, AppText } from '@/components/ui';
import { ACHIEVEMENT_ICON_BY_METRIC } from '@/domain/achievement/achievement.catalog';
import { colors, radius, spacing } from '@/theme';

export function AchievementUnlockSheet({
  achievements,
  onClose,
  onViewAll,
}: {
  achievements: AchievementProgress[];
  onClose: () => void;
  onViewAll: () => void;
}) {
  const visibleItems = achievements.slice(0, 3);
  const extraCount = Math.max(0, achievements.length - visibleItems.length);
  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="这次训练让你的阶段进度又向前了一步"
      title="新里程碑已解锁"
      visible={achievements.length > 0}
    >
      <View style={styles.list}>
        {visibleItems.map((achievement) => (
          <View key={achievement.code} style={styles.item}>
            <View style={styles.icon}>
              <Ionicons color={colors.primary} name={ACHIEVEMENT_ICON_BY_METRIC[achievement.metric]} size={22} />
            </View>
            <View style={styles.text}>
              <AppText variant="bodySmall" weight="900">{achievement.name}</AppText>
              <AppText tone="muted" variant="caption">{achievement.description}</AppText>
            </View>
          </View>
        ))}
        {extraCount > 0 ? <AppText tone="muted" variant="caption">另有 {extraCount} 项已解锁</AppText> : null}
      </View>
      <View style={styles.actions}>
        <AppButton onPress={onViewAll}>查看全部成就</AppButton>
        <AppButton onPress={onClose} variant="secondary">继续查看训练总结</AppButton>
      </View>
    </AppModalSheet>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.sm },
  icon: { alignItems: 'center', backgroundColor: colors.primarySoft, borderRadius: radius.md, height: 42, justifyContent: 'center', width: 42 },
  item: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm },
  list: { gap: spacing.md },
  text: { flex: 1, gap: 2 },
});
