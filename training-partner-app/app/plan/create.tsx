import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function CreatePlanRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [isExercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [name, setName] = useState('我的训练计划');
  const [goal, setGoal] = useState<PlanTemplate['goal']>('strength');
  const [frequency, setFrequency] = useState('4');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [dayTitle, setDayTitle] = useState('Day 1');
  const [dayFocus, setDayFocus] = useState('全身力量');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [rpe, setRpe] = useState('7');
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
          setSelectedExerciseIds(nextExercises.slice(0, 3).map((exercise) => exercise.id));
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
  }, [repositories]);

  const selectedExercises = selectedExerciseIds
    .map((id) => exercises.find((exercise) => exercise.id === id))
    .filter((exercise): exercise is Exercise => Boolean(exercise));

  const addExercise = (exercise: Exercise) => {
    setSelectedExerciseIds((current) => {
      if (current.includes(exercise.id)) {
        return current;
      }

      return [...current, exercise.id].slice(0, 12);
    });
  };

  const removeExercise = (exerciseId: string) => {
    setSelectedExerciseIds((current) => current.filter((id) => id !== exerciseId));
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

    if (selectedExerciseIds.length === 0) {
      setNotice({
        title: '请选择动作',
        message: '至少添加一个动作后再保存计划。',
      });
      return;
    }

    setIsSaving(true);
    try {
      const plan = await repositories.planRepository.createUserPlan({
        days: [
          {
            exercises: selectedExerciseIds.map((exerciseId, index) => ({
              exerciseId,
              priority: index === 0 ? 'A' : index <= 2 ? 'B' : 'C',
              reps: parseInteger(reps, 8),
              rpeTarget: Number(rpe) || 7,
              sets: parseInteger(sets, 3),
            })),
            focus: dayFocus,
            title: dayTitle,
            weekday: 1,
          },
        ],
        durationWeeks: parseInteger(durationWeeks, 8),
        frequencyPerWeek: parseInteger(frequency, 4),
        goal,
        name,
      });

      setCreatedPlan(plan);
      setNotice({
        title: '已创建计划',
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
    <Screen title="创建计划" subtitle="从一个可执行训练日开始，后续再逐步完善。">
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
            title="创建自己的训练计划"
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
            <SectionHeader title="训练日" />
            <View style={styles.fieldRow}>
              <Field label="训练日名称" onChangeText={setDayTitle} value={dayTitle} />
              <Field label="训练重点" onChangeText={setDayFocus} value={dayFocus} />
            </View>
            <View style={styles.fieldRow}>
              <Field label="组数" onChangeText={setSets} value={sets} />
              <Field label="次数" onChangeText={setReps} value={reps} />
              <Field label="RPE" onChangeText={setRpe} value={rpe} />
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <SectionHeader
              actionLabel="添加动作"
              onActionPress={() => {
                if (guardFeature('create_plan')) setExercisePickerVisible(true);
              }}
              subtitle="从动作库选择；没有就快速新建自定义动作。"
              title="训练动作"
            />
            {selectedExercises.length === 0 ? (
              <EmptyState
                actionLabel="添加动作"
                description="添加动作后，这个训练日就可以保存为我的计划。"
                onActionPress={() => {
                  if (guardFeature('create_plan')) setExercisePickerVisible(true);
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
                    <Pressable accessibilityRole="button" onPress={() => removeExercise(exercise.id)} style={styles.removeButton}>
                      <Ionicons color={colors.danger} name="close-outline" size={18} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </AppCard>

          <AppButton disabled={isSaving} icon="save-outline" onPress={() => void savePlan()} size="lg">
            {isSaving ? '保存中...' : '保存为我的计划'}
          </AppButton>
        </>
      ) : null}

      <ExercisePickerSheet
        exercises={exercises}
        onClose={() => setExercisePickerVisible(false)}
        onCreateCustomExercise={createCustomExercise}
        onSelect={addExercise}
        selectedExerciseIds={selectedExerciseIds}
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
                router.replace('/(tabs)/plan');
              }}
            >
              回到计划页
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
    label.includes('天数') || label.includes('周数') || label === '组数' || label === '次数' || label === 'RPE';

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
