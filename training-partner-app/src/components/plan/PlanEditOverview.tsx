import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import { PlanExerciseSettingsSheet } from '@/components/plan-editor/PlanExerciseSettingsSheet';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, SectionHeader, Tag } from '@/components/ui';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { colors, radius, spacing, typography } from '@/theme';

import { createPlanDraftId, createPlanExerciseDraft } from './planEditDraft';
import type { PlanDayDraft, PlanEditDraft, PlanExerciseDraft, PlanExerciseMap } from './planEditTypes';

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
  const [isOrdering, setOrdering] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [settingsTarget, setSettingsTarget] = useState<{ dayId: string; exerciseDraftId: string } | null>(null);
  const [deleteExerciseTarget, setDeleteExerciseTarget] = useState<{ dayId: string; exerciseDraftId: string } | null>(null);
  const [deleteDayTarget, setDeleteDayTarget] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState | null>(null);

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
  const validation = useMemo(() => validateDraft(draft), [draft]);
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

  const moveDayInWeek = (dayId: string, direction: -1 | 1) => {
    const currentIndex = visibleDays.findIndex((day) => day.id === dayId);
    const targetIndex = currentIndex + direction;
    const targetDay = visibleDays[targetIndex];
    const currentDay = visibleDays[currentIndex];
    if (!currentDay || !targetDay) return;

    updateDraftDays((days) =>
      days.map((day) => {
        if (day.id === currentDay.id) return { ...day, weekday: targetDay.weekday };
        if (day.id === targetDay.id) return { ...day, weekday: currentDay.weekday };
        return day;
      }),
    );
  };

  const moveExerciseInDay = (dayId: string, exerciseDraftId: string, direction: -1 | 1) => {
    updateDraftDays((days) =>
      days.map((day) => {
        if (day.id !== dayId) return day;
        const currentIndex = day.exercises.findIndex((exercise) => exercise.id === exerciseDraftId);
        const targetIndex = currentIndex + direction;
        if (currentIndex < 0 || targetIndex < 0 || targetIndex >= day.exercises.length) return day;
        const nextExercises = [...day.exercises];
        const [moved] = nextExercises.splice(currentIndex, 1);
        nextExercises.splice(targetIndex, 0, moved);
        return {
          ...day,
          exercises: nextExercises.map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
        };
      }),
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
            {
              ...settingsExercise,
              id: createPlanDraftId('plan_exercise'),
              orderIndex: day.exercises.length,
            },
          ],
        };
      }),
    );
    setSettingsTarget(null);
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
        <View style={styles.stateTags}>
          <Tag label="未保存修改" tone="warning" />
          <Tag label="历史记录不受影响" tone="brand" />
          <Tag label={planSource === 'system' ? '只读副本' : '可编辑'} tone={planSource === 'system' ? 'neutral' : 'success'} />
        </View>

        <PlanOverviewCard draft={draft} onChange={onChange} />

        <AppCard style={styles.card}>
          <SectionHeader
            actionLabel="+ 训练日"
            onActionPress={() => onAddDay(effectiveSelectedWeek)}
            title="训练日列表"
          />
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
          <View style={styles.dayToolbar}>
            <AppButton icon="copy-outline" onPress={copySelectedWeekToNextWeek} size="sm" variant="secondary">
              复制到下一周
            </AppButton>
            <AppButton icon="swap-vertical-outline" onPress={() => setOrdering((current) => !current)} size="sm" variant={isOrdering ? 'primary' : 'secondary'}>
              {isOrdering ? '完成排序' : '调整顺序'}
            </AppButton>
          </View>
          <ScrollView style={styles.dayListScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.dayList}>
              {visibleDays.map((day) => (
                <PlanDayRow
                  active={day.id === activeDay?.id}
                  canMoveDown={visibleDays.findIndex((item) => item.id === day.id) < visibleDays.length - 1}
                  canMoveUp={visibleDays.findIndex((item) => item.id === day.id) > 0}
                  day={day}
                  isOrdering={isOrdering}
                  key={day.id}
                  onDelete={() => setDeleteDayTarget(day.id)}
                  onMoveDown={() => moveDayInWeek(day.id, 1)}
                  onMoveUp={() => moveDayInWeek(day.id, -1)}
                  onPress={() => setActiveDayId(day.id)}
                />
              ))}
            </View>
          </ScrollView>
        </AppCard>

        {activeDay ? (
          <>
            <AppCard style={styles.card}>
              <SectionHeader
                actionLabel="+ 动作"
                onActionPress={() => setPickerTarget({ dayId: activeDay.id })}
                title={`W${activeDay.week} D${activeDay.weekday} · ${activeDay.title}`}
              />
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
                    <PlanExerciseRow
                      draft={exerciseDraft}
                      exercise={exerciseMap[exerciseDraft.exerciseId]}
                      key={exerciseDraft.id}
                      orderLabel={String.fromCharCode(65 + index)}
                      orderIndex={index}
                      isOrdering={isOrdering}
                      onMoveDown={() => moveExerciseInDay(activeDay.id, exerciseDraft.id, 1)}
                      onMoveUp={() => moveExerciseInDay(activeDay.id, exerciseDraft.id, -1)}
                      onPress={() => setSettingsTarget({ dayId: activeDay.id, exerciseDraftId: exerciseDraft.id })}
                    />
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
            {activeDay ? `W${activeDay.week} D${activeDay.weekday} · ${activeDay.title}` : '选择训练日'}
          </AppText>
        </View>
        <AppButton onPress={() => setNotice({ title: '放弃修改', message: '当前版本请使用系统返回后重新进入计划编辑；未保存草稿不会写入历史。' })} variant="secondary">
          放弃修改
        </AppButton>
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
        visible={Boolean(settingsTarget)}
      />

      <ConfirmSheet
        message="删除后该训练日不再包含这个动作，保存计划后才会写入模板。"
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

function PlanOverviewCard({
  draft,
  onChange,
}: {
  draft: PlanEditDraft;
  onChange: (patch: Partial<PlanEditDraft>) => void;
}) {
  return (
    <AppCard style={styles.card}>
      <SectionHeader title="计划概览" />
      <View style={styles.overviewGrid}>
        <TextField
          icon="document-text-outline"
          label="计划名称"
          onChangeText={(name) => onChange({ name })}
          value={draft.name}
          wide
        />
        <NumberField label="周期" onChange={(durationWeeks) => onChange({ durationWeeks })} suffix="周" value={draft.durationWeeks} />
        <NumberField label="频率" onChange={(frequencyPerWeek) => onChange({ frequencyPerWeek })} suffix="天/周" value={draft.frequencyPerWeek} />
      </View>
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
    </AppCard>
  );
}

function PlanDayRow({
  active,
  canMoveDown,
  canMoveUp,
  day,
  isOrdering,
  onDelete,
  onMoveDown,
  onMoveUp,
  onPress,
}: {
  active: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  day: PlanDayDraft;
  isOrdering: boolean;
  onDelete: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onPress: () => void;
}) {
  const setCount = day.exercises.reduce((sum, exercise) => sum + exercise.sets, 0);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.dayRow, active && styles.dayRowActive, pressed && styles.pressed]}>
      <View style={[styles.timelineDot, active && styles.timelineDotActive]} />
      <AppText style={styles.dayCode} tone={active ? 'brand' : 'default'} variant="bodySmall" weight="900">
        W{day.week} D{day.weekday}
      </AppText>
      <View style={styles.dayText}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {day.title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {day.focus}
        </AppText>
      </View>
      <AppText tone="muted" variant="caption">
        {day.exercises.length} 动作 · {setCount} 计划组
      </AppText>
      {isOrdering ? (
        <View style={styles.orderButtons}>
          <Pressable accessibilityRole="button" disabled={!canMoveUp} onPress={onMoveUp} style={[styles.iconButton, !canMoveUp && styles.disabledButton]}>
            <Ionicons color={colors.textMuted} name="chevron-up" size={16} />
          </Pressable>
          <Pressable accessibilityRole="button" disabled={!canMoveDown} onPress={onMoveDown} style={[styles.iconButton, !canMoveDown && styles.disabledButton]}>
            <Ionicons color={colors.textMuted} name="chevron-down" size={16} />
          </Pressable>
        </View>
      ) : (
        <Pressable accessibilityRole="button" onPress={onDelete} style={styles.iconButton}>
          <Ionicons color={colors.textMuted} name="trash-outline" size={16} />
        </Pressable>
      )}
    </Pressable>
  );
}

