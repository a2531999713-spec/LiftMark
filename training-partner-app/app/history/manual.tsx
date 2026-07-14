import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import {
  ManualWorkoutBottomBar,
  ManualWorkoutExerciseList,
  ManualWorkoutHero,
  ManualWorkoutInfoCard,
  ManualWorkoutParticipantsCard,
  ManualWorkoutSaveCheckCard,
} from '@/components/manual-workout/ManualWorkoutHomeCards';
import {
  summarizeManualWorkout,
  toManualSessionV2Exercises,
} from '@/components/manual-workout/manualWorkoutUtils';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import { resolveDefaultTrainingMemberId } from '@/domain/member/member-selection';
import type { GroupMember } from '@/domain/member/member.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { FREE_TRAINING_PLAN_ID } from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useManualWorkoutDraftStore } from '@/store/manualWorkoutDraftStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = {
  message: string;
  sessionId?: string;
  title: string;
};

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function ManualHistoryRoute() {
  const params = useLocalSearchParams<{ date?: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const draft = useManualWorkoutDraftStore();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [plans, setPlans] = useState<PlanTemplate[]>([]);
  const [isExercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [isPlanPickerVisible, setPlanPickerVisible] = useState(false);
  const [isTempMemberVisible, setTempMemberVisible] = useState(false);
  const [tempMemberName, setTempMemberName] = useState('');
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        await initializeLocalDatabase();
        const { group: nextGroup } = await resolveSelectedGroup(repositories.groupRepository, selectedGroupId);
        if (!nextGroup) {
          throw new Error('默认小组尚未初始化。');
        }
        if (nextGroup.id !== selectedGroupId) {
          setSelectedGroupId(nextGroup.id);
        }

        const [nextMembers, nextExercises, nextPlans] = await Promise.all([
          repositories.memberRepository.listMembers(nextGroup.id),
          repositories.exerciseRepository.listExercises(),
          repositories.planRepository.listUserPlans(),
        ]);

        if (!mounted) return;

        setGroup(nextGroup);
        setMembers(nextMembers);
        setExercises(nextExercises);
        setPlans(nextPlans);

        const currentDraft = useManualWorkoutDraftStore.getState();
        if (!currentDraft.initialized) {
          const defaultMemberId = resolveDefaultTrainingMemberId(nextMembers);
          const participantIds = Array.from(new Set([defaultMemberId].filter(Boolean) as string[]));
          currentDraft.initialize({
            date: params.date ?? getLocalDateString(),
            exerciseIds: [],
            linkedPlanId: nextGroup.activePlanId || null,
            participantMemberIds: participantIds,
            title: '',
            trainingMode: 'solo_local',
          });
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '补录页面加载失败。');
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
  }, [params.date, repositories, selectedGroupId, setSelectedGroupId]);

  const exerciseMap = useMemo(
    () => Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  ) as Record<string, Exercise | undefined>;
  const summary = useMemo(
    () => summarizeManualWorkout(draft.exercises, draft.participantMemberIds),
    [draft.exercises, draft.participantMemberIds],
  );
  const selectedMemberCount = draft.participantMemberIds.length;
  const derivedTrainingMode = selectedMemberCount <= 1 ? 'solo_local' : 'group_local';
  const dateLabel = draft.date === getLocalDateString() ? '今天' : draft.date;
  const selectedPlan = plans.find((plan) => plan.id === draft.linkedPlanId) ?? null;
  const planLabel = selectedPlan?.name ?? '不关联计划';

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    if (!guardFeature('manual_history')) {
      throw new Error('请先登录后再创建补录动作。');
    }
    const exercise = await repositories.exerciseRepository.createCustomExercise(input);
    setExercises((current) => [exercise, ...current]);
    draft.addExercise(exercise.id);
    return exercise;
  };

  const createTempMember = async () => {
    if (!group) return;
    const displayName = tempMemberName.trim();
    if (!displayName) {
      setNotice({ title: '需要成员名称', message: '请输入临时成员名称后再添加。' });
      return;
    }

    const member = await repositories.memberRepository.createMember({
      displayName,
      groupId: group.id,
      memberType: 'local',
      role: 'member',
    });
    setMembers((current) => [...current, member]);
    draft.toggleParticipant(member.id);
    setTempMemberName('');
    setTempMemberVisible(false);
  };

  const saveManualSession = async () => {
    if (!guardFeature('manual_history')) return;

    if (!group) {
      setNotice({ title: '小组未就绪', message: '请稍后再保存补录训练。' });
      return;
    }
    if (draft.participantMemberIds.length === 0) {
      setNotice({ title: '请选择成员', message: '至少选择一位参与成员后再保存。' });
      return;
    }
    if (draft.exercises.length === 0) {
      setNotice({ title: '还没有动作', message: '至少添加一个动作，并录入组数据后再保存。' });
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const session = await repositories.workoutRepository.createManualSessionV2({
        date: draft.date,
        exercises: toManualSessionV2Exercises(draft.exercises, draft.participantMemberIds),
        groupId: group.id,
        participantMemberIds: draft.participantMemberIds,
        planId: draft.linkedPlanId ?? FREE_TRAINING_PLAN_ID,
        sourcePlanId: draft.linkedPlanId ?? null,
        title: draft.title,
        trainingMode: derivedTrainingMode,
        completed: true,
      });

      draft.reset();
      setNotice({
        sessionId: session.id,
        title: '已保存补录',
        message: '这次训练已经写入历史记录，不会影响后续训练计划。',
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存补录训练失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen
      contentStyle={styles.screenContent}
      scroll={false}
      subtitle="选择本次补录的参与成员；选择一人即为个人记录，选择多人即为小组记录。"
      title="补录训练"
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="补录训练暂时不可用" description={error} /> : null}

      {!isLoading && !error ? (
        <View style={styles.layout}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ManualWorkoutHero
              date={draft.date}
              participantCount={selectedMemberCount}
              summary={summary}
              title={draft.title}
            />
            <ManualWorkoutInfoCard
              date={draft.date}
              onDateChange={draft.setDate}
              onPlanPress={() => setPlanPickerVisible(true)}
              onTitleChange={draft.setTitle}
              planLabel={planLabel}
              title={draft.title}
            />
            <ManualWorkoutParticipantsCard
              members={members}
              onTempMemberPress={() => setTempMemberVisible(true)}
              onToggle={draft.toggleParticipant}
              selectedMemberIds={draft.participantMemberIds}
            />
            <ManualWorkoutExerciseList
              exerciseMap={exerciseMap}
              exercises={draft.exercises}
              onAddExercise={() => setExercisePickerVisible(true)}
              onOpenExercise={(draftId) => {
                draft.setActiveExercise(draftId);
                router.push({ pathname: '/history/manual-set-editor', params: { draftId } } as never);
              }}
              onRemoveExercise={draft.removeExercise}
              participantCount={selectedMemberCount}
            />
            <ManualWorkoutSaveCheckCard
              participantCount={selectedMemberCount}
              summary={summary}
              trainingMode={derivedTrainingMode}
            />
          </ScrollView>

          <ManualWorkoutBottomBar
            dateLabel={dateLabel}
            disabled={selectedMemberCount === 0 || draft.exercises.length === 0}
            isSaving={isSaving}
            onSave={() => void saveManualSession()}
            participantCount={selectedMemberCount}
            summary={summary}
          />
        </View>
      ) : null}

      <ExercisePickerSheet
        exercises={exercises}
        onClose={() => setExercisePickerVisible(false)}
        onCreateCustomExercise={createCustomExercise}
        onSelect={(exercise) => {
          draft.addExercise(exercise.id);
          setExercisePickerVisible(false);
        }}
        selectedExerciseIds={draft.exercises.map((exercise) => exercise.exerciseId)}
        title="添加补录动作"
        visible={isExercisePickerVisible}
      />

      <AppModalSheet
        onClose={() => setTempMemberVisible(false)}
        position="center"
        subtitle="会创建一个小组成员，并加入本次补录。"
        title="临时成员"
        visible={isTempMemberVisible}
      >
        <AppCard style={styles.tempInputCard}>
          <AppText tone="muted" variant="caption">
            成员名称
          </AppText>
          <TextInput
            autoFocus
            onChangeText={setTempMemberName}
            placeholder="例如 小王"
            placeholderTextColor={colors.textSubtle}
            style={styles.tempInput}
            value={tempMemberName}
          />
        </AppCard>
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setTempMemberVisible(false)} variant="secondary">
            取消
          </AppButton>
          <AppButton onPress={() => void createTempMember()}>添加成员</AppButton>
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setPlanPickerVisible(false)}
        position="center"
        subtitle="只用于标记历史记录来源，不会改动当前训练计划。"
        title="关联计划"
        visible={isPlanPickerVisible}
      >
        <View style={styles.planPickerList}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              draft.setLinkedPlanId(null);
              setPlanPickerVisible(false);
            }}
            style={({ pressed }) => [
              styles.planPickerRow,
              draft.linkedPlanId === null && styles.planPickerRowActive,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.planPickerText}>
              <AppText variant="bodySmall" weight="900">
                不关联计划
              </AppText>
              <AppText tone="muted" variant="caption">
                作为独立补录保存
              </AppText>
            </View>
          </Pressable>
          {plans.map((plan) => (
            <Pressable
              accessibilityRole="button"
              key={plan.id}
              onPress={() => {
                draft.setLinkedPlanId(plan.id);
                setPlanPickerVisible(false);
              }}
              style={({ pressed }) => [
                styles.planPickerRow,
                draft.linkedPlanId === plan.id && styles.planPickerRowActive,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.planPickerText}>
                <AppText numberOfLines={1} variant="bodySmall" weight="900">
                  {plan.name}
                </AppText>
                <AppText tone="muted" variant="caption">
                  {plan.durationWeeks} 周 · 每周 {plan.frequencyPerWeek} 练
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      </AppModalSheet>

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <View style={styles.modalButtons}>
          {notice?.sessionId ? (
            <AppButton
              onPress={() => {
                const sessionId = notice.sessionId;
                setNotice(null);
                router.replace({ pathname: '/history/[sessionId]', params: { sessionId } } as never);
              }}
            >
              查看详情
            </AppButton>
          ) : null}
          <AppButton onPress={() => setNotice(null)} variant={notice?.sessionId ? 'secondary' : 'primary'}>
            知道了
          </AppButton>
        </View>
      </AppModalSheet>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  layout: {
    flex: 1,
    gap: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  planPickerList: {
    gap: spacing.sm,
  },
  planPickerRow: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    minHeight: 58,
    padding: spacing.md,
  },
  planPickerRowActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  planPickerText: {
    gap: 2,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.84,
  },
  screenContent: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  tempInput: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 34,
    padding: 0,
  },
  tempInputCard: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
