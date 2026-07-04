import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import { PlanDayEditor } from '@/components/plan/PlanDayEditor';
import { buildPlanEditDraft, createPlanExerciseDraft, toUpdateUserPlanInput } from '@/components/plan/planEditDraft';
import type { PlanDayDraft, PlanEditDraft, PlanExerciseDraft, PlanExerciseMap } from '@/components/plan/planEditTypes';
import { EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors } from '@/theme';

type EditDayState = {
  allExercises: Exercise[];
  day: PlanDayDraft;
  draft: PlanEditDraft;
  exerciseMap: PlanExerciseMap;
  plan: PlanTemplate;
};

export default function PlanEditDayRoute() {
  const { dayId, planId } = useLocalSearchParams<{ dayId: string; planId?: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [state, setState] = useState<EditDayState | null>(null);
  const [isPickerVisible, setPickerVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!dayId || !planId) {
        setError('缺少训练日或计划 ID。');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        await initializeLocalDatabase();
        const plan = await repositories.planRepository.getPlanById(planId);
        if (!plan) {
          throw new Error('计划不存在或已被移除。');
        }
        const days = await repositories.planRepository.listPlanDays(plan.id);
        const exerciseLists = await Promise.all(days.map((day) => repositories.planRepository.listPlanExercises(day.id)));
        const draft = buildPlanEditDraft(plan, days, exerciseLists);
        const day = draft.days.find((item) => item.id === dayId);
        if (!day) {
          throw new Error('训练日不存在，请返回计划编辑页重新进入。');
        }
        const allExercises = await repositories.exerciseRepository.listExercises();
        if (mounted) {
          setState({
            allExercises,
            day,
            draft,
            exerciseMap: Object.fromEntries(allExercises.map((exercise) => [exercise.id, exercise])),
            plan,
          });
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '训练日编辑加载失败。');
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [dayId, planId, repositories]);

  const commitDay = (nextDay: PlanDayDraft) => {
    setState((current) =>
      current
        ? {
            ...current,
            day: nextDay,
            draft: {
              ...current.draft,
              days: current.draft.days.map((day) => (day.id === nextDay.id ? nextDay : day)),
            },
          }
        : current,
    );
  };

  const changeDay = (patch: Partial<PlanDayDraft>) => {
    if (!state) return;
    commitDay({ ...state.day, ...patch });
  };

  const changeExercise = (exerciseId: string, patch: Partial<PlanExerciseDraft>) => {
    if (!state) return;
    commitDay({
      ...state.day,
      exercises: state.day.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...patch } : exercise)),
    });
  };

  const moveExercise = (exerciseId: string, direction: 'up' | 'down') => {
    if (!state) return;
    const index = state.day.exercises.findIndex((exercise) => exercise.id === exerciseId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= state.day.exercises.length) return;
    const next = [...state.day.exercises];
    const [item] = next.splice(index, 1);
    next.splice(targetIndex, 0, item);
    commitDay({
      ...state.day,
      exercises: next.map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
    });
  };

  const copyPreviousExerciseParams = () => {
    if (!state || state.day.exercises.length < 2) {
      Alert.alert('暂无可复制参数', '至少需要两个动作，才能把上一动作参数复制到最后一个动作。');
      return;
    }
    const exercises = state.day.exercises;
    const previous = exercises[exercises.length - 2];
    const target = exercises[exercises.length - 1];
    changeExercise(target.id, {
      priority: previous.priority,
      reps: previous.reps,
      sets: previous.sets,
    });
  };

  const addExercise = (exercise: Exercise) => {
    if (!state || state.day.exercises.some((item) => item.exerciseId === exercise.id)) {
      return;
    }

    const nextExercise = createPlanExerciseDraft(exercise.id, state.day.exercises.length);
    commitDay({
      ...state.day,
      exercises: [...state.day.exercises, nextExercise],
    });
    setState((current) =>
      current
        ? {
            ...current,
            allExercises: current.allExercises.some((item) => item.id === exercise.id)
              ? current.allExercises
              : [exercise, ...current.allExercises],
            exerciseMap: { ...current.exerciseMap, [exercise.id]: exercise },
          }
        : current,
    );
    setPickerVisible(false);
  };

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    if (!guardFeature('create_plan')) {
      throw new Error('请先登录后再创建自定义动作。');
    }
    const exercise = await repositories.exerciseRepository.createCustomExercise(input);
    addExercise(exercise);
    return exercise;
  };

  const save = async () => {
    if (!state || !planId) {
      return;
    }

    if (state.day.exercises.length === 0) {
      Alert.alert('还没有动作', '至少添加一个动作后再保存训练日。');
      return;
    }

    setIsSaving(true);
    try {
      await repositories.planRepository.updateUserPlan(toUpdateUserPlanInput(planId, state.draft));
      Alert.alert('已保存', '训练日动作已更新，后续训练会读取新结构。');
      router.replace({ pathname: '/plan/edit/[planId]', params: { planId } } as never);
    } catch (saveError) {
      Alert.alert('保存失败', saveError instanceof Error ? saveError.message : '训练日暂时无法保存。');
    } finally {
      setIsSaving(false);
    }
  };

  const isReadonly = state?.plan.source === 'system' || state?.plan.visibility === 'system';

  return (
    <Screen subtitle="只编辑一个训练日；返回概览管理计划摘要。" title="编辑训练日">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="训练日编辑暂时不可用" description={error} /> : null}

      {!isLoading && state && isReadonly ? (
        <EmptyState description="系统计划不可直接编辑。请先复制为我的计划。" title="只读系统计划" />
      ) : null}

      {!isLoading && state && !isReadonly ? (
        <PlanDayEditor
          day={state.day}
          exerciseMap={state.exerciseMap}
          isSaving={isSaving}
          onAddExercise={() => setPickerVisible(true)}
          onChangeDay={changeDay}
          onChangeExercise={changeExercise}
          onCopyPreviousExerciseParams={copyPreviousExerciseParams}
          onMoveExercise={moveExercise}
          onRemoveExercise={(exerciseId) =>
            commitDay({
              ...state.day,
              exercises: state.day.exercises
                .filter((exercise) => exercise.id !== exerciseId)
                .map((exercise, orderIndex) => ({ ...exercise, orderIndex })),
            })
          }
          onSave={() => void save()}
        />
      ) : null}

      <ExercisePickerSheet
        exercises={state?.allExercises ?? []}
        onClose={() => setPickerVisible(false)}
        onCreateCustomExercise={createCustomExercise}
        onSelect={addExercise}
        selectedExerciseIds={state?.day.exercises.map((exercise) => exercise.exerciseId)}
        title="添加计划动作"
        visible={isPickerVisible}
      />

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}
