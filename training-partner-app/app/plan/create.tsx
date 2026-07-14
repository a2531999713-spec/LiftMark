import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { PlanEditOverview } from '@/components/plan/PlanEditOverview';
import { createEmptyPlanDayDraft, toUpdateUserPlanInput } from '@/components/plan/planEditDraft';
import type { PlanEditDraft, PlanExerciseMap } from '@/components/plan/planEditTypes';
import { AppButton, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, spacing } from '@/theme';

type CreatePlanState = {
  allExercises: Exercise[];
  draft: PlanEditDraft;
  exerciseMap: PlanExerciseMap;
};

function createInitialDraft(): PlanEditDraft {
  return {
    days: [createEmptyPlanDayDraft(0)],
    durationWeeks: 8,
    frequencyPerWeek: 4,
    goal: 'strength',
    name: '我的训练计划',
  };
}

export default function CreatePlanRoute() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [state, setState] = useState<CreatePlanState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      setIsLoading(true);
      setError(null);
      try {
        await initializeLocalDatabase();
        const allExercises = await repositories.exerciseRepository.listExercises();
        if (mounted) {
          setState({
            allExercises,
            draft: createInitialDraft(),
            exerciseMap: Object.fromEntries(allExercises.map((exercise) => [exercise.id, exercise])),
          });
        }
      } catch (loadError) {
        if (mounted) setError(loadError instanceof Error ? loadError.message : '创建计划暂时不可用。');
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [repositories]);

  const updateDraft = (patch: Partial<PlanEditDraft>) => {
    setState((current) => (current ? { ...current, draft: { ...current.draft, ...patch } } : current));
  };

  const addDay = (week: number) => {
    setState((current) => {
      if (!current) return current;
      const nextDay = { ...createEmptyPlanDayDraft(current.draft.days.length), week };
      return { ...current, draft: { ...current.draft, days: [...current.draft.days, nextDay] } };
    });
  };

  const deleteDay = (dayId: string) => {
    setState((current) =>
      current ? { ...current, draft: { ...current.draft, days: current.draft.days.filter((day) => day.id !== dayId) } } : current,
    );
  };

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    if (!guardFeature('create_plan')) throw new Error('请先登录后再创建自定义动作。');
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

  const save = async () => {
    if (!state || !guardFeature('create_plan')) return;
    setIsSaving(true);
    try {
      const { planId: _planId, ...input } = toUpdateUserPlanInput('new_plan', state.draft);
      const plan = await repositories.planRepository.createUserPlan(input);
      Alert.alert('已创建计划', `“${plan.name}”已保存。`, [
        { text: '查看计划', onPress: () => router.replace({ pathname: '/plan/[planId]', params: { planId: plan.id } } as never) },
      ]);
    } catch (saveError) {
      Alert.alert('保存失败', saveError instanceof Error ? saveError.message : '创建计划暂时失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen contentStyle={{ flex: 1, paddingBottom: 12, paddingTop: spacing.sm }} scroll={false} safeTop={false}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState description={error} title="创建计划暂时不可用" /> : null}
      {!isLoading && state ? (
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
          planSource="user"
        />
      ) : null}
      {!isLoading && !state && !error ? (
        <AppButton onPress={() => router.replace('/(tabs)/plan')} variant="secondary">
          返回计划页
        </AppButton>
      ) : null}
      <AuthGateSheets {...sheets} />
    </Screen>
  );
}
