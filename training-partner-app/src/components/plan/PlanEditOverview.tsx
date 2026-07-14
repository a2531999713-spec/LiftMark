import { Ionicons } from '@expo/vector-icons';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View, type StyleProp, type ViewStyle } from 'react-native';

import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import { PlanExerciseSettingsSheet } from '@/components/plan-editor/PlanExerciseSettingsSheet';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, SectionHeader } from '@/components/ui';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanTemplate, Weekday } from '@/domain/plan/plan.types';
import { colors, radius, spacing, typography } from '@/theme';

import { createPlanDraftId, createPlanExerciseDraft, duplicatePlanDayDraft, duplicatePlanExerciseDraft } from './planEditDraft';
import type { PlanDayDraft, PlanEditDraft, PlanExerciseDraft, PlanExerciseMap } from './planEditTypes';
import { formatPlanExercisePrescription, validatePlanEditorDraft } from './planEditorValidation';
import { useUserPreferences } from '@/hooks/useUserPreferences';

type PlanEditOverviewProps = {
  allExercises: Exercise[];
  draft: PlanEditDraft;
  exerciseMap: PlanExerciseMap;
  isSaving: boolean;
  onAddDay: (week: number) => void;
  onChange: (patch: Partial<PlanEditDraft>) => void;
  onCreateCustomExercise: (input: CreateCustomExerciseInput) => Promise<Exercise>;
  onDeleteDay: (dayId: string) => void;
  onSave: () => void;
  planSource: PlanTemplate['source'];
};

type PickerTarget = {
  dayId: string;
  replaceExerciseDraftId?: string;
};

type NoticeState = {
  message: string;
  title: string;
};

const goalOptions: { label: string; value: PlanTemplate['goal'] }[] = [
  { label: '增力', value: 'strength' },
  { label: '增肌', value: 'hypertrophy' },
  { label: '减脂', value: 'fat_loss' },
  { label: '通用', value: 'general' },
  { label: '自定义', value: 'custom' },
];

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

const DAY_ROW_STRIDE = 66;
const EXERCISE_ROW_STRIDE = 66;

