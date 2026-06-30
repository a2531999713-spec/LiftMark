import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AuthGateSheets } from '@/components/auth';
import { AppButton, AppCard, AppModalSheet, AppText, EmptyState, Screen, SectionHeader, Tag } from '@/components/ui';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { WorkoutExerciseRecord, WorkoutSessionDetail, WorkoutSet } from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing, typography } from '@/theme';

function formatVolume(sets: WorkoutSet[]) {
  const volume = sets
    .filter((set) => set.completed)
    .reduce((sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0), 0);
  return `${Math.round(volume).toLocaleString('zh-CN')} kg`;
}

export default function HistoryDetailRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [members, setMembers] = useState<Record<string, GroupMember>>({});
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [isEditMode, setEditMode] = useState(false);
  const [isActionsVisible, setActionsVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      if (authMode === 'guest_preview') {
        setDetail(null);
        return;
      }

      await initializeLocalDatabase();
      const nextDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      const group = await repositories.groupRepository.getDefaultGroup();
      const nextMembers = group ? await repositories.memberRepository.listMembers(group.id) : [];
      const [nextExercises, nextAllExercises] = await Promise.all([
        repositories.exerciseRepository.listExercisesByIds(
          nextDetail.exercises.map((exercise) => exercise.exerciseId),
        ),
        repositories.exerciseRepository.listExercises(),
      ]);

      setDetail(nextDetail);
      setDate(nextDetail.session.date);
      setTitle(nextDetail.session.title);
      setEditMode(false);
      setMembers(Object.fromEntries(nextMembers.map((member) => [member.id, member])));
      setExercises(Object.fromEntries(nextExercises.map((exercise) => [exercise.id, exercise])));
      setAllExercises(nextAllExercises);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练详情加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [authMode, repositories, sessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail]),
  );

  const saveSession = useCallback(async () => {
    if (!detail) {
      return;
    }

    if (!guardFeature('manual_history')) {
      return;
    }

    setIsSaving(true);
    try {
      const session = await repositories.workoutRepository.updateSession({
        id: detail.session.id,
        date,
        title,
      });
      setDetail({ ...detail, session });
      setEditMode(false);
      Alert.alert('已保存', '训练日期和标题已更新。');
    } catch (saveError) {
      Alert.alert('保存失败', saveError instanceof Error ? saveError.message : '训练详情保存失败。');
    } finally {
      setIsSaving(false);
    }
  }, [date, detail, guardFeature, repositories, title]);

  const saveSetPatch = useCallback(
    async (set: WorkoutSet, patch: Partial<WorkoutSet>) => {
      if (!guardFeature('manual_history')) {
        return;
      }

      const saved = await repositories.workoutRepository.saveSet({
        id: set.id,
        actualWeight: patch.actualWeight ?? set.actualWeight,
        actualReps: patch.actualReps ?? set.actualReps,
        completed: patch.completed ?? set.completed,
        skipped: patch.skipped ?? set.skipped,
      });

      setDetail((current) =>
        current
          ? {
              ...current,
              sets: current.sets.map((item) => (item.id === saved.id ? saved : item)),
            }
          : current,
      );
    },
    [guardFeature, repositories],
  );

  const confirmDeleteSet = useCallback(
    (set: WorkoutSet) => {
      if (!guardFeature('manual_history')) {
        return;
      }

      Alert.alert('删除这一组？', '删除后该组训练数据不会出现在统计中。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await repositories.workoutRepository.deleteSet(set.id);
              setDetail((current) =>
                current ? { ...current, sets: current.sets.filter((item) => item.id !== set.id) } : current,
              );
            })();
          },
        },
      ]);
    },
    [guardFeature, repositories],
  );

  const changeExercise = useCallback(
    async (record: WorkoutExerciseRecord) => {
      if (!guardFeature('manual_history')) {
        return;
      }

      if (allExercises.length === 0) {
        Alert.alert('暂无动作', '动作库暂时没有可选择的动作。');
        return;
      }

      const currentIndex = allExercises.findIndex((exercise) => exercise.id === record.exerciseId);
      const nextExercise = allExercises[(currentIndex + 1 + allExercises.length) % allExercises.length];

      await repositories.workoutRepository.updateExerciseRecordExercise(record.id, nextExercise.id);
      setDetail((current) =>
        current
          ? {
              ...current,
              exercises: current.exercises.map((item) =>
                item.id === record.id ? { ...item, exerciseId: nextExercise.id } : item,
              ),
            }
          : current,
      );
      setExercises((current) => ({ ...current, [nextExercise.id]: nextExercise }));
      Alert.alert('已更换动作', `该条历史记录已改为“${nextExercise.name}”。`);
    },
    [allExercises, guardFeature, repositories],
  );

  const confirmDeleteExercise = useCallback(
    (record: WorkoutExerciseRecord) => {
      if (!guardFeature('manual_history')) {
        return;
      }

      Alert.alert('删除这个动作？', '该动作下的所有组都会被删除。', [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await repositories.workoutRepository.deleteExerciseRecord(record.id);
              setDetail((current) =>
                current
                  ? {
                      ...current,
                      exercises: current.exercises.filter((item) => item.id !== record.id),
                      sets: current.sets.filter((item) => item.exerciseRecordId !== record.id),
                    }
                  : current,
              );
            })();
          },
        },
      ]);
    },
    [guardFeature, repositories],
  );

  const confirmDeleteSession = useCallback(() => {
    if (!detail) {
      return;
    }

    if (!guardFeature('manual_history')) {
      return;
    }

    Alert.alert('删除整次训练？', '该训练的动作和组记录都会被删除。此操作需要确认。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await repositories.workoutRepository.deleteSession(detail.session.id);
            router.replace('/(tabs)/history');
          })();
        },
      },
    ]);
  }, [detail, guardFeature, repositories]);

  return (
    <Screen safeTop={false}>
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="训练详情暂时无法加载" description={error} /> : null}

      {!isLoading && authMode === 'guest_preview' ? (
        <EmptyState
          actionLabel="登录 / 注册"
          description="登录后可以查看和编辑真实训练记录。"
          onActionPress={() => guardFeature('view_real_history')}
          title="登录后查看训练详情"
        />
      ) : null}

      {!isLoading && detail ? (
        <>
          <View style={styles.topBar}>
            <View style={styles.topText}>
              <AppText variant="bodySmall" weight="900">
                训练记录详情
              </AppText>
              <AppText tone="muted" variant="caption">
                默认只读，编辑需从更多操作进入。
              </AppText>
            </View>
            <Pressable accessibilityRole="button" onPress={() => setActionsVisible(true)} style={styles.moreButton}>
              <Ionicons color={colors.textStrong} name="ellipsis-horizontal" size={20} />
            </Pressable>
          </View>

          <AppCard style={styles.card}>
            <SectionHeader title="基础信息" />
            {isEditMode ? (
              <View style={styles.fieldRow}>
                <EditableField label="日期" onChangeText={setDate} value={date} />
                <EditableField label="标题" onChangeText={setTitle} value={title} />
              </View>
            ) : (
              <View style={styles.readonlyInfo}>
                <ReadonlyInfo label="日期" value={detail.session.date} />
                <ReadonlyInfo label="标题" value={detail.session.title} />
              </View>
            )}
            <View style={styles.summaryGrid}>
              <SummaryItem icon="calendar-outline" label="日期" value={detail.session.date} />
              <SummaryItem icon="barbell-outline" label="总训练量" value={formatVolume(detail.sets)} />
              <SummaryItem icon="time-outline" label="时长" value={detail.session.finishedAt ? '已完成' : '进行中'} />
            </View>
            {isEditMode ? (
              <View style={styles.inlineActions}>
                <AppButton disabled={isSaving} onPress={() => void saveSession()} variant="secondary">
                  {isSaving ? '保存中...' : '保存基础信息'}
                </AppButton>
                <AppButton
                  onPress={() => {
                    setDate(detail.session.date);
                    setTitle(detail.session.title);
                    setEditMode(false);
                  }}
                  variant="ghost"
                >
                  取消编辑
                </AppButton>
              </View>
            ) : null}
          </AppCard>

          <SectionHeader title="动作与组" />
          {detail.exercises.map((record) => {
            const exercise = exercises[record.exerciseId];
            const recordSets = detail.sets.filter((set) => set.exerciseRecordId === record.id);
            return (
              <AppCard key={record.id} style={styles.card}>
                <View style={styles.exerciseHeader}>
                  <View style={styles.exerciseIcon}>
                    <Ionicons color={colors.primary} name="barbell-outline" size={20} />
                  </View>
                  <View style={styles.exerciseText}>
                    <AppText variant="subtitle">{exercise?.name ?? record.exerciseId}</AppText>
                    <AppText tone="muted" variant="caption">
                      {recordSets.length} 组 · {record.priority} 动作
                    </AppText>
                  </View>
                  {isEditMode ? (
                    <Pressable accessibilityRole="button" onPress={() => confirmDeleteExercise(record)}>
                      <Ionicons color={colors.danger} name="trash-outline" size={20} />
                    </Pressable>
                  ) : null}
                </View>
                {isEditMode ? (
                  <View style={styles.inlineActions}>
                    <AppButton onPress={() => void changeExercise(record)} size="sm" variant="secondary">
                      更换动作
                    </AppButton>
                  </View>
                ) : null}
                {recordSets.map((set) =>
                  isEditMode ? (
                    <SetEditor
                      key={set.id}
                      memberName={members[set.memberId]?.displayName ?? '成员'}
                      onDelete={() => confirmDeleteSet(set)}
                      onPatch={(patch) => void saveSetPatch(set, patch)}
                      set={set}
                    />
                  ) : (
                    <SetReadonly key={set.id} memberName={members[set.memberId]?.displayName ?? '成员'} set={set} />
                  ),
                )}
              </AppCard>
            );
          })}

          <AppCard style={styles.card} tone="brand">
            <SectionHeader title="建议" />
            <AppText variant="bodySmall" weight="900">
              修改历史记录后，训练量、完成率、预估 1RM 和建议会在记录页重新计算。
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              建议仅用于训练参考，不作为医疗或伤病判断。
            </AppText>
          </AppCard>

          <AppModalSheet
            onClose={() => setActionsVisible(false)}
            position="center"
            subtitle="编辑和删除都属于低频操作，进入前需要明确选择。"
            title="更多操作"
            visible={isActionsVisible}
          >
            <View style={styles.modalActions}>
              <AppButton
                icon="create-outline"
                onPress={() => {
                  setActionsVisible(false);
                  setEditMode(true);
                }}
              >
                编辑记录
              </AppButton>
              <AppButton
                icon="trash-outline"
                onPress={() => {
                  setActionsVisible(false);
                  confirmDeleteSession();
                }}
                variant="danger"
              >
                删除整次训练
              </AppButton>
              <AppButton onPress={() => setActionsVisible(false)} variant="secondary">
                取消
              </AppButton>
            </View>
          </AppModalSheet>
        </>
      ) : null}

      <AuthGateSheets {...sheets} />
    </Screen>
  );
}

