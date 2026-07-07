import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  baselineDraftJson: string;
};

function serializeDraftForDiff(draft: PlanEditDraft): string {
  // 稳定序列化：按 id 排序后再 JSON，避免顺序变化造成误报
  const normalized = {
    ...draft,
    days: [...draft.days]
      .sort((a, b) => a.week - b.week || a.weekday - b.weekday || a.id.localeCompare(b.id))
      .map((day) => ({
        ...day,
        exercises: [...day.exercises].sort((a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id)),
      })),
  };
  return JSON.stringify(normalized);
}

export default function PlanEditRoute() {
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [state, setState] = useState<PlanEditState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigation = useNavigation();
  const isDirtyRef = useRef(false);

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
      const draft = buildPlanEditDraft(plan, days, exerciseLists);

      setState({
        allExercises,
        draft,
        exerciseMap: Object.fromEntries(allExercises.map((exercise) => [exercise.id, exercise])),
        plan,
        baselineDraftJson: serializeDraftForDiff(draft),
      });
      isDirtyRef.current = false;
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '计划编辑加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [planId, repositories]);

  // 拦截返回/退出，提示未保存修改
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (!isDirtyRef.current) {
        return;
      }
      e.preventDefault();
      Alert.alert(
        '有未保存的修改',
        '当前编辑尚未保存，确认离开会丢失改动。是否放弃修改？',
        [
          { text: '继续编辑', style: 'cancel' },
          {
            text: '放弃修改',
            style: 'destructive',
            onPress: () => {
              isDirtyRef.current = false;
              navigation.dispatch(e.data.action);
            },
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      void loadPlan();
    }, [loadPlan]),
  );

  const updateDraft = (patch: Partial<PlanEditDraft>) => {
    setState((current) => {
      if (!current) return current;
      const nextDraft = { ...current.draft, ...patch };
      isDirtyRef.current = serializeDraftForDiff(nextDraft) !== current.baselineDraftJson;
      return { ...current, draft: nextDraft };
    });
  };

  const addDay = (week: number) => {
    setState((current) => {
      if (!current) return current;
      const sameWeekDays = current.draft.days.filter((day) => day.week === week);
      const nextWeekday = Math.min(7, sameWeekDays.length + 1) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
      const nextDay = {
        ...createEmptyPlanDayDraft(current.draft.days.length),
        week,
        weekday: nextWeekday,
      };
      const nextDraft = {
        ...current.draft,
        days: [...current.draft.days, nextDay],
      };
      isDirtyRef.current = serializeDraftForDiff(nextDraft) !== current.baselineDraftJson;
      return { ...current, draft: nextDraft };
    });
  };

  const deleteDay = (dayId: string) => {
    setState((current) => {
      if (!current) return current;
      const nextDraft = {
        ...current.draft,
        days: current.draft.days.filter((day) => day.id !== dayId),
      };
      isDirtyRef.current = serializeDraftForDiff(nextDraft) !== current.baselineDraftJson;
      return { ...current, draft: nextDraft };
    });
  };

  const save = async () => {
    if (!state || !planId) {
      return;
    }

    setIsSaving(true);
    try {
      const plan = await repositories.planRepository.updateUserPlan(toUpdateUserPlanInput(planId, state.draft));
      // 保存成功后立即重置 dirty，避免 beforeRemove 在 loadPlan 完成前误拦截
      isDirtyRef.current = false;
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