function PlanExerciseRow({
  draft,
  exercise,
  isOrdering,
  onMoveDown,
  onMoveUp,
  onPress,
  orderLabel,
  orderIndex,
}: {
  draft: PlanExerciseDraft;
  exercise?: Exercise;
  isOrdering: boolean;
  onMoveDown: () => void;
  onMoveUp: () => void;
  onPress: () => void;
  orderLabel: string;
  orderIndex: number;
}) {
  const badgeStyles = [styles.exercisePriorityA, styles.exercisePriorityB, styles.exercisePriorityC, styles.exercisePriorityD];
  const textStyles = [styles.exercisePriorityTextA, styles.exercisePriorityTextB, styles.exercisePriorityTextC, styles.exercisePriorityTextD];
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.exerciseRow, pressed && styles.pressed]}>
      <View style={[styles.exercisePriority, badgeStyles[orderIndex % badgeStyles.length]]}>
        <AppText style={textStyles[orderIndex % textStyles.length]} variant="bodySmall" weight="900">
          {orderLabel}
        </AppText>
      </View>
      <View style={styles.exerciseName}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {exercise?.name ?? '训练动作'}
        </AppText>
      </View>
      <AppText style={styles.exerciseCell} tone="muted" variant="caption">
        {formatReps(draft)}
      </AppText>
      <AppText style={styles.exerciseCell} tone="muted" variant="caption">
        休息 {draft.restSeconds ?? 90} 秒
      </AppText>
      {isOrdering ? (
        <View style={styles.orderButtons}>
          <Pressable accessibilityRole="button" onPress={onMoveUp} style={styles.iconButton}>
            <Ionicons color={colors.textMuted} name="chevron-up" size={15} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onMoveDown} style={styles.iconButton}>
            <Ionicons color={colors.textMuted} name="chevron-down" size={15} />
          </Pressable>
        </View>
      ) : (
        <Ionicons color={colors.textMuted} name="menu-outline" size={18} />
      )}
    </Pressable>
  );
}