function EditableField({
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
      <TextInput onChangeText={onChangeText} style={styles.input} value={value} />
    </View>
  );
}

function ReadonlyInfo({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readonlyItem}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText numberOfLines={1} variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function SummaryItem({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.summaryItem}>
      <Ionicons color={colors.primary} name={icon} size={18} />
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <AppText variant="bodySmall" weight="900">
        {value}
      </AppText>
    </View>
  );
}

function SetReadonly({ memberName, set }: { memberName: string; set: WorkoutSet }) {
  return (
    <View style={styles.setCard}>
      <View style={styles.setHeader}>
        <AppText variant="bodySmall" weight="900">
          {memberName} · 第 {set.setNumber} 组
        </AppText>
        <Tag label={set.completed ? '完成' : '未完成'} tone={set.completed ? 'success' : 'warning'} />
      </View>
      <View style={styles.readonlySetGrid}>
        <ReadonlyInfo label="重量" value={`${set.actualWeight ?? set.plannedWeight ?? 0} kg`} />
        <ReadonlyInfo label="次数" value={`${set.actualReps ?? set.plannedReps ?? 0} 次`} />
      </View>
    </View>
  );
}

function SetEditor({
  memberName,
  onDelete,
  onPatch,
  set,
}: {
  memberName: string;
  onDelete: () => void;
  onPatch: (patch: Partial<WorkoutSet>) => void;
  set: WorkoutSet;
}) {
  return (
    <View style={styles.setCard}>
      <View style={styles.setHeader}>
        <AppText variant="bodySmall" weight="900">
          {memberName} · 第 {set.setNumber} 组
        </AppText>
        <Tag label={set.completed ? '完成' : '未完成'} tone={set.completed ? 'success' : 'warning'} />
      </View>
      <View style={styles.stepperRow}>
        <Stepper label="重量" suffix="kg" value={set.actualWeight ?? 0} onChange={(value) => onPatch({ actualWeight: value })} />
        <Stepper label="次数" value={set.actualReps ?? 0} onChange={(value) => onPatch({ actualReps: value })} />
      </View>
      <View style={styles.inlineActions}>
        <AppButton onPress={() => onPatch({ completed: !set.completed })} size="sm" variant="secondary">
          {set.completed ? '标为未完成' : '标为完成'}
        </AppButton>
        <AppButton onPress={onDelete} size="sm" variant="danger">
          删除本组
        </AppButton>
      </View>
    </View>
  );
}

function Stepper({
  label,
  onChange,
  suffix,
  value,
}: {
  label: string;
  onChange: (value: number) => void;
  suffix?: string;
  value: number;
}) {
  const step = label === '重量' ? 2.5 : 1;
  return (
    <View style={styles.stepper}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" onPress={() => onChange(Math.max(0, value - step))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="remove-outline" size={18} />
        </Pressable>
        <AppText variant="bodySmall" weight="900">
          {value}
          {suffix ? ` ${suffix}` : ''}
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => onChange(value + step)} style={styles.stepButton}>
          <Ionicons color={colors.text} name="add-outline" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  topText: {
    flex: 1,
    gap: 2,
  },
  moreButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  fieldRow: {
    gap: spacing.sm,
  },
  field: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
  },
  readonlyInfo: {
    gap: spacing.sm,
  },
  readonlyItem: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryItem: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  exerciseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  exerciseIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
  setCard: {
    backgroundColor: colors.backgroundElevated,
    borderRadius: radius.md,
    gap: spacing.md,
    padding: spacing.md,
  },
  setHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepperRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  readonlySetGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepper: {
    flex: 1,
    gap: spacing.xs,
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  inlineActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  modalActions: {
    gap: spacing.sm,
  },
});
