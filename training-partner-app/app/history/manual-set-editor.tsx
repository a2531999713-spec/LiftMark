import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import {
  ManualMemberTabs,
  ManualOtherMembersCard,
  ManualQuickActionsCard,
  ManualSetEditorBottomBar,
  ManualSetEditorCard,
  ManualSetExerciseHero,
} from '@/components/manual-workout/ManualSetEditorCards';
import { calculateSetVolume } from '@/components/manual-workout/manualWorkoutUtils';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import type { GroupMember } from '@/domain/member/member.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import type { ManualSetDraft } from '@/store/manualWorkoutDraftStore';
import { useManualWorkoutDraftStore } from '@/store/manualWorkoutDraftStore';
import { useSelectedGroupStore } from '@/store/selectedGroupStore';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = {
  message: string;
  title: string;
};

export default function ManualSetEditorRoute() {
  const { draftId } = useLocalSearchParams<{ draftId?: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const manualDraft = useManualWorkoutDraftStore();
  const selectedGroupId = useSelectedGroupStore((state) => state.selectedGroupId);
  const setSelectedGroupId = useSelectedGroupStore((state) => state.setSelectedGroupId);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState<string | 'exercise_info'>('');
  const [isExercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [isAdvancedVisible, setAdvancedVisible] = useState(false);
  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeDraftId = draftId ?? manualDraft.activeExerciseDraftId;
  const activeDraft = manualDraft.exercises.find((exercise) => exercise.id === activeDraftId);

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
        const [nextMembers, nextExercises] = await Promise.all([
          repositories.memberRepository.listMembers(nextGroup.id),
          repositories.exerciseRepository.listExercises(),
        ]);

        if (mounted) {
          setMembers(nextMembers);
          setExercises(nextExercises);
          const firstParticipantId = manualDraft.participantMemberIds[0] ?? nextMembers[0]?.id ?? '';
          setSelectedMemberId((current) => current || firstParticipantId);
        }
      } catch (loadError) {
        if (mounted) {
          setError(loadError instanceof Error ? loadError.message : '组数据页面加载失败。');
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
  }, [manualDraft.participantMemberIds, repositories, selectedGroupId, setSelectedGroupId]);

  const exerciseMap = useMemo(
    () => Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  ) as Record<string, Exercise | undefined>;
  const selectedMembers = members.filter((member) => manualDraft.participantMemberIds.includes(member.id));
  const exercise = activeDraft ? exerciseMap[activeDraft.exerciseId] : undefined;
  const activeMemberSet =
    selectedMemberId !== 'exercise_info'
      ? activeDraft?.memberSets.find((memberSet) => memberSet.memberId === selectedMemberId)
      : undefined;
  const selectedMember = selectedMembers.find((member) => member.id === selectedMemberId);
  const totalSets =
    activeDraft?.memberSets
      .filter((memberSet) => manualDraft.participantMemberIds.includes(memberSet.memberId))
      .reduce((sum, memberSet) => sum + memberSet.sets.length, 0) ?? 0;
  const totalVolume =
    activeDraft?.memberSets
      .filter((memberSet) => manualDraft.participantMemberIds.includes(memberSet.memberId))
      .reduce((sum, memberSet) => sum + memberSet.sets.reduce((setSum, set) => setSum + calculateSetVolume(set), 0), 0) ?? 0;

  const currentExerciseIndex = activeDraft ? manualDraft.exercises.findIndex((item) => item.id === activeDraft.id) : -1;

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    if (!guardFeature('manual_history')) {
      throw new Error('请先登录后再创建补录动作。');
    }
    const nextExercise = await repositories.exerciseRepository.createCustomExercise(input);
    setExercises((current) => [nextExercise, ...current]);
    if (activeDraft) {
      manualDraft.replaceExercise(activeDraft.id, nextExercise.id);
    }
    return nextExercise;
  };

  const saveCurrentDraft = () => {
    setIsSaving(true);
    setIsSaving(false);
    setNotice({ title: '已暂存动作数据', message: '组数据已经保存在本次补录草稿中，返回首页后可统一保存补录。' });
  };

  const goToSibling = (direction: 'previous' | 'next') => {
    const targetIndex = direction === 'previous' ? currentExerciseIndex - 1 : currentExerciseIndex + 1;
    const target = manualDraft.exercises[targetIndex];
    if (!target) {
      setNotice({
        title: direction === 'previous' ? '已经是第一个动作' : '已经是最后一个动作',
        message: '当前动作数据会保留在补录草稿中。',
      });
      return;
    }
    manualDraft.setActiveExercise(target.id);
    router.replace({ pathname: '/history/manual-set-editor', params: { draftId: target.id } } as never);
  };

  const generateMissingSets = () => {
    if (!activeDraft || selectedMemberId === 'exercise_info') return;
    const memberSet = activeDraft.memberSets.find((item) => item.memberId === selectedMemberId);
    const currentCount = memberSet?.sets.length ?? 0;
    const missingCount = Math.max(0, activeDraft.plannedSets - currentCount);
    for (let index = 0; index < missingCount; index += 1) {
      manualDraft.addMemberSet(activeDraft.id, selectedMemberId);
    }
  };

  return (
    <Screen
      contentStyle={styles.screenContent}
      scroll={false}
    >
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="组数据暂时不可用" description={error} /> : null}
      {!isLoading && !error && !activeDraft ? (
        <EmptyState
          actionLabel="返回补录首页"
          description="请先在补录训练首页选择一个动作。"
          onActionPress={() => router.replace('/history/manual')}
          title="没有可编辑动作"
        />
      ) : null}

      {!isLoading && !error && activeDraft ? (
        <View style={styles.layout}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <ManualSetExerciseHero draft={activeDraft} exercise={exercise} onReplace={() => setExercisePickerVisible(true)} />
            <ManualMemberTabs members={selectedMembers} onSelect={setSelectedMemberId} selectedMemberId={selectedMemberId} />

            {selectedMemberId === 'exercise_info' ? (
              <AppCard style={styles.card}>
                <AppText variant="subtitle">动作信息</AppText>
                <View style={styles.infoRows}>
                  <InfoRow label="动作" value={exercise?.name ?? '训练动作'} />
                  <InfoRow label="优先级" value={`${activeDraft.priority} · ${activeDraft.priority === 'A' ? '必做' : activeDraft.priority === 'B' ? '建议' : '可选'}`} />
                  <InfoRow label="计划组次" value={`${activeDraft.plannedSets} 组 · ${activeDraft.plannedReps ?? '-'} 次`} />
                  <InfoRow label="休息" value={`${activeDraft.plannedRestSeconds ?? 90} 秒`} />
                </View>
                <Tag label="动作详情编辑在计划编辑器中配置" tone="brand" />
              </AppCard>
            ) : (
              <>
                <ManualSetEditorCard
                  member={selectedMember}
                  onAddSet={() => {
                    if (activeDraft && selectedMemberId !== 'exercise_info') {
                      manualDraft.addMemberSet(activeDraft.id, selectedMemberId);
                    }
                  }}
                  onCopyPreviousSet={() => {
                    if (activeDraft && selectedMemberId !== 'exercise_info') {
                      manualDraft.copyPreviousSet(activeDraft.id, selectedMemberId);
                    }
                  }}
                  onUpdateSet={(setId, patch) => {
                    if (selectedMemberId !== 'exercise_info') {
                      manualDraft.updateSet(activeDraft.id, selectedMemberId, setId, patch);
                    }
                  }}
                  sets={activeMemberSet?.sets ?? []}
                />
                <ManualQuickActionsCard
                  onAdvancedPress={() => setAdvancedVisible(true)}
                  onCopyPrevious={() => {
                    if (selectedMemberId !== 'exercise_info') {
                      manualDraft.copyPreviousSet(activeDraft.id, selectedMemberId);
                    }
                  }}
                  onGenerateMissing={generateMissingSets}
                />
                <ManualOtherMembersCard
                  activeMemberId={selectedMemberId}
                  draft={activeDraft}
                  members={selectedMembers}
                  onSelect={setSelectedMemberId}
                />
              </>
            )}
          </ScrollView>

          <ManualSetEditorBottomBar
            isSaving={isSaving}
            onNext={() => goToSibling('next')}
            onPrevious={() => goToSibling('previous')}
            onSave={saveCurrentDraft}
            title={exercise?.name ?? '动作'}
            totalSets={totalSets}
            totalVolume={totalVolume}
          />
        </View>
      ) : null}

      <ExercisePickerSheet
        exercises={exercises}
        onClose={() => setExercisePickerVisible(false)}
        onCreateCustomExercise={createCustomExercise}
        onSelect={(nextExercise) => {
          if (activeDraft) {
            manualDraft.replaceExercise(activeDraft.id, nextExercise.id);
          }
          setExercisePickerVisible(false);
        }}
        selectedExerciseIds={manualDraft.exercises.map((item) => item.exerciseId)}
        title="替换动作"
        visible={isExercisePickerVisible}
      />

      <AdvancedRecordSheet
        memberSet={activeMemberSet}
        onClose={() => setAdvancedVisible(false)}
        onUpdate={(setId, patch) => {
          if (activeDraft && selectedMemberId !== 'exercise_info') {
            manualDraft.updateSet(activeDraft.id, selectedMemberId, setId, patch);
          }
        }}
        visible={isAdvancedVisible}
      />

      <AppModalSheet
        onClose={() => setNotice(null)}
        position="center"
        subtitle={notice?.message}
        title={notice?.title ?? '提示'}
        visible={Boolean(notice)}
      >
        <View style={styles.modalButtons}>
          <AppButton onPress={() => setNotice(null)}>知道了</AppButton>
          <AppButton onPress={() => router.back()} variant="secondary">
            返回首页
          </AppButton>
        </View>
      </AppModalSheet>

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function AdvancedRecordSheet({
  memberSet,
  onClose,
  onUpdate,
  visible,
}: {
  memberSet?: { sets: ManualSetDraft[] };
  onClose: () => void;
  onUpdate: (setId: string, patch: Partial<ManualSetDraft>) => void;
  visible: boolean;
}) {
  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="默认收起，只在需要记录体感时填写。"
      title="高级记录"
      visible={visible}
    >
      <ScrollView style={styles.advancedScroll}>
        <View style={styles.advancedList}>
          {(memberSet?.sets ?? []).map((set) => (
            <View key={set.id} style={styles.advancedRow}>
              <View style={styles.advancedIndex}>
                <AppText variant="caption" weight="900">
                  {set.setIndex}
                </AppText>
              </View>
              <AdvancedInput label="RPE" onChangeText={(rpe) => onUpdate(set.id, { rpe })} value={set.rpe ?? ''} />
              <AdvancedInput label="RIR" onChangeText={(rir) => onUpdate(set.id, { rir })} value={set.rir ?? ''} />
              <AdvancedInput
                label="备注"
                onChangeText={(notes) => onUpdate(set.id, { notes })}
                value={set.notes ?? ''}
              />
            </View>
          ))}
        </View>
      </ScrollView>
      <AppButton onPress={onClose}>完成</AppButton>
    </AppModalSheet>
  );
}

function AdvancedInput({
  label,
  onChangeText,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.advancedInput}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput
        keyboardType={label === '备注' ? 'default' : 'decimal-pad'}
        onChangeText={onChangeText}
        placeholder="-"
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <AppText tone="muted" variant="bodySmall">
        {label}
      </AppText>
      <AppText variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  advancedIndex: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  advancedInput: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 72,
    padding: spacing.sm,
  },
  advancedList: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
  },
  advancedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  advancedScroll: {
    maxHeight: 320,
  },
  card: {
    gap: spacing.md,
  },
  infoRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoRows: {
    gap: spacing.sm,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
    padding: 0,
  },
  layout: {
    flex: 1,
    gap: spacing.md,
  },
  modalButtons: {
    gap: spacing.sm,
  },
  screenContent: {
    flex: 1,
    paddingBottom: spacing.md,
  },
  scrollContent: {
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
});