function ValidationCard({ validation }: { validation: ReturnType<typeof validateDraft> }) {
  return (
    <AppCard style={styles.card}>
      <SectionHeader title="保存校验" />
      <View style={styles.validationBox}>
        {validation.messages.map((message) => (
          <View key={message.label} style={styles.validationRow}>
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

function TextField({
  icon,
  label,
  onChangeText,
  value,
  wide = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onChangeText: (value: string) => void;
  value: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.inputCard, wide && styles.inputCardWide]}>
      <View style={styles.inlineLabel}>
        <Ionicons color={colors.accent} name={icon} size={17} />
        <AppText tone="muted" variant="caption">
          {label}
        </AppText>
      </View>
      <TextInput onChangeText={onChangeText} style={styles.input} value={value} />
    </View>
  );
}

function NumberField({
  label,
  onChange,
  suffix,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  suffix: string;
  value: number;
}) {
  return (
    <View style={styles.inputCardCompact}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.numberInputRow}>
        <TextInput
          keyboardType="number-pad"
          onChangeText={(text) => {
            const parsed = Number.parseInt(text, 10);
            if (Number.isFinite(parsed)) {
              onChange(Math.max(1, parsed));
            }
          }}
          style={styles.numberInput}
          value={`${value}`}
        />
        <AppText tone="muted" variant="caption">
          {suffix}
        </AppText>
      </View>
    </View>
  );
}

function validateDraft(draft: PlanEditDraft) {
  const emptyDays = draft.days.filter((day) => day.exercises.length === 0);
  const incompleteExercises = draft.days.flatMap((day) =>
    day.exercises.filter((exercise) => {
      const hasReps = Boolean(exercise.reps) || Boolean(exercise.repMin && exercise.repMax);
      return !exercise.sets || !hasReps || !exercise.restSeconds;
    }),
  );
  const errors = [
    emptyDays.length > 0 ? `有 ${emptyDays.length} 个训练日还没有动作。` : null,
    incompleteExercises.length > 0 ? `有 ${incompleteExercises.length} 个动作缺少组数、次数或休息。` : null,
  ].filter((item): item is string => Boolean(item));

  return {
    errors,
    isValid: errors.length === 0,
    messages: [
      { label: '每个训练日至少 1 个动作', ok: emptyDays.length === 0 },
      { label: '动作组数、次数、休息时间已完整', ok: incompleteExercises.length === 0 },
      { label: '该修改不会回写历史训练', ok: true },
    ],
  };
}

function formatReps(exercise: PlanExerciseDraft) {
  if (exercise.repMin && exercise.repMax) {
    return `${exercise.sets}组 × ${exercise.repMin}-${exercise.repMax}次`;
  }
  return `${exercise.sets}组 × ${exercise.reps ?? 8}次`;
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
  dayCode: {
    minWidth: 48,
  },
  dayList: {
    gap: spacing.sm,
  },
  dayListScroll: {
    maxHeight: 286,
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
  dayToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exerciseCell: {
    minWidth: 68,
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
  goalChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  goalChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  iconButton: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  disabledButton: {
    opacity: 0.35,
  },
  inlineLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 30,
    padding: 0,
  },
  inputCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minHeight: 64,
    minWidth: '46%',
    padding: spacing.md,
  },
  inputCardCompact: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexGrow: 1,
    flexShrink: 1,
    gap: spacing.xs,
    minHeight: 64,
    minWidth: 92,
    padding: spacing.md,
  },
  inputCardWide: {
    flexBasis: '54%',
    flexGrow: 2,
  },
  layout: {
    flex: 1,
    gap: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  numberInput: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '900',
    minHeight: 30,
    padding: 0,
  },
  numberInputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  orderButtons: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  overviewGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  stateTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineDot: {
    backgroundColor: colors.surface,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 20,
    width: 20,
  },
  timelineDotActive: {
    backgroundColor: colors.brand,
    borderColor: colors.brand,
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
