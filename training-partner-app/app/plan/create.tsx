import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ExercisePickerSheet, formatExerciseEquipment } from '@/components/exercises/ExercisePickerSheet';
import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

type PlanDayDraft = {
  exerciseIds: string[];
  focus: string;
  id: string;
  reps: string;
  sets: string;
  title: string;
  week: string;
  weekday: string;
};

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function createDraftId() {
  return `day_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createDefaultDayDraft(index = 0): PlanDayDraft {
  return {
    exerciseIds: [],
    focus: index === 0 ? '全身力量' : '训练重点',
    id: createDraftId(),
    reps: '8',
    sets: '3',
    title: `Day ${index + 1}`,
    week: '1',
    weekday: `${Math.min(7, index + 1)}`,
  };
}

export default function CreatePlanRoute() {
  const params = useLocalSearchParams<{ editPlanId?: string }>();
  const editPlanId = typeof params.editPlanId === 'string' ? params.editPlanId : undefined;
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [dayDrafts, setDayDrafts] = useState<PlanDayDraft[]>([createDefaultDayDraft()]);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [isExercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [name, setName] = useState('我的训练计划');
  const [goal, setGoal] = useState<PlanTemplate['goal']>('strength');
  const [frequency, setFrequency] = useState('4');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [createdPlan, setCreatedPlan] = useState<PlanTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadExercises() {
      setIsLoading(true);
      setError(null);

      try {
        await initializeLocalDatabase();
        const nextExercises = await repositories.exerciseRepository.listExercises();
        if (mounted) {
          setExercises(nextExercises);
        }

        if (editPlanId) {
          const plan = await repositories.planRepository.getPlanById(editPlanId);
          if (!plan) {
            throw new Error('计划不存在或已被移除。');
          }
          if (plan.source === 'system' || plan.visibility === 'system') {
            throw new Error('系统方案是只读模板，请先复制为我的计划后再编辑。');
          }

          const days = await repositories.planRepository.listPlanDays(plan.id);
          const planExercises = await Promise.all(days.map((day) => repositories.planRepository.listPlanExercises(day.id)));

          if (mounted) {
            setName(plan.name);
            setGoal(plan.goal);
            setFrequency(`${plan.frequencyPerWeek}`);
            setDurationWeeks(`${plan.durationWeeks}`);
            setDayDrafts(
              days.length > 0
                ? days.map((day, index) => ({
                    exerciseIds: (planExercises[index] ?? []).map((exercise) => exercise.exerciseId),
                    focus: day.focus,
                    id: day.id,
                    reps: `${(planExercises[index] ?? [])[0]?.reps ?? 8}`,
                    sets: `${(planExercises[index] ?? [])[0]?.sets ?? 3}`,
                    title: day.title,
                    week: `${day.week}`,
                    weekday: `${day.weekday}`,
                  }))
                : [createDefaultDayDraft()],
            );
          }
        } else if (mounted) {
          const draft = createDefaultDayDraft();
          setDayDrafts([{ ...draft, exerciseIds: nextExercises.slice(0, 3).map((exercise) => exercise.id) }]);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '创建计划准备失败。');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadExercises();

    return () => {
      mounted = false;
    };
  }, [editPlanId, repositories]);

  const activeDay = dayDrafts.find((day) => day.id === activeDayId) ?? dayDrafts[0] ?? null;
  const activeExerciseIds = activeDay?.exerciseIds ?? [];

  const getSelectedExercises = (day: PlanDayDraft) =>
    day.exerciseIds
      .map((id) => exercises.find((exercise) => exercise.id === id))
      .filter((exercise): exercise is Exercise => Boolean(exercise));

  const updateDayDraft = (dayId: string, patch: Partial<PlanDayDraft>) => {
    setDayDrafts((current) => current.map((day) => (day.id === dayId ? { ...day, ...patch } : day)));
  };

  const addExercise = (exercise: Exercise) => {
    const targetDayId = activeDay?.id ?? dayDrafts[0]?.id;
    if (!targetDayId) {
      return;
    }

    setDayDrafts((current) =>
      current.map((day) =>
        day.id === targetDayId && !day.exerciseIds.includes(exercise.id)
          ? { ...day, exerciseIds: [...day.exerciseIds, exercise.id].slice(0, 12) }
          : day,
      ),
    );
  };

  const removeExercise = (dayId: string, exerciseId: string) => {
    setDayDrafts((current) =>
      current.map((day) =>
        day.id === dayId ? { ...day, exerciseIds: day.exerciseIds.filter((id) => id !== exerciseId) } : day,
      ),
    );
  };

  const addDayDraft = () => {
    setDayDrafts((current) => [...current, createDefaultDayDraft(current.length)]);
  };

  const removeDayDraft = (dayId: string) => {
    setDayDrafts((current) => (current.length > 1 ? current.filter((day) => day.id !== dayId) : current));
  };

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    if (!guardFeature('create_plan')) {
      throw new Error('请先登录后再创建自定义动作。');
    }

    const exercise = await repositories.exerciseRepository.createCustomExercise(input);
    setExercises((current) => [exercise, ...current]);
    addExercise(exercise);
    return exercise;
  };

  const savePlan = async () => {
    if (!guardFeature('create_plan')) {
      return;
    }

    const emptyDay = dayDrafts.find((day) => day.exerciseIds.length === 0);
    if (emptyDay) {
      setNotice({
        title: '请选择动作',
        message: `“${emptyDay.title || '训练日'}”至少添加一个动作后再保存计划。`,
      });
      return;
    }

    setIsSaving(true);
    try {
      const input = {
        days: dayDrafts.map((day) => ({
          exercises: day.exerciseIds.map((exerciseId, index) => ({
            exerciseId,
            priority: index === 0 ? 'A' as const : index <= 2 ? 'B' as const : 'C' as const,
            reps: parseInteger(day.reps, 8),
            sets: parseInteger(day.sets, 3),
          })),
          focus: day.focus,
          title: day.title,
          week: parseInteger(day.week, 1),
          weekday: Math.min(7, Math.max(1, parseInteger(day.weekday, 1))) as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        })),
        durationWeeks: parseInteger(durationWeeks, 8),
        frequencyPerWeek: parseInteger(frequency, 4),
        goal,
        name,
      };
      const plan = editPlanId
        ? await repositories.planRepository.updateUserPlan({ ...input, planId: editPlanId })
        : await repositories.planRepository.createUserPlan(input);

      setCreatedPlan(plan);
      setNotice({
        title: editPlanId ? '已保存计划' : '已创建计划',
        message: `“${plan.name}”已保存到我的计划。`,
      });
    } catch (saveError) {
      setNotice({
        title: '保存失败',
        message: saveError instanceof Error ? saveError.message : '创建计划失败。',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen subtitle={editPlanId ? '编辑计划结构后会影响后续训练读取。' : '从可执行训练日开始，后续再逐步完善。'}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="创建计划暂时不可用" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <VisualHeroCard
            eyebrow="自定义"
            icon="add-circle-outline"
            imageSource={liftmarkImages.planHero}
            minHeight={154}
            subtitle="先保存基础训练结构，动作来自系统动作库或你的自定义动作。"
            title={editPlanId ? '编辑训练计划' : '创建自己的训练计划'}
          />

          <AppCard style={styles.card}>
            <SectionHeader title="基本信息" />
            <Field label="计划名称" onChangeText={setName} value={name} />
            <View style={styles.goalRow}>
              <GoalChip active={goal === 'strength'} label="增力" onPress={() => setGoal('strength')} />
              <GoalChip active={goal === 'hypertrophy'} label="增肌" onPress={() => setGoal('hypertrophy')} />
              <GoalChip active={goal === 'general'} label="通用" onPress={() => setGoal('general')} />
            </View>
            <View style={styles.fieldRow}>
              <Field label="每周训练天数" onChangeText={setFrequency} value={frequency} />
              <Field label="周期周数" onChangeText={setDurationWeeks} value={durationWeeks} />
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <SectionHeader
              actionLabel="新增训练日"
              onActionPress={addDayDraft}
              subtitle="每个训练日有独立动作、周次、星期、组数和次数。"
              title="训练日"
            />
            <View style={styles.dayDraftList}>
              {dayDrafts.map((day, dayIndex) => {
                const selectedExercises = getSelectedExercises(day);

                return (
                  <View key={day.id} style={styles.dayDraftCard}>
                    <View style={styles.dayDraftHeader}>
                      <View style={styles.exerciseOrder}>
                        <AppText tone="inverse" variant="caption" weight="900">
                          {dayIndex + 1}
                        </AppText>
                      </View>
                      <View style={styles.exerciseText}>
                        <AppText variant="bodySmall" weight="900">
                          {day.title || `Day ${dayIndex + 1}`}
                        </AppText>
                        <AppText tone="muted" variant="caption">
                          第 {day.week || 1} 周 · 周 {day.weekday || 1} · {selectedExercises.length} 个动作
                        </AppText>
                      </View>
                      {dayDrafts.length > 1 ? (
                        <Pressable accessibilityRole="button" onPress={() => removeDayDraft(day.id)} style={styles.removeButton}>
                          <Ionicons color={colors.danger} name="trash-outline" size={18} />
                        </Pressable>
                      ) : null}
                    </View>

                    <View style={styles.fieldRow}>
                      <Field label="训练日名称" onChangeText={(value) => updateDayDraft(day.id, { title: value })} value={day.title} />
                      <Field label="训练重点" onChangeText={(value) => updateDayDraft(day.id, { focus: value })} value={day.focus} />
                    </View>
                    <View style={styles.fieldRow}>
                      <Field label="周次" onChangeText={(value) => updateDayDraft(day.id, { week: value })} value={day.week} />
                      <Field label="星期" onChangeText={(value) => updateDayDraft(day.id, { weekday: value })} value={day.weekday} />
                      <Field label="组数" onChangeText={(value) => updateDayDraft(day.id, { sets: value })} value={day.sets} />
                      <Field label="次数" onChangeText={(value) => updateDayDraft(day.id, { reps: value })} value={day.reps} />
                    </View>

                    <View style={styles.inlineActions}>
                      <AppButton
                        icon="add-outline"
                        onPress={() => {
                          if (guardFeature('create_plan')) {
                            setActiveDayId(day.id);
                            setExercisePickerVisible(true);
                          }
                        }}
                        size="sm"
                        variant="secondary"
                      >
                        添加动作
                      </AppButton>
                    </View>

                    {selectedExercises.length === 0 ? (
                      <EmptyState
                        actionLabel="添加动作"
                        description="添加动作后，这个训练日就可以保存。"
                        onActionPress={() => {
                          if (guardFeature('create_plan')) {
                            setActiveDayId(day.id);
                            setExercisePickerVisible(true);
                          }
                        }}
                        title="还没有动作"
                      />
                    ) : (
                      <View style={styles.exerciseList}>
                        {selectedExercises.map((exercise, index) => (
                          <View key={exercise.id} style={styles.exerciseRow}>
                            <View style={styles.exerciseOrder}>
                              <AppText tone="inverse" variant="caption" weight="900">
                                {index + 1}
                              </AppText>
                            </View>
                            <View style={styles.exerciseText}>
                              <AppText variant="bodySmall" weight="900">
                                {exercise.name}
                              </AppText>
                              <AppText tone="muted" variant="caption">
                                {exercise.targetMuscle} · {formatExerciseEquipment(exercise.equipment)}
                              </AppText>
                            </View>
                            <Tag label={exercise.source === 'custom' ? '自定义' : '系统'} tone={exercise.source === 'custom' ? 'brand' : 'neutral'} />
                            <Pressable accessibilityRole="button" onPress={() => removeExercise(day.id, exercise.id)} style={styles.removeButton}>
                              <Ionicons color={colors.danger} name="close-outline" size={18} />
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </AppCard>

          <AppButton disabled={isSaving} icon="save-outline" onPress={() => void savePlan()} size="lg">
            {isSaving ? '保存中...' : editPlanId ? '保存计划' : '保存为我的计划'}
          </AppButton>
        </>
      ) : null}

      <ExercisePickerSheet
        exercises={exercises}
        onClose={() => setExercisePickerVisible(false)}
        onCreateCustomExercise={createCustomExercise}
        onSelect={addExercise}
        selectedExerciseIds={activeExerciseIds}
        title="添加训练动作"
        visible={isExercisePickerVisible}
      />

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <View style={styles.modalButtons}>
          {createdPlan ? (
            <AppButton
              onPress={() => {
                setNotice(null);
                router.replace(
                  editPlanId
                    ? ({ pathname: '/plan/[planId]', params: { planId: createdPlan.id } } as never)
                    : '/(tabs)/plan',
                );
              }}
            >
              {editPlanId ? '查看计划' : '回到计划页'}
            </AppButton>
          ) : null}
          <AppButton onPress={() => setNotice(null)} variant={createdPlan ? 'secondary' : 'primary'}>
            知道了
          </AppButton>
        </View>
      </AppModalSheet>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function Field({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  const isNumber =
    label.includes('天数') ||
    label.includes('周数') ||
    label === '周次' ||
    label === '星期' ||
    label === '组数' ||
    label === '次数';

  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput
        keyboardType={isNumber ? 'number-pad' : 'default'}
        onChangeText={onChangeText}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function GoalChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.goalChip, active && styles.goalChipActive]}>
      <AppText tone={active ? 'inverse' : 'default'} variant="bodySmall" weight="900">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  dayDraftCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  dayDraftHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  dayDraftList: {
    gap: spacing.md,
  },
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseOrder: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  field: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: '30%',
    padding: spacing.md,
  },
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  goalChip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  goalChipActive: {
    backgroundColor: colors.primary,
  },
  goalRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  removeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
});
