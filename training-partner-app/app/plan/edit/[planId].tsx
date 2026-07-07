import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { PlanEditOverview } from '@/components/plan/PlanEditOverview';
import { buildPlanEditDraft, createEmptyPlanDayDraft, toUpdateUserPlanInput } from '@/components/plan/planEditDraft';
import type { PlanEditDraft, PlanExerciseMap } from '@/components/plan/planEditTypes';
import { AppButton, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { colors } from '@/theme';

type PlanEditState = {
  allExercises: Exercise[];
  draft: PlanEditDraft;
  exerciseMap: PlanExerciseMap;
  plan: PlanTemplate;
};

export default function PlanEditRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [state, setState] = useState<PlanEditState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    if (!planId) {
      setError('缺少计划 ID。');
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
      const allExercises = await repositories.exerciseRepository.listExercises();

      setState({
        allExercises,
        draft: buildPlanEditDraft(plan, days, exerciseLists),
        exerciseMap: Object.fromEntries(allExercises.map((exercise) => [exercise.id, exercise])),
        plan,
      });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划编辑加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [planId, repositories]);

  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan]),
  );

  const updateDraft = (patch: Partial<PlanEditDraft>) => {
    setState((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  };

  const addDay = (week: number) => {
    setState((current) =>
      current
        ? (() => {
            const sameWeekDays = current.draft.days.filter((day) => day.week === week);
            const nextWeekday = Math.min(7, sameWeekDays.length + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
            const nextDay = {
              ...createEmptyPlanDayDraft(current.draft.days.length),
              week,
              weekday: nextWeekday,
            };
            return {
            ...current,
            draft: {
              ...current.draft,
                days: [...current.draft.days, nextDay],
            },
            };
          })()
        : current,
    );
  };

  const deleteDay = (dayId: string) => {
    setState((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              days: current.draft.days.filter((day) => day.id !== dayId),
            },
          }
        : current,
    );
  };

  const save = async () => {
    if (!state || !planId) {
      return;
    }

    setIsSaving(true);
    try {
      const plan = await repositories.planRepository.updateUserPlan(toUpdateUserPlanInput(planId, state.draft));
      Alert.alert('已保存', `“${plan.name}”已更新，后续训练会读取新结构。`);
      await loadPlan();
    } catch (saveError) {
      Alert.alert('保存失败', saveError instanceof Error ? saveError.message : '计划暂时无法保存。');
    } finally {
      setIsSaving(false);
    }
  };

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    const exercise = await repositories.exerciseRepository.createCustomExercise(input);
    setState((current) =>
      current
        ? {
            ...current,
            allExercises: [exercise, ...current.allExercises],
            exerciseMap: { ...current.exerciseMap, [exercise.id]: exercise },
          }
        : current,
    );
    return exercise;
  };

  const isReadonly = state?.plan.source === 'system' || state?.plan.visibility === 'system';

  // 复制系统计划为用户副本，然后跳转到副本的编辑页
  const duplicateAndEdit = async () => {
    if (!state) return;
    setIsDuplicating(true);
    try {
      const copy = await repositories.planRepository.duplicatePlan({
        sourcePlanId: state.plan.id,
        name: `${state.plan.name}（我的）`,
      });
      router.replace({ pathname: '/plan/edit/[planId]', params: { planId: copy.id } } as never);
    } catch (dupError) {
      Alert.alert('复制失败', dupError instanceof Error ? dupError.message : '计划复制失败，请重试。');
    } finally {
      setIsDuplicating(false);
    }
  };

  return (
    <Screen contentStyle={{ flex: 1, paddingBottom: 12 }} scroll={false}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="计划编辑暂时不可用" description={error} /> : null}

      {!isLoading && state && isReadonly ? (
        <>
          <EmptyState
            description={`“${state.plan.name}”是系统方案，不可直接修改。复制为你的私有计划后即可自由编辑训练日和动作。`}
            title="系统方案需先复制"
          />
          <AppButton
            onPress={() => void duplicateAndEdit()}
            variant="primary"
          >
            {isDuplicating ? '复制中...' : '复制为我的计划'}
          </AppButton>
          <AppButton
            onPress={() => router.replace('/(tabs)/plan')}
            variant="ghost"
          >
            返回计划页
          </AppButton>
        </>
      ) : null}

      {!isLoading && state && !isReadonly ? (
        <PlanEditOverview
          allExercises={state.allExercises}
          draft={state.draft}
          exerciseMap={state.exerciseMap}
          isSaving={isSaving}
          onAddDay={addDay}
          onChange={updateDraft}
          onCreateCustomExercise={createCustomExercise}
          onDeleteDay={deleteDay}
          onSave={() => void save()}
          planSource={state.plan.source}
        />
      ) : null}

      {!isLoading && !state && !error ? (
        <AppButton onPress={() => router.replace('/(tabs)/plan')} variant="secondary">
          返回计划页
        </AppButton>
      ) : null}
    </Screen>
  );
}