export function PlanEditOverview({
  allExercises,
  draft,
  exerciseMap,
  isSaving,
  onAddDay,
  onChange,
  onCreateCustomExercise,
  onDeleteDay,
  onSave,
  planSource,
}: PlanEditOverviewProps) {
  const [activeDayId, setActiveDayId] = useState(draft.days[0]?.id ?? '');
  const [selectedWeek, setSelectedWeek] = useState(draft.days[0]?.week ?? 1);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<{ dayId: string; exerciseDraftId: string } | null>(null);
  const [deleteExerciseTarget, setDeleteExerciseTarget] = useState<{ dayId: string; exerciseDraftId: string } | null>(null);
  const [deleteDayTarget, setDeleteDayTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const { preferences } = useUserPreferences();

  const weekOptions = useMemo(
    () => Array.from(new Set(draft.days.map((day) => day.week))).sort((left, right) => left - right),
    [draft.days],
  );
  const effectiveSelectedWeek = weekOptions.includes(selectedWeek) ? selectedWeek : weekOptions[0] ?? selectedWeek;
  const visibleDays = useMemo(
    () => draft.days.filter((day) => day.week === effectiveSelectedWeek).sort((left, right) => left.weekday - right.weekday),
    [draft.days, effectiveSelectedWeek],
  );
  const activeDay = visibleDays.find((day) => day.id === activeDayId) ?? visibleDays[0] ?? draft.days[0];
  const settingsDay = settingsTarget ? draft.days.find((day) => day.id === settingsTarget.dayId) : undefined;
  const settingsExercise = settingsDay?.exercises.find((exercise) => exercise.id === settingsTarget?.exerciseDraftId);
  const validation = useMemo(() => validatePlanEditorDraft(draft), [draft]);
  const activeDaySetCount = activeDay?.exercises.reduce((sum, exercise) => sum + exercise.sets, 0) ?? 0;

  const updateDraftDays = (updater: (days: PlanDayDraft[]) => PlanDayDraft[]) => {
    onChange({ days: updater(draft.days) });
  };

  const updateExercise = (dayId: string, exerciseDraftId: string, patch: Partial<PlanExerciseDraft>) => {
    updateDraftDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises.map((exercise) =>
                exercise.id === exerciseDraftId ? { ...exercise, ...patch } : exercise,
              ),
            }
          : day,
      ),
    );
  };

  const addExerciseToDay = (dayId: string, exercise: Exercise) => {
    updateDraftDays((days) =>
      days.map((day) => {
        if (day.id !== dayId || day.exercises.some((item) => item.exerciseId === exercise.id)) {
          return day;
        }
        return {
          ...day,
          exercises: [...day.exercises, createPlanExerciseDraft(exercise.id, day.exercises.length)],
        };
      }),
    );
  };

  const removeExerciseFromDay = (dayId: string, exerciseDraftId: string) => {
    updateDraftDays((days) =>
      days.map((day) =>
        day.id === dayId
          ? {
              ...day,
              exercises: day.exercises
                .filter((exercise) => exercise.id !== exerciseDraftId)
                .map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
            }
          : day,
      ),
    );
  };

  const reorderDays = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    updateDraftDays((days) => {
      const weekDays = days
        .filter((d) => d.week === effectiveSelectedWeek)
        .sort((a, b) => a.weekday - b.weekday);
      const otherDays = days.filter((d) => d.week !== effectiveSelectedWeek);
      const sortedWeekdays = weekDays.map((d) => d.weekday);
      const [moved] = weekDays.splice(fromIndex, 1);
      weekDays.splice(toIndex, 0, moved);
      const updatedWeekDays = weekDays.map((d, i) => ({
        ...d,
        weekday: sortedWeekdays[i],
      }));
      return [...otherDays, ...updatedWeekDays];
    });
  };

  const reorderExercises = (dayId: string, fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    updateDraftDays((days) =>
      days.map((day) => {
        if (day.id !== dayId) return day;
        const exercises = [...day.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        exercises.splice(toIndex, 0, moved);
        return {
          ...day,
          exercises: exercises.map((ex, i) => ({ ...ex, orderIndex: i })),
        };
      }),
    );
  };

  const updateDayWeekday = (dayId: string, weekday: Weekday) => {
    updateDraftDays((days) =>
      days.map((day) => (day.id === dayId ? { ...day, weekday } : day)),
    );
  };

  const copySelectedWeekToNextWeek = () => {
    const sourceDays = visibleDays;
    if (sourceDays.length === 0) {
      setNotice({ title: '无法复制', message: '当前训练周没有可复制的训练日。' });
      return;
    }

    const targetWeek = effectiveSelectedWeek + 1;
    const copiedDays = sourceDays.map((day) => ({
      ...day,
      id: createPlanDraftId('day'),
      week: targetWeek,
      exercises: day.exercises.map((exercise, orderIndex) => ({
        ...exercise,
        id: createPlanDraftId('plan_exercise'),
        orderIndex,
      })),
    }));
    const nextDays = [
      ...draft.days.filter((day) => day.week !== targetWeek),
      ...copiedDays,
    ].sort((left, right) => left.week - right.week || left.weekday - right.weekday);
    const nextDurationWeeks = Math.max(draft.durationWeeks, targetWeek);

    onChange({ days: nextDays, durationWeeks: nextDurationWeeks });
    setSelectedWeek(targetWeek);
    setActiveDayId(copiedDays[0]?.id ?? '');
    setNotice({ title: '已复制到下一周', message: `第 ${effectiveSelectedWeek} 周已复制到第 ${targetWeek} 周。` });
  };

  const duplicateExercise = () => {
    if (!settingsTarget || !settingsExercise) return;
    updateDraftDays((days) =>
      days.map((day) => {
        if (day.id !== settingsTarget.dayId) return day;
        return {
          ...day,
          exercises: [
            ...day.exercises,
            duplicatePlanExerciseDraft(settingsExercise, day.exercises.length),
          ],
        };
      }),
    );
    setSettingsTarget(null);
  };

  const duplicateDay = (dayId: string) => {
    const sourceDay = draft.days.find((day) => day.id === dayId);
    if (!sourceDay) return;
    const usedWeekdays = new Set(draft.days.filter((day) => day.week === sourceDay.week).map((day) => day.weekday));
    const weekday = ([1, 2, 3, 4, 5, 6, 7] as Weekday[]).find((item) => !usedWeekdays.has(item)) ?? sourceDay.weekday;
    const copiedDay = duplicatePlanDayDraft(sourceDay, weekday);
    updateDraftDays((days) => [...days, copiedDay]);
    setActiveDayId(copiedDay.id);
  };

  const saveWithValidation = () => {
    if (!validation.isValid) {
      setNotice({
        title: '保存校验未通过',
        message: validation.errors.join('\n'),
      });
      return;
    }
    onSave();
  };

  return (
    <View style={styles.layout}>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <PlanOverviewCard draft={draft} onChange={onChange} />

        <AppCard style={styles.card}>
          <View style={styles.dayListHeader}>
            <View style={styles.dayListTitle}>
              <AppText variant="subtitle">训练日</AppText>
              <AppText tone="muted" variant="caption">
                长按可拖拽排序
              </AppText>
            </View>
            <View style={styles.dayListActions}>
              <Pressable
                accessibilityRole="button"
                onPress={copySelectedWeekToNextWeek}
                style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
              >
                <Ionicons color={colors.primary} name="copy-outline" size={19} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => onAddDay(effectiveSelectedWeek)}
                style={({ pressed }) => [styles.iconAction, pressed && styles.pressed]}
              >
                <Ionicons color={colors.primary} name="add-circle-outline" size={20} />
              </Pressable>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.weekTabs}>
              {weekOptions.map((week) => {
                const active = week === effectiveSelectedWeek;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={week}
                    onPress={() => setSelectedWeek(week)}
                    style={[styles.weekTab, active && styles.weekTabActive]}
                  >
                    <AppText tone={active ? 'brand' : 'muted'} variant="caption" weight="900">
                      第 {week} 周
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {visibleDays.length === 0 ? (
            <EmptyState
              actionLabel="添加训练日"
              description="点击右上角 + 添加第一个训练日。"
              onActionPress={() => onAddDay(effectiveSelectedWeek)}
              title="本周还没有训练日"
            />
          ) : (
            <ScrollView nestedScrollEnabled style={styles.dayListScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.dayList}>
                {visibleDays.map((day, index) => (
                  <DraggableRow
                    itemId={day.id}
                    index={index}
                    itemCount={visibleDays.length}
                    itemStride={DAY_ROW_STRIDE}
                    key={day.id}
                    onReorder={(from, to) => reorderDays(from, to)}
                    onPress={() => setActiveDayId(day.id)}
                    style={styles.draggableRowWrap}
                  >
                    <PlanDayRow
                      active={day.id === activeDay?.id}
                      day={day}
                      onDelete={() => setDeleteDayTarget(day.id)}
                      onDuplicate={() => duplicateDay(day.id)}
                    />
                  </DraggableRow>
                ))}
              </View>
            </ScrollView>
          )}
        </AppCard>

        {activeDay ? (
          <>
            <AppCard style={styles.card}>
              <View style={styles.activeDayHeader}>
                <View style={styles.activeDayTitle}>
                  <AppText variant="subtitle">{activeDay.title}</AppText>
                  <AppText tone="muted" variant="caption">
                    W{activeDay.week} · {activeDay.exercises.length} 动作 · {activeDaySetCount} 组
                  </AppText>
                </View>
                <AppButton
                  icon="add-outline"
                  onPress={() => setPickerTarget({ dayId: activeDay.id })}
                  size="sm"
                  variant="secondary"
                >
                  动作
                </AppButton>
              </View>

              <View style={styles.weekdaySection}>
                <AppText tone="muted" variant="caption">
                  执行日
                </AppText>
                <View style={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((label, i) => {
                    const wd = (i + 1) as Weekday;
                    const isActive = wd === activeDay.weekday;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={wd}
                        onPress={() => updateDayWeekday(activeDay.id, wd)}
                        style={[styles.weekdayChip, isActive && styles.weekdayChipActive]}
                      >
                        <AppText
                          tone={isActive ? 'inverse' : 'muted'}
                          variant="caption"
                          weight="900"
                        >
                          {label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <View style={styles.focusRow}>
                <AppText tone="muted" variant="caption">
                  重点
                </AppText>
                <TextInput
                  onChangeText={(focus) =>
                    updateDraftDays((days) =>
                      days.map((d) => (d.id === activeDay.id ? { ...d, focus } : d)),
                    )
                  }
                  style={styles.focusInput}
                  value={activeDay.focus}
                />
              </View>
              <View style={styles.focusRow}>
                <AppText tone="muted" variant="caption">
                  名称
                </AppText>
                <TextInput
                  onChangeText={(title) =>
                    updateDraftDays((days) =>
                      days.map((d) => (d.id === activeDay.id ? { ...d, title } : d)),
                    )
                  }
                  style={styles.focusInput}
                  value={activeDay.title}
                />
              </View>

              {activeDay.exercises.length === 0 ? (
                <EmptyState
                  actionLabel="添加动作"
                  description="每个训练日至少需要一个动作。"
                  onActionPress={() => setPickerTarget({ dayId: activeDay.id })}
                  title="还没有动作"
                />
              ) : (
                <View style={styles.exerciseList}>
                  {activeDay.exercises.map((exerciseDraft, index) => (
                    <DraggableRow
                      itemId={exerciseDraft.id}
                      index={index}
                      itemCount={activeDay.exercises.length}
                      itemStride={EXERCISE_ROW_STRIDE}
                      key={exerciseDraft.id}
                      onReorder={(from, to) => reorderExercises(activeDay.id, from, to)}
                      onPress={() => setSettingsTarget({ dayId: activeDay.id, exerciseDraftId: exerciseDraft.id })}
                      style={styles.draggableExerciseWrap}
                    >
                      <PlanExerciseRow
                        draft={exerciseDraft}
                        exercise={exerciseMap[exerciseDraft.exerciseId]}
                        orderLabel={String.fromCharCode(65 + index)}
                        weightUnit={preferences.weightUnit}
                      />
                    </DraggableRow>
                  ))}
                </View>
              )}
            </AppCard>

            <ValidationCard validation={validation} />
          </>
        ) : null}
      </ScrollView>

      <AppCard style={styles.bottomBar}>
        <View style={styles.bottomIcon}>
          <Ionicons color={colors.accent} name="calendar-outline" size={22} />
        </View>
        <View style={styles.bottomText}>
          <AppText variant="bodySmall" weight="900">
            {activeDay?.exercises.length ?? 0} 动作 · {activeDaySetCount} 计划组
          </AppText>
          <AppText tone="muted" variant="caption">
            {activeDay ? `W${activeDay.week} · 周${WEEKDAY_LABELS[activeDay.weekday - 1]} · ${activeDay.title}` : '选择训练日'}
          </AppText>
        </View>
        <AppButton disabled={!validation.isValid} icon="save-outline" loading={isSaving} onPress={saveWithValidation}>
          保存计划
        </AppButton>
      </AppCard>

      <ExercisePickerSheet
        exercises={allExercises}
        onClose={() => setPickerTarget(null)}
        onCreateCustomExercise={onCreateCustomExercise}
        onSelect={(exercise) => {
          if (!pickerTarget) return;
          if (pickerTarget.replaceExerciseDraftId) {
            updateExercise(pickerTarget.dayId, pickerTarget.replaceExerciseDraftId, { exerciseId: exercise.id });
          } else {
            addExerciseToDay(pickerTarget.dayId, exercise);
          }
          setPickerTarget(null);
        }}
        selectedExerciseIds={activeDay?.exercises.map((exercise) => exercise.exerciseId) ?? []}
        title={pickerTarget?.replaceExerciseDraftId ? '更换动作' : '添加计划动作'}
        visible={Boolean(pickerTarget)}
      />

      <PlanExerciseSettingsSheet
        draft={settingsExercise}
        exercise={settingsExercise ? exerciseMap[settingsExercise.exerciseId] : undefined}
        onChange={(patch) => {
          if (settingsTarget) updateExercise(settingsTarget.dayId, settingsTarget.exerciseDraftId, patch);
        }}
        onClose={() => setSettingsTarget(null)}
        onDelete={() => {
          if (settingsTarget) setDeleteExerciseTarget(settingsTarget);
        }}
        onDuplicate={duplicateExercise}
        onReplace={() => {
          if (settingsTarget) {
            setPickerTarget({ dayId: settingsTarget.dayId, replaceExerciseDraftId: settingsTarget.exerciseDraftId });
          }
        }}
        onSave={() => setSettingsTarget(null)}
        weightUnit={preferences.weightUnit}
        visible={Boolean(settingsTarget)}
      />

      <ConfirmSheet
        message={
          deleteExerciseTarget && draft.days.find((day) => day.id === deleteExerciseTarget.dayId)?.exercises.length === 1
            ? '这是该训练日最后一个动作。删除后本训练日无法保存，需重新添加动作或删除训练日。'
            : '删除后该训练日不再包含这个动作，保存计划后才会写入模板。'
        }
        onCancel={() => setDeleteExerciseTarget(null)}
        onConfirm={() => {
          if (deleteExerciseTarget) {
            removeExerciseFromDay(deleteExerciseTarget.dayId, deleteExerciseTarget.exerciseDraftId);
          }
          setDeleteExerciseTarget(null);
          setSettingsTarget(null);
        }}
        title="删除动作？"
        visible={Boolean(deleteExerciseTarget)}
      />

      <ConfirmSheet
        message="删除训练日会移除其中所有动作，保存计划后才会写入模板。"
        onCancel={() => setDeleteDayTarget(null)}
        onConfirm={() => {
          if (deleteDayTarget) {
            onDeleteDay(deleteDayTarget);
          }
          setDeleteDayTarget(null);
        }}
        title="删除训练日？"
        visible={Boolean(deleteDayTarget)}
      />

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
      </AppModalSheet>
    </View>
  );
}

function DraggableRow({
  itemId,
  index,
  itemCount,
  itemStride,
  onReorder,
  onPress,
  children,
  style,
}: {
  itemId: string;
  index: number;
  itemCount: number;
  itemStride: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const isDragging = useSharedValue(false);
  const translateY = useSharedValue(0);
  const dragStartIndex = useSharedValue(index);
  const currentIndex = useSharedValue(index);

  const handlePress = () => {
    onPress?.();
  };

  const pan = Gesture.Pan()
    .activateAfterLongPress(350)
    .onStart(() => {
      isDragging.value = true;
      dragStartIndex.value = index;
      currentIndex.value = index;
    })
    .onUpdate((e) => {
      const offset = Math.round(e.translationY / itemStride);
      let target = dragStartIndex.value + offset;
      target = Math.max(0, Math.min(itemCount - 1, target));
      if (target !== currentIndex.value) {
        const from = currentIndex.value;
        currentIndex.value = target;
        runOnJS(onReorder)(from, target);
      }
      translateY.value = e.translationY - (currentIndex.value - dragStartIndex.value) * itemStride;
    })
    .onEnd(() => {
      isDragging.value = false;
      translateY.value = withSpring(0);
    });

  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(handlePress)();
  });

  const gesture = Gesture.Race(pan, tap);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: isDragging.value ? translateY.value : 0 }],
    zIndex: isDragging.value ? 1000 : 0,
    elevation: isDragging.value ? 10 : 0,
    opacity: isDragging.value ? 0.95 : 1,
    shadowColor: '#000',
    shadowOpacity: isDragging.value ? 0.2 : 0,
    shadowRadius: isDragging.value ? 8 : 0,
    shadowOffset: { width: 0, height: 4 },
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

function PlanOverviewCard({
  draft,
  onChange,
}: {
  draft: PlanEditDraft;
  onChange: (patch: Partial<PlanEditDraft>) => void;
}) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.overviewRow}>
        <View style={styles.nameField}>
          <AppText tone="muted" variant="caption">
            计划名称
          </AppText>
          <TextInput
            onChangeText={(name) => onChange({ name })}
            style={styles.compactInput}
            value={draft.name}
          />
        </View>
        <View style={styles.compactField}>
          <AppText tone="muted" variant="caption">
            周期
          </AppText>
          <View style={styles.numberRow}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(text) => {
                const parsed = Number.parseInt(text, 10);
                if (Number.isFinite(parsed)) {
                  onChange({ durationWeeks: Math.max(1, parsed) });
                }
              }}
              style={styles.compactNumberInput}
              value={`${draft.durationWeeks}`}
            />
            <AppText tone="muted" variant="caption">
              周
            </AppText>
          </View>
        </View>
        <View style={styles.compactField}>
          <AppText tone="muted" variant="caption">
            频率
          </AppText>
          <View style={styles.numberRow}>
            <TextInput
              keyboardType="number-pad"
              onChangeText={(text) => {
                const parsed = Number.parseInt(text, 10);
                if (Number.isFinite(parsed)) {
                  onChange({ frequencyPerWeek: Math.max(1, parsed) });
                }
              }}
              style={styles.compactNumberInput}
              value={`${draft.frequencyPerWeek}`}
            />
            <AppText tone="muted" variant="caption">
              天
            </AppText>
          </View>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.goalRow}>
          {goalOptions.map((goal) => (
            <Pressable
              accessibilityRole="button"
              key={goal.value}
              onPress={() => onChange({ goal: goal.value })}
              style={[styles.goalChip, draft.goal === goal.value && styles.goalChipActive]}
            >
              <AppText tone={draft.goal === goal.value ? 'brand' : 'muted'} variant="caption" weight="900">
                {goal.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppCard>
  );
}

function PlanDayRow({
  active,
  day,
  onDelete,
  onDuplicate,
}: {
  active: boolean;
  day: PlanDayDraft;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const setCount = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  return (
    <View style={[styles.dayRow, active && styles.dayRowActive]}>
      <View style={[styles.dayBadge, active && styles.dayBadgeActive]}>
        <AppText tone={active ? 'inverse' : 'muted'} variant="caption" weight="900">
          {WEEKDAY_LABELS[day.weekday - 1]}
        </AppText>
      </View>
      <View style={styles.dayText}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {day.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {day.focus} · {day.exercises.length} 动作 · {setCount} 组
        </AppText>
      </View>
      <Pressable accessibilityRole="button" onPress={onDelete} style={styles.iconButton}>
        <Ionicons color={colors.textMuted} name="trash-outline" size={16} />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={onDuplicate} style={styles.iconButton}>
        <Ionicons color={colors.primary} name="copy-outline" size={16} />
      </Pressable>
      <Ionicons color={colors.textSubtle} name="menu-outline" size={18} />
    </View>
  );
}

function PlanExerciseRow({
  draft,
  exercise,
  orderLabel,
  weightUnit,
}: {
  draft: PlanExerciseDraft;
  exercise?: Exercise;
  orderLabel: string;
  weightUnit: 'kg' | 'lb';
}) {
  const badgeStyles = [styles.exercisePriorityA, styles.exercisePriorityB, styles.exercisePriorityC, styles.exercisePriorityD];
  const textStyles = [styles.exercisePriorityTextA, styles.exercisePriorityTextB, styles.exercisePriorityTextC, styles.exercisePriorityTextD];
  const badgeIndex = (orderLabel.charCodeAt(0) - 65) % badgeStyles.length;
  return (
    <View style={styles.exerciseRow}>
      <View style={[styles.exercisePriority, badgeStyles[badgeIndex]]}>
        <AppText style={textStyles[badgeIndex]} variant="bodySmall" weight="900">
          {orderLabel}
        </AppText>
      </View>
      <View style={styles.exerciseName}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {exercise?.name ?? '训练动作'}
        </AppText>
      </View>
      <AppText numberOfLines={1} style={styles.exerciseCell} tone="muted" variant="caption">
        {formatPlanExercisePrescription(draft, weightUnit)}
      </AppText>
      <Ionicons color={colors.textSubtle} name="menu-outline" size={18} />
    </View>
  );
}

function ValidationCard({ validation }: { validation: ReturnType<typeof validatePlanEditorDraft> }) {
  const messages = validation.isValid
    ? [{ label: '所有训练日与动作处方均可保存；修改不会回写历史训练。', ok: true }]
    : validation.errors.map((error) => ({ label: error.message, ok: false }));
  return (
    <AppCard style={styles.card}>
      <SectionHeader title="保存校验" />
      <View style={styles.validationBox}>
        {messages.map((message, index) => (
          <View key={`${message.label}-${index}`} style={styles.validationRow}>
            <Ionicons color={message.ok ? colors.success : colors.warning} name={message.ok ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={18} />
            <AppText tone={message.ok ? 'default' : 'warning'} variant="bodySmall">
              {message.label}
            </AppText>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

function ConfirmSheet({
  message,
  onCancel,
  onConfirm,
  title,
  visible,
}: {
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  visible: boolean;
}) {
  return (
    <AppModalSheet onClose={onCancel} position="center" subtitle={message} title={title} visible={visible}>
      <View style={styles.modalButtons}>
        <AppButton onPress={onCancel} variant="secondary">
          取消
        </AppButton>
        <AppButton onPress={onConfirm} variant="danger">
          确认删除
        </AppButton>
      </View>
    </AppModalSheet>
  );
}


const styles = StyleSheet.create({
  bottomBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    padding: spacing.md,
  },
  bottomIcon: {
    alignItems: 'center',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  bottomText: {
    flex: 1,
    gap: 2,
    minWidth: 120,
  },
  card: {
    gap: spacing.md,
  },
  compactField: {
    minWidth: 72,
  },
  compactInput: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '900',
    minHeight: 28,
    padding: 0,
  },
  compactNumberInput: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '900',
    minWidth: 28,
    padding: 0,
  },
  dayBadge: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  dayBadgeActive: {
    backgroundColor: colors.brand,
  },
  dayList: {
    gap: spacing.sm,
  },
  dayListActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dayListHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayListScroll: {
    maxHeight: 320,
  },
  dayListTitle: {
    gap: 2,
  },
  dayRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.md,
  },
  dayRowActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  dayText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  draggableRowWrap: {
    marginBottom: spacing.sm,
  },
  draggableExerciseWrap: {},
  exerciseCell: {
    minWidth: 64,
    textAlign: 'right',
  },
  exerciseList: {
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  exerciseName: {
    flex: 1,
    minWidth: 0,
  },
  exercisePriority: {
    alignItems: 'center',
    borderRadius: radius.sm,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  exercisePriorityA: {
    backgroundColor: colors.brandSoft,
  },
  exercisePriorityB: {
    backgroundColor: colors.accentSoft,
  },
  exercisePriorityC: {
    backgroundColor: colors.successSoft,
  },
  exercisePriorityD: {
    backgroundColor: colors.warningSoft,
  },
  exercisePriorityTextA: {
    color: colors.brand,
  },
  exercisePriorityTextB: {
    color: colors.accent,
  },
  exercisePriorityTextC: {
    color: colors.success,
  },
  exercisePriorityTextD: {
    color: colors.warning,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 58,
    padding: spacing.md,
  },
  focusInput: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
    padding: 0,
  },
  focusRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  goalChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 30,
    paddingHorizontal: spacing.md,
  },
  goalChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  goalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  iconAction: {
    alignItems: 'center',
    backgroundColor: colors.brandSoft,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  layout: {
    flex: 1,
    gap: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  nameField: {
    flex: 1,
  },
  numberRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  overviewRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.md,
  },
  activeDayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activeDayTitle: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.97 }],
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  validationBox: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  validationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  weekdayChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  weekdayChipActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  weekdaySection: {
    gap: spacing.xs,
  },
  weekTab: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: spacing.md,
  },
  weekTabActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  weekTabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
});
