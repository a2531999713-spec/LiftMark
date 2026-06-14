import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { colors, radius, spacing, typography } from '@/theme';

function parseInteger(value: string, fallback: number): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function CreatePlanRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [name, setName] = useState('我的训练计划');
  const [goal, setGoal] = useState<PlanTemplate['goal']>('strength');
  const [frequency, setFrequency] = useState('4');
  const [durationWeeks, setDurationWeeks] = useState('8');
  const [dayTitle, setDayTitle] = useState('Day 1');
  const [dayFocus, setDayFocus] = useState('全身力量');
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('8');
  const [rpe, setRpe] = useState('7');
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

  const toggleExercise = (exerciseId: string) => {
    setSelectedExerciseIds((current) =>
      current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId].slice(0, 8),
    );
  };

  const savePlan = async () => {
    if (selectedExerciseIds.length === 0) {
      Alert.alert('请选择动作', '至少选择一个动作后再保存计划。');
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

      Alert.alert('已创建计划', `“${plan.name}”已保存到我的计划。`, [
        { text: '回到计划页', onPress: () => router.replace('/(tabs)/plan') },
      ]);
    } catch (saveError) {
      Alert.alert('保存失败', saveError instanceof Error ? saveError.message : '创建计划失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="创建计划" subtitle="从一个可执行训练日开始，后续再扩展完整编辑器。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="创建计划暂时不可用" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <VisualHeroCard
            eyebrow="自定义"
            icon="add-circle-outline"
            imageSource={liftmarkImages.planHero}
            minHeight={154}
            subtitle="先保存基础训练结构，再逐步完善每个训练日。"
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
            <SectionHeader subtitle="第一版先创建一个训练日，完整拖拽排序后续开放。" title="添加动作" />
            <View style={styles.exerciseList}>
              {exercises.slice(0, 16).map((exercise) => {
                const active = selectedExerciseIds.includes(exercise.id);
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={exercise.id}
                    onPress={() => toggleExercise(exercise.id)}
                    style={[styles.exerciseRow, active && styles.exerciseRowActive]}
                  >
                    <Ionicons color={active ? colors.primary : colors.textMuted} name="barbell-outline" size={20} />
                    <View style={styles.exerciseText}>
                      <AppText variant="bodySmall" weight="900">
                        {exercise.name}
                      </AppText>
                      <AppText tone="muted" variant="caption">
                        {exercise.targetMuscle} · {exercise.equipment}
                      </AppText>
                    </View>
                    {active ? <Tag label="已加入" tone="brand" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </AppCard>

          <AppButton disabled={isSaving} icon="save-outline" onPress={() => void savePlan()} size="lg">
            {isSaving ? '保存中...' : '保存为我的计划'}
          </AppButton>
        </>
      ) : null}
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
  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput
        keyboardType={label.includes('天数') || label.includes('周数') || label === '组数' || label === '次数' || label === 'RPE' ? 'number-pad' : 'default'}
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
  fieldRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
  },
  goalRow: {
    flexDirection: 'row',
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
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  exerciseRowActive: {
    borderColor: colors.primary,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
});
