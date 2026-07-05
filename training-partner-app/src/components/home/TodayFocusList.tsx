import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import type { ExercisePriority } from '@/domain/plan/plan.types';
import { colors, radius, shadows, spacing } from '@/theme';

export type TodayFocusItem = {
  id: string;
  lastPerformance?: string;
  name: string;
  prescription: string;
  priority: ExercisePriority;
};

type TodayFocusListProps = {
  items: TodayFocusItem[];
  onItemPress: (item: TodayFocusItem) => void;
  onOpenAll: () => void;
};

export function TodayFocusList({ items, onItemPress, onOpenAll }: TodayFocusListProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText style={styles.heading} variant="subtitle" weight="900">
          今日重点
        </AppText>
        <Pressable accessibilityRole="button" onPress={onOpenAll} style={styles.headerAction}>
          <AppText tone="muted" variant="caption" weight="800">
            查看全部
          </AppText>
          <Ionicons color={colors.textMuted} name="chevron-forward" size={15} />
        </Pressable>
      </View>

      <View style={styles.card}>
        {items.length === 0 ? (
          <View style={styles.emptyRow}>
            <Ionicons color={colors.textMuted} name="barbell-outline" size={20} />
            <AppText tone="muted" variant="bodySmall">
              今日没有需要执行的重点动作。
            </AppText>
          </View>
        ) : (
          items.map((item, index) => (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => onItemPress(item)}
              style={({ pressed }) => [
                styles.row,
                index === items.length - 1 && styles.lastRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.thumbnail}>
                <Ionicons color={colors.textStrong} name="barbell-outline" size={20} />
              </View>
              <View style={styles.textBlock}>
                <AppText numberOfLines={1} style={styles.exerciseName} variant="bodySmall" weight="900">
                  {item.name}
                </AppText>
                <View style={styles.prescriptionRow}>
                  <PriorityBadge priority={item.priority} />
                  <AppText numberOfLines={1} tone="muted" variant="caption">
                    {item.prescription}
                  </AppText>
                </View>
              </View>
              {item.lastPerformance ? (
                <View style={styles.lastBadge}>
                  <AppText numberOfLines={1} style={styles.lastText} variant="caption" weight="800">
                    {item.lastPerformance}
                  </AppText>
                </View>
              ) : null}
              <Ionicons color={colors.textMuted} name="chevron-forward" size={18} />
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

function PriorityBadge({ priority }: { priority: ExercisePriority }) {
  const background =
    priority === 'A' ? colors.primary : priority === 'B' ? colors.warning : colors.accent;

  return (
    <View style={[styles.priorityBadge, { backgroundColor: background }]}>
      <AppText tone="inverse" variant="caption" weight="900">
        {priority}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
  emptyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 64,
    padding: spacing.md,
  },
  exerciseName: {
    color: colors.textStrong,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  heading: {
    color: colors.textStrong,
  },
  lastBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    maxWidth: 106,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  lastText: {
    color: colors.primary,
  },
  prescriptionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  pressed: {
    opacity: 0.82,
  },
  priorityBadge: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 19,
    justifyContent: 'center',
    width: 28,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 70,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  textBlock: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
  thumbnail: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
