import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

import type { PlanDayDraft, PlanExerciseMap } from './planEditTypes';

type PlanDayListProps = {
  days: PlanDayDraft[];
  exerciseMap: PlanExerciseMap;
  onDeleteDay: (dayId: string) => void;
  onOpenDay: (dayId: string) => void;
};

export function PlanDayList({ days, exerciseMap, onDeleteDay, onOpenDay }: PlanDayListProps) {
  if (days.length === 0) {
    return <EmptyState description="新增训练日后，再进入训练日编辑动作。" title="还没有训练日" />;
  }

  return (
    <FlatList
      data={days}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <PlanDayCard day={item} exerciseMap={exerciseMap} onDelete={() => onDeleteDay(item.id)} onPress={() => onOpenDay(item.id)} />
      )}
      scrollEnabled={false}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

function PlanDayCard({
  day,
  exerciseMap,
  onDelete,
  onPress,
}: {
  day: PlanDayDraft;
  exerciseMap: PlanExerciseMap;
  onDelete: () => void;
  onPress: () => void;
}) {
  const names = day.exercises
    .slice(0, 3)
    .map((exercise) => exerciseMap[exercise.exerciseId]?.name ?? '训练动作');

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.pressable, pressed && styles.pressed]}>
      <AppCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.dayBadge}>
            <AppText tone="inverse" variant="caption" weight="900">
              D{day.weekday}
            </AppText>
          </View>
          <View style={styles.titleBlock}>
            <AppText numberOfLines={1} variant="bodySmall" weight="900">
              {day.title || `Week ${day.week} Day ${day.weekday}`}
            </AppText>
            <AppText numberOfLines={1} tone="muted" variant="caption">
              第 {day.week} 周 · 星期 {day.weekday} · {day.focus || '训练重点'}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={onDelete} style={styles.iconButton}>
            <Ionicons color={colors.danger} name="trash-outline" size={18} />
          </Pressable>
        </View>
        <View style={styles.metaRow}>
          <Tag label={`${day.exercises.length} 个动作`} tone="accent" />
          {names.length > 0 ? (
            <AppText numberOfLines={1} style={styles.exerciseNames} tone="muted" variant="caption">
              {names.join('、')}
              {day.exercises.length > 3 ? ` 等 ${day.exercises.length} 个` : ''}
            </AppText>
          ) : (
            <AppText tone="muted" variant="caption">
              点击进入后添加动作
            </AppText>
          )}
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  dayBadge: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  exerciseNames: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pressable: {
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.84,
  },
  separator: {
    height: spacing.sm,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
});
