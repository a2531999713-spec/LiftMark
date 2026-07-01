import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { ExercisePickerSheet, formatExerciseEquipment } from '@/components/exercises/ExercisePickerSheet';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { CreateCustomExerciseInput } from '@/data/repositories/exerciseRepository';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing, typography } from '@/theme';

type NoticeState = {
  sessionId?: string;
  message: string;
  title: string;
};

type ManualSetDraft = {
  id: string;
  reps: string;
  weight: string;
};

type ManualExerciseDraft = {
  exerciseId: string;
  id: string;
  sets: ManualSetDraft[];
};

function createDraftId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function createSetDraft(): ManualSetDraft {
  return { id: createDraftId('set'), reps: '8', weight: '' };
}

function getLocalDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) {
    return undefined;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function parseOptionalInteger(value: string): number | undefined {
  const parsed = parseOptionalNumber(value);
  if (parsed === undefined || Number.isNaN(parsed)) {
    return parsed;
  }

  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function assertOptionalRange(label: string, value: number | undefined, min: number, max?: number) {
  if (value === undefined) {
    return;
  }

  if (Number.isNaN(value) || value < min || (max !== undefined && value > max)) {
    throw new Error(max === undefined ? `${label}不能小于 ${min}。` : `${label}需要在 ${min}-${max} 之间。`);
  }
}

export default function ManualHistoryRoute() {
  const params = useLocalSearchParams<{ date?: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { guardFeature, sheets } = useAuthGate();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [exerciseDrafts, setExerciseDrafts] = useState<ManualExerciseDraft[]>([]);
  const [isExercisePickerVisible, setExercisePickerVisible] = useState(false);
  const [date, setDate] = useState(params.date ?? getLocalDateString());
  const [title, setTitle] = useState('补录训练');
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
        const nextGroup = await repositories.groupRepository.getDefaultGroup();
        if (!nextGroup) {
          throw new Error('默认小组尚未初始化。');
        }

        const [nextMembers, nextExercises] = await Promise.all([
          repositories.memberRepository.listMembers(nextGroup.id),
          repositories.exerciseRepository.listExercises(),
        ]);

        if (mounted) {
          setGroup(nextGroup);
          setMembers(nextMembers);
          setExercises(nextExercises);
          setSelectedMemberId(nextMembers[0]?.id ?? '');
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
  }, [repositories]);

  const exerciseById = useMemo(
    () => Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  ) as Record<string, Exercise | undefined>;
  const selectedExerciseIds = exerciseDrafts.map((draft) => draft.exerciseId);

  const addExerciseDraft = (exercise: Exercise) => {
    setExerciseDrafts((current) => {
      if (current.some((draft) => draft.exerciseId === exercise.id)) {
        setNotice({
          title: '动作已添加',
          message: '该动作已经在补录列表中；需要更多训练数据时，直接在该动作下新增组。',
        });
        return current;
      }

      return [
        ...current,
        {
          exerciseId: exercise.id,
          id: createDraftId('exercise'),
          sets: [createSetDraft()],
        },
      ];
    });
  };

  const removeExerciseDraft = (draftId: string) => {
    setExerciseDrafts((current) => current.filter((draft) => draft.id !== draftId));
  };

  const addSetDraft = (draftId: string) => {
    setExerciseDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              sets: [...draft.sets, createSetDraft()],
            }
          : draft,
      ),
    );
  };

  const removeSetDraft = (draftId: string, setId: string) => {
    setExerciseDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId && draft.sets.length > 1
          ? { ...draft, sets: draft.sets.filter((set) => set.id !== setId) }
          : draft,
      ),
    );
  };

  const updateSetDraft = (draftId: string, setId: string, patch: Partial<ManualSetDraft>) => {
    setExerciseDrafts((current) =>
      current.map((draft) =>
        draft.id === draftId
          ? {
              ...draft,
              sets: draft.sets.map((set) => (set.id === setId ? { ...set, ...patch } : set)),
            }
          : draft,
      ),
    );
  };

  const createCustomExercise = async (input: CreateCustomExerciseInput) => {
    if (!guardFeature('manual_history')) {
      throw new Error('请先登录后再创建补录动作。');
    }

    const exercise = await repositories.exerciseRepository.createCustomExercise(input);
    setExercises((current) => [exercise, ...current]);
    addExerciseDraft(exercise);
    return exercise;
  };

  const saveManualSession = async () => {
    if (!guardFeature('manual_history')) {
      return;
    }

    if (!group || !selectedMemberId) {
      setNotice({
        title: '信息不完整',
        message: '请选择成员后再保存。',
      });
      return;
    }

    if (exerciseDrafts.length === 0) {
      setNotice({
        title: '还没有动作',
        message: '至少添加一个动作，并为动作填写组数据后再保存。',
      });
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const parsedExercises = exerciseDrafts.map((draft, exerciseIndex) => {
        const exercise = exerciseById[draft.exerciseId];
        if (!exercise) {
          throw new Error('存在无效动作，请重新选择。');
        }

        return {
          exerciseId: draft.exerciseId,
          priority: exerciseIndex === 0 ? 'A' as const : exerciseIndex <= 2 ? 'B' as const : 'C' as const,
          sets: draft.sets.map((set, setIndex) => {
            const parsedReps = parseOptionalInteger(set.reps);
            const parsedWeight = parseOptionalNumber(set.weight);

            assertOptionalRange(`${exercise.name} 第 ${setIndex + 1} 组次数`, parsedReps, 0);
            assertOptionalRange(`${exercise.name} 第 ${setIndex + 1} 组重量`, parsedWeight, 0);

            if (parsedReps === undefined && parsedWeight === undefined) {
              throw new Error(`${exercise.name} 第 ${setIndex + 1} 组请填写重量或次数。`);
            }

            return {
              completed: true,
              reps: parsedReps,
              weight: parsedWeight,
            };
          }),
        };
      });

      const session = await repositories.workoutRepository.createManualSession({
        completed: true,
        date,
        exercises: parsedExercises,
        groupId: group.id,
        memberId: selectedMemberId,
        planId: group.activePlanId,
        restSeconds: null,
        title,
      });

      setNotice({
        sessionId: session.id,
        title: '已保存',
        message: '历史训练已保存，可在记录详情中查看本次组数、重量和次数。',
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存补录训练失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen subtitle="把过去完成的训练保存到历史记录。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="补录训练暂时不可用" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <VisualHeroCard
            eyebrow="历史补录"
            icon="create-outline"
            imageSource={liftmarkImages.historyHero}
            minHeight={154}
            subtitle="补录只修改训练记录，不会改动原训练计划。"
            title="保存过去完成的训练"
          />

          <AppCard style={styles.card}>
            <SectionHeader title="训练信息" />
            <Field label="训练日期" onChangeText={setDate} placeholder="YYYY-MM-DD" value={date} />
            <Field label="训练标题" onChangeText={setTitle} placeholder="例如 胸部训练" value={title} />
          </AppCard>

          <AppCard style={styles.card}>
            <SectionHeader title="成员" />
            <View style={styles.chipRow}>
              {members.map((member) => (
                <SelectableChip
                  key={member.id}
                  active={member.id === selectedMemberId}
                  label={member.displayName}
                  onPress={() => setSelectedMemberId(member.id)}
                />
              ))}
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <SectionHeader
              actionLabel="添加动作"
              onActionPress={() => {
                if (guardFeature('manual_history')) setExercisePickerVisible(true);
              }}
              subtitle="每个动作可以记录独立的组、重量和次数。"
              title="动作与组"
            />
            {exerciseDrafts.length > 0 ? (
              <View style={styles.draftList}>
                {exerciseDrafts.map((draft, draftIndex) => {
                  const exercise = exerciseById[draft.exerciseId];
                  if (!exercise) {
                    return null;
                  }

                  return (
                    <View key={draft.id} style={styles.draftExerciseCard}>
                      <View style={styles.draftExerciseHeader}>
                        <View style={styles.exerciseIcon}>
                          <Ionicons color={colors.primary} name="barbell-outline" size={20} />
                        </View>
                        <View style={styles.exerciseText}>
                          <AppText variant="bodySmall" weight="900">
                            {exercise.name}
                          </AppText>
                          <AppText tone="muted" variant="caption">
                            {exercise.targetMuscle} · {formatExerciseEquipment(exercise.equipment)}
                          </AppText>
                        </View>
                        <Tag
                          label={exercise.source === 'custom' ? '自定义' : `动作 ${draftIndex + 1}`}
                          tone={exercise.source === 'custom' ? 'brand' : 'neutral'}
                        />
                        <Pressable
                          accessibilityLabel={`移除${exercise.name}`}
                          accessibilityRole="button"
                          onPress={() => removeExerciseDraft(draft.id)}
                          style={styles.iconButton}
                        >
                          <Ionicons color={colors.danger} name="trash-outline" size={18} />
                        </Pressable>
                      </View>

                      <View style={styles.setList}>
                        {draft.sets.map((set, setIndex) => (
                          <View key={set.id} style={styles.setCard}>
                            <View style={styles.setHeader}>
                              <AppText tone="muted" variant="caption" weight="900">
                                第 {setIndex + 1} 组
                              </AppText>
                              {draft.sets.length > 1 ? (
                                <Pressable
                                  accessibilityLabel={`删除第${setIndex + 1}组`}
                                  accessibilityRole="button"
                                  onPress={() => removeSetDraft(draft.id, set.id)}
                                  style={styles.iconButtonSmall}
                                >
                                  <Ionicons color={colors.danger} name="remove-circle-outline" size={18} />
                                </Pressable>
                              ) : null}
                            </View>
                            <View style={styles.fieldGrid}>
                              <Field
                                label="重量 kg"
                                onChangeText={(value) => updateSetDraft(draft.id, set.id, { weight: value })}
                                placeholder="可留空"
                                value={set.weight}
                              />
                              <Field
                                label="次数"
                                onChangeText={(value) => updateSetDraft(draft.id, set.id, { reps: value })}
                                value={set.reps}
                              />
                            </View>
                          </View>
                        ))}
                      </View>

                      <AppButton icon="add-outline" onPress={() => addSetDraft(draft.id)} size="sm" variant="ghost">
                        新增一组
                      </AppButton>
                    </View>
                  );
                })}
              </View>
            ) : (
              <EmptyState
                actionLabel="添加动作"
                description="添加动作后再填写每组重量和次数。"
                onActionPress={() => {
                  if (guardFeature('manual_history')) setExercisePickerVisible(true);
                }}
                title="还没有添加动作"
              />
            )}
          </AppCard>

          <AppButton disabled={isSaving} icon="save-outline" onPress={() => void saveManualSession()} size="lg">
            {isSaving ? '保存中...' : '保存记录'}
          </AppButton>
        </>
      ) : null}

      <ExercisePickerSheet
        exercises={exercises}
        onClose={() => setExercisePickerVisible(false)}
        onCreateCustomExercise={createCustomExercise}
        onSelect={(exercise) => {
          addExerciseDraft(exercise);
          setExercisePickerVisible(false);
        }}
        selectedExerciseIds={selectedExerciseIds}
        title="选择补录动作"
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

function Field({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
}) {
  const isTextField = label.includes('日期') || label.includes('标题');

  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput
        keyboardType={isTextField ? 'default' : 'decimal-pad'}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

function SelectableChip({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
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
  chip: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  draftExerciseCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  draftExerciseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  draftList: {
    gap: spacing.md,
  },
  exerciseIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconButtonSmall: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  field: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    minWidth: '47%',
    padding: spacing.md,
  },
  fieldGrid: {
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
  setCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  setHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setList: {
    gap: spacing.sm,
  },
});
