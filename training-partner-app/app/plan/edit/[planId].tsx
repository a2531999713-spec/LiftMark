import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert } from 'react-native';

import { PlanEditOverview } from '@/components/plan/PlanEditOverview';
import { buildPlanEditDraft, createEmptyPlanDayDraft, toUpdateUserPlanInput } from '@/components/plan/planEditDraft';
import type { PlanEditDraft, PlanExerciseMap } from '@/components/plan/planEditTypes';
import { AppButton, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { colors } from '@/theme';

type PlanEditState = {
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
      const exerciseIds = Array.from(new Set(exerciseLists.flatMap((items) => items.map((exercise) => exercise.exerciseId))));
      const exercises = exerciseIds.length > 0 ? await repositories.exerciseRepository.listExercisesByIds(exerciseIds) : [];

      setState({
        draft: buildPlanEditDraft(plan, days, exerciseLists),
        exerciseMap: Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
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

  const addDay = () => {
    setState((current) =>
      current
        ? {
            ...current,
            draft: {
              ...current.draft,
              days: [...current.draft.days, createEmptyPlanDayDraft(current.draft.days.length)],
            },
          }
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

  const isReadonly = state?.plan.source === 'system' || state?.plan.visibility === 'system';

  return (
    <Screen subtitle="编辑摘要和训练日；点击训练日再改动作。" title="编辑计划">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="计划编辑暂时不可用" description={error} /> : null}

      {!isLoading && state && isReadonly ? (
        <EmptyState
          actionLabel="返回计划页"
          description="系统计划不可直接编辑。请先复制为我的计划，再调整训练日和动作。"
          onActionPress={() => router.replace('/(tabs)/plan')}
          title="先复制为我的计划"
        />
      ) : null}

      {!isLoading && state && !isReadonly ? (
        <PlanEditOverview
          draft={state.draft}
          exerciseMap={state.exerciseMap}
          isSaving={isSaving}
          onAddDay={addDay}
          onChange={updateDraft}
          onDeleteDay={deleteDay}
          onOpenDay={(dayId) => {
            if (dayId.startsWith('day_')) {
              Alert.alert('先保存计划', '新增训练日保存后即可进入动作编辑。');
              return;
            }
            router.push({ pathname: '/plan/edit-day/[dayId]', params: { dayId, planId } } as never);
          }}
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
