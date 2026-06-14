import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton, AppText, EmptyState, PriorityTag, Tag } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { getWorkoutRecordInitialReps } from '@/domain/workout/workout.service';
import type {
  SaveWorkoutSetInput,
  WorkoutExerciseRecord,
  WorkoutSessionDetail,
  WorkoutSet,
} from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

const rpeOptions = [6, 7, 8, 9, 10];
const rirOptions = [0, 1, 2, 3, 4, 5];

function showReplaceComingSoon() {
  Alert.alert('开发中', '动作替换会在后续版本开放。');
}

function showSkipComingSoon() {
  Alert.alert('开发中', '跳过动作会在后续版本开放。');
}

function formatNumber(value: number | undefined, fallback = '0'): string {
  if (value === undefined) {
    return fallback;
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatPrescription(record: WorkoutExerciseRecord): string {
  if (record.plannedSets && record.plannedReps) {
    return `${record.plannedSets} x ${record.plannedReps}`;
  }

  if (record.plannedSets && record.plannedRepMin && record.plannedRepMax) {
    return `${record.plannedSets} x ${record.plannedRepMin}-${record.plannedRepMax}`;
  }

  if (record.plannedSets) {
    return `${record.plannedSets} 组`;
  }

  return '手动安排';
}

function formatRestLabel(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) {
    return '无固定休息';
  }

  return `${seconds} 秒`;
}

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function getWeightIncrement(profile: MemberProfile | null, exercise: Exercise | null): number {
  if (exercise?.equipment === 'dumbbell') {
    return profile?.dumbbellIncrement ?? 2;
  }

  return profile?.barbellIncrement ?? 2.5;
}

function replaceSet(
  detail: WorkoutSessionDetail | null,
  nextSet: WorkoutSet,
): WorkoutSessionDetail | null {
  if (!detail) {
    return detail;
  }

  return {
    ...detail,
    sets: detail.sets.map((set) => (set.id === nextSet.id ? nextSet : set)),
  };
}

function removeSet(detail: WorkoutSessionDetail | null, setId: string): WorkoutSessionDetail | null {
  if (!detail) {
    return detail;
  }

  return {
    ...detail,
    sets: detail.sets.filter((set) => set.id !== setId),
  };
}

function selectDisplaySet(memberSets: WorkoutSet[]): WorkoutSet | null {
  return memberSets.find((set) => !set.completed && !set.skipped) ?? memberSets.at(-1) ?? null;
}

function parseNumericInput(raw: string, integer: boolean): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (normalized.length === 0) {
    return null;
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return Number.NaN;
  }

  return integer ? Math.round(value) : Math.round(value * 10) / 10;
}

type NumberStepperProps = {
  allowEmpty?: boolean;
  integer?: boolean;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number | undefined) => void;
  step: number;
  unit?: string;
  value: number | undefined;
};

function NumberStepper({
  allowEmpty = false,
  integer = false,
  label,
  max,
  min = 0,
  onChange,
  step,
  unit,
  value,
}: NumberStepperProps) {
  const [draft, setDraft] = useState(formatNumber(value, ''));
  const current = value ?? min;

  function commitDraft() {
    const parsed = parseNumericInput(draft, integer);

    if (parsed === null) {
      if (allowEmpty) {
        onChange(undefined);
        return;
      }

      Alert.alert('输入有误', `${label}不能为空。`);
      setDraft(formatNumber(value, ''));
      return;
    }

    if (!Number.isFinite(parsed)) {
      Alert.alert('输入有误', integer ? `${label}只能输入整数。` : `${label}只能输入数字。`);
      setDraft(formatNumber(value, ''));
      return;
    }

    if (parsed < min || (max !== undefined && parsed > max)) {
      Alert.alert('输入有误', max === undefined ? `${label}不能小于 ${min}。` : `${label}需要在 ${min}-${max} 之间。`);
      setDraft(formatNumber(value, ''));
      return;
    }

    setDraft(formatNumber(parsed, ''));
    onChange(parsed);
  }

  function changeByStep(direction: 1 | -1) {
    const next = Math.max(min, current + step * direction);
    const bounded = max === undefined ? next : Math.min(max, next);
    setDraft(formatNumber(bounded, ''));
    onChange(bounded);
  }

  return (
    <View style={styles.stepper}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => changeByStep(-1)}
          style={styles.stepperButton}
        >
          <Ionicons color={colors.text} name="remove" size={18} />
        </Pressable>
        <TextInput
          keyboardType={integer ? 'number-pad' : 'decimal-pad'}
          onBlur={commitDraft}
          onChangeText={setDraft}
          onSubmitEditing={commitDraft}
          placeholder={allowEmpty ? '空' : '0'}
          placeholderTextColor={colors.textMuted}
          style={styles.stepperInput}
          value={draft}
        />
        {unit ? (
          <AppText tone="muted" variant="caption">
            {unit}
          </AppText>
        ) : null}
        <Pressable
          accessibilityRole="button"
          onPress={() => changeByStep(1)}
          style={styles.stepperButton}
        >
          <Ionicons color={colors.text} name="add" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

type OptionButtonsProps = {
  label: string;
  onChange: (value: number | undefined) => void;
  options: number[];
  value: number | undefined;
};

function OptionButtons({ label, onChange, options, value }: OptionButtonsProps) {
  return (
    <View style={styles.optionGroup}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.optionRow}>
        {options.map((option) => {
          const isActive = value === option;

          return (
            <Pressable
              accessibilityRole="button"
              key={option}
              onPress={() => onChange(option)}
              style={[styles.optionButton, isActive && styles.optionActive]}
            >
              <AppText tone={isActive ? 'inverse' : 'default'} variant="caption" weight="900">
                {option}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(undefined)}
          style={[styles.optionButton, value === undefined && styles.optionClearActive]}
        >
          <AppText tone={value === undefined ? 'default' : 'muted'} variant="caption" weight="900">
            清空
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

type CompletedSetCardProps = {
  memberName: string;
  onDelete: () => void;
  onSavePatch: (patch: Omit<SaveWorkoutSetInput, 'id'>) => void;
  set: WorkoutSet;
};

function CompletedSetCard({ memberName, onDelete, onSavePatch, set }: CompletedSetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [notesDraft, setNotesDraft] = useState(set.notes ?? '');

  return (
    <View style={styles.completedSetCard}>
      <View style={styles.completedSetHeader}>
        <View style={styles.completedSetTitle}>
          <AppText variant="bodySmall" weight="800">
            第 {set.setNumber} 组 · {memberName}
          </AppText>
          <AppText tone="muted" variant="caption">
            {formatNumber(set.actualWeight ?? set.plannedWeight)} kg x {set.actualReps ?? set.plannedReps ?? 0}
            {set.rpe !== undefined ? `，RPE ${formatNumber(set.rpe)}` : ''}
          </AppText>
        </View>
        <View style={styles.completedSetActions}>
          <Pressable accessibilityRole="button" onPress={() => setIsEditing((current) => !current)} style={styles.iconButton}>
            <Ionicons color={colors.text} name={isEditing ? 'checkmark-outline' : 'create-outline'} size={18} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={onDelete} style={styles.iconButtonDanger}>
            <Ionicons color={colors.danger} name="trash-outline" size={18} />
          </Pressable>
        </View>
      </View>

      {isEditing ? (
        <View style={styles.completedEditor}>
          <View style={styles.stepperGrid}>
            <NumberStepper
              label="重量"
              onChange={(value) => {
                if (value !== undefined) {
                  onSavePatch({ actualWeight: value });
                }
              }}
              step={2.5}
              unit="kg"
              value={set.actualWeight ?? set.plannedWeight}
            />
            <NumberStepper
              integer
              label="次数"
              onChange={(value) => {
                if (value !== undefined) {
                  onSavePatch({ actualReps: value });
                }
              }}
              step={1}
              value={set.actualReps ?? set.plannedReps}
            />
          </View>
          <OptionButtons
            label="RPE"
            onChange={(value) => onSavePatch({ rpe: value })}
            options={rpeOptions}
            value={set.rpe}
          />
          <OptionButtons
            label="RIR"
            onChange={(value) => onSavePatch({ rir: value })}
            options={rirOptions}
            value={set.rir}
          />
          <TextInput
            multiline
            onBlur={() => onSavePatch({ notes: notesDraft.trim() || undefined })}
            onChangeText={setNotesDraft}
            placeholder="备注，可留空"
            placeholderTextColor={colors.textMuted}
            style={styles.notesInput}
            value={notesDraft}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function WorkoutRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [isWorkoutReadyToFinish, setWorkoutReadyToFinish] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startedAt = detail?.session.startedAt ? new Date(detail.session.startedAt).getTime() : Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [detail?.session.startedAt]);

  useEffect(() => {
    if (!isResting || restSecondsRemaining <= 0) {
      return;
    }

    const timer = setTimeout(() => {
      if (restSecondsRemaining <= 1) {
        setRestSecondsRemaining(0);
        setIsResting(false);
        return;
      }

      setRestSecondsRemaining(restSecondsRemaining - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isResting, restSecondsRemaining]);

  const loadWorkout = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await initializeLocalDatabase();
      const nextDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      const nextMembers = await repositories.memberRepository.listMembers(nextDetail.session.groupId);
      const nextProfiles = await Promise.all(
        nextMembers.map(async (member) => [
          member.id,
          await repositories.memberRepository.getMemberProfile(member.id),
        ]),
      );
      const nextExercises = await repositories.exerciseRepository.listExercisesByIds(
        nextDetail.exercises.map((exercise) => exercise.exerciseId),
      );

      setDetail(nextDetail);
      setMembers(nextMembers);
      setProfiles(Object.fromEntries(nextProfiles));
      setExerciseMap(Object.fromEntries(nextExercises.map((exercise) => [exercise.id, exercise])));
      setActiveExerciseIndex((index) =>
        nextDetail.exercises.length > 0 ? Math.min(index, nextDetail.exercises.length - 1) : 0,
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练记录加载失败。');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, sessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkout();
    }, [loadWorkout]),
  );

  const saveSetPatch = useCallback(
    async (set: WorkoutSet, patch: Omit<SaveWorkoutSetInput, 'id'>): Promise<WorkoutSet | null> => {
      const optimisticSet: WorkoutSet = {
        ...set,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      setDetail((current) => replaceSet(current, optimisticSet));
      setError(null);

      try {
        const saved = await repositories.workoutRepository.saveSet({
          id: set.id,
          ...patch,
        });
        setDetail((current) => replaceSet(current, saved));
        setLastSavedAt(new Date().toISOString());
        return saved;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '本组保存失败。');
        setDetail((current) => replaceSet(current, set));
        return null;
      }
    },
    [repositories],
  );

  const finishWorkout = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    setIsFinishing(true);
    setError(null);

    try {
      await repositories.workoutRepository.finishSession(sessionId);
      router.replace({ pathname: '/workout/summary/[sessionId]', params: { sessionId } });
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : '完成训练失败。');
    } finally {
      setIsFinishing(false);
    }
  }, [repositories, sessionId]);

  const activeRecord = detail?.exercises[activeExerciseIndex] ?? null;
  const activeExercise = activeRecord ? exerciseMap[activeRecord.exerciseId] ?? null : null;
  const activeSets = activeRecord
    ? detail?.sets.filter((set) => set.exerciseRecordId === activeRecord.id) ?? []
    : [];
  const completedSets = activeSets.filter((set) => set.completed).length;
  const completedTotalSets = detail?.sets.filter((set) => set.completed).length ?? 0;
  const totalSets = detail?.sets.length ?? 0;
  const progress = totalSets > 0 ? completedTotalSets / totalSets : 0;
  const roundSets = members
    .map((member) => activeSets.filter((set) => set.memberId === member.id).sort((a, b) => a.setNumber - b.setNumber))
    .map(selectDisplaySet)
    .filter((set): set is WorkoutSet => Boolean(set));
  const completedActiveSets = [...activeSets]
    .filter((set) => set.completed)
    .sort((left, right) => left.setNumber - right.setNumber || left.memberId.localeCompare(right.memberId));
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const hasNextExercise = detail ? activeExerciseIndex < detail.exercises.length - 1 : false;

  function goNextExercise() {
    if (!detail) {
      return;
    }

    setIsResting(false);
    setRestSecondsRemaining(0);
    setWorkoutReadyToFinish(false);
    setActiveExerciseIndex((index) => Math.min(detail.exercises.length - 1, index + 1));
  }

  function skipRest() {
    setIsResting(false);
    setRestSecondsRemaining(0);
  }

  async function completeCurrentRound() {
    if (isWorkoutReadyToFinish) {
      await finishWorkout();
      return;
    }

    if (isResting) {
      skipRest();
      return;
    }

    const targetSets = roundSets.filter((set) => !set.completed && !set.skipped);
    if (targetSets.length === 0) {
      if (hasNextExercise) {
        goNextExercise();
      } else {
        setWorkoutReadyToFinish(true);
      }
      return;
    }

    const currentSetNumber = Math.min(...targetSets.map((set) => set.setNumber));
    const hasNextSet = activeSets.some((set) => set.setNumber > currentSetNumber && !set.skipped);

    await Promise.all(
      targetSets.map((set) =>
        saveSetPatch(set, {
          actualReps: set.actualReps ?? set.plannedReps ?? (activeRecord ? getWorkoutRecordInitialReps(activeRecord) : undefined),
          actualWeight: set.actualWeight ?? set.plannedWeight,
          completed: true,
          skipped: false,
        }),
      ),
    );

    if (hasNextSet) {
      const restSeconds = activeRecord?.plannedRestSeconds ?? 0;
      if (restSeconds > 0) {
        setRestSecondsRemaining(restSeconds);
        setIsResting(true);
      } else {
        skipRest();
      }
      return;
    }

    if (hasNextExercise) {
      goNextExercise();
      return;
    }

    setWorkoutReadyToFinish(true);
  }

  function confirmDeleteSet(set: WorkoutSet) {
    Alert.alert('删除已完成组', `确定删除第 ${set.setNumber} 组记录吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => {
          setDetail((current) => removeSet(current, set.id));
          void repositories.workoutRepository.deleteSet(set.id).catch((deleteError) => {
            setError(deleteError instanceof Error ? deleteError.message : '删除训练组失败。');
            void loadWorkout();
          });
        },
      },
    ]);
  }

  function confirmUndoLatestRound() {
    const latestSetNumber = Math.max(0, ...completedActiveSets.map((set) => set.setNumber));
    const targetSets = completedActiveSets.filter((set) => set.setNumber === latestSetNumber);

    if (targetSets.length === 0) {
      return;
    }

    Alert.alert('撤销上一组', `确定撤销当前动作第 ${latestSetNumber} 组吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '撤销',
        style: 'destructive',
        onPress: () => {
          setWorkoutReadyToFinish(false);
          setIsResting(false);
          setRestSecondsRemaining(0);
          void Promise.all(
            targetSets.map((set) =>
              saveSetPatch(set, {
                completed: false,
                skipped: false,
              }),
            ),
          );
        },
      },
    ]);
  }

  const primaryActionLabel = isWorkoutReadyToFinish
    ? '完成训练并查看总结'
    : isResting
      ? '跳过休息，进入下一组'
      : '完成本组';

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.circleButton}>
            <Ionicons color={colors.surface} name="close" size={20} />
          </Pressable>
          <AppText tone="inverse" variant="subtitle">
            训练中
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => void finishWorkout()} style={styles.circleButton}>
            <Ionicons color={colors.surface} name="ellipsis-horizontal" size={20} />
          </Pressable>
        </View>

        {isLoading ? <ActivityIndicator color={colors.primary} /> : null}

        {error ? <EmptyState title="训练提示" description={error} /> : null}

        {!isLoading && !error && !detail ? <EmptyState title="未找到训练" description="没有找到这次训练记录。" /> : null}

        {detail && activeRecord ? (
          <>
            <View style={styles.progressPanel}>
              <View style={styles.progressRow}>
                <AppText tone="inverse" variant="bodySmall">
                  动作 {activeExerciseIndex + 1}/{detail.exercises.length}
                </AppText>
                <AppText tone="inverse" variant="bodySmall">
                  组数 {completedSets}/{activeSets.length}
                </AppText>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
              </View>
            </View>

            <View style={styles.exerciseHero}>
              <ImageBackground
                imageStyle={styles.exerciseHeroImage}
                resizeMode="cover"
                source={liftmarkImages.trainingHero}
                style={styles.exerciseHeroImageBackground}
              >
                <View style={styles.exerciseHeroScrim} />
              </ImageBackground>
              <View style={styles.exerciseHeroOverlay}>
                <View style={styles.exerciseTitleRow}>
                  <AppText tone="inverse" variant="headline">
                    {activeExercise?.name ?? activeRecord.exerciseId}
                  </AppText>
                  <PriorityTag priority={activeRecord.priority} />
                </View>
                <AppText tone="inverse" variant="bodySmall">
                  {formatPrescription(activeRecord)} · {activeRecord.plannedPercent1RM ? `${Math.round(activeRecord.plannedPercent1RM * 100)}% 1RM · ` : ''}
                  {activeRecord.plannedRpe ? `RPE ${activeRecord.plannedRpe}` : '按计划执行'} · 休息 {formatRestLabel(activeRecord.plannedRestSeconds)}
                </AppText>
              </View>
            </View>

            {isResting ? (
              <View style={styles.restCard}>
                <View>
                  <AppText tone="inverse" variant="subtitle">
                    休息中
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    结束后自动进入下一组
                  </AppText>
                </View>
                <AppText tone="inverse" variant="headline">
                  {formatTimer(restSecondsRemaining)}
                </AppText>
                <View style={styles.restActions}>
                  <AppButton onPress={skipRest} size="sm" variant="secondary">
                    跳过休息
                  </AppButton>
                  <AppButton onPress={skipRest} size="sm" variant="secondary">
                    下一组
                  </AppButton>
                </View>
              </View>
            ) : null}

            <View style={styles.memberList}>
              {members.map((member) => {
                const profile = profiles[member.id] ?? null;
                const memberSets = activeSets.filter((set) => set.memberId === member.id).sort((a, b) => a.setNumber - b.setNumber);
                const workoutSet = selectDisplaySet(memberSets);
                const increment = getWeightIncrement(profile, activeExercise);

                if (!workoutSet) {
                  return null;
                }

                return (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberHeader}>
                      <View style={styles.avatar}>
                        <AppText tone="inverse" variant="caption">
                          {member.displayName.slice(0, 1)}
                        </AppText>
                      </View>
                      <View style={styles.memberInfo}>
                        <AppText variant="subtitle">{member.displayName}</AppText>
                        <AppText tone="muted" variant="caption">
                          第 {workoutSet.setNumber} 组 · 计划 {formatNumber(workoutSet.plannedWeight)} kg x {workoutSet.plannedReps ?? getWorkoutRecordInitialReps(activeRecord) ?? 0}
                        </AppText>
                      </View>
                      {workoutSet.completed ? <Tag label="已完成" tone="success" /> : null}
                    </View>

                    <View style={styles.stepperGrid}>
                      <NumberStepper
                        key={`${workoutSet.id}-weight`}
                        label="重量"
                        onChange={(value) => {
                          if (value !== undefined) {
                            void saveSetPatch(workoutSet, { actualWeight: value });
                          }
                        }}
                        step={increment}
                        unit="kg"
                        value={workoutSet.actualWeight ?? workoutSet.plannedWeight}
                      />
                      <NumberStepper
                        key={`${workoutSet.id}-reps`}
                        integer
                        label="次数"
                        onChange={(value) => {
                          if (value !== undefined) {
                            void saveSetPatch(workoutSet, { actualReps: value });
                          }
                        }}
                        step={1}
                        value={workoutSet.actualReps ?? workoutSet.plannedReps}
                      />
                    </View>
                    <OptionButtons
                      key={`${workoutSet.id}-rpe`}
                      label="RPE"
                      onChange={(value) => void saveSetPatch(workoutSet, { rpe: value })}
                      options={rpeOptions}
                      value={workoutSet.rpe}
                    />
                    <OptionButtons
                      key={`${workoutSet.id}-rir`}
                      label="RIR"
                      onChange={(value) => void saveSetPatch(workoutSet, { rir: value })}
                      options={rirOptions}
                      value={workoutSet.rir}
                    />
                  </View>
                );
              })}
            </View>

            <View style={styles.completedSection}>
              <View style={styles.sectionHeader}>
                <View>
                  <AppText tone="inverse" variant="subtitle">
                    已完成组
                  </AppText>
                  <AppText tone="muted" variant="caption">
                    输入错误可以返回编辑或删除
                  </AppText>
                </View>
                <AppButton
                  disabled={completedActiveSets.length === 0}
                  onPress={confirmUndoLatestRound}
                  size="sm"
                  variant="dark"
                >
                  撤销上一组
                </AppButton>
              </View>

              {completedActiveSets.length === 0 ? (
                <View style={styles.completedEmpty}>
                  <AppText tone="muted" variant="caption">
                    当前动作还没有完成组
                  </AppText>
                </View>
              ) : (
                completedActiveSets.map((set) => (
                  <CompletedSetCard
                    key={set.id}
                    memberName={membersById.get(set.memberId)?.displayName ?? '成员'}
                    onDelete={() => confirmDeleteSet(set)}
                    onSavePatch={(patch) => void saveSetPatch(set, patch)}
                    set={set}
                  />
                ))
              )}
            </View>

            <AppButton icon="checkmark-outline" onPress={() => void completeCurrentRound()} size="lg">
              {primaryActionLabel}
            </AppButton>

            <View style={styles.auxRow}>
              <AppButton onPress={showSkipComingSoon} style={styles.auxButton} variant="dark">
                跳过
              </AppButton>
              <AppButton onPress={showReplaceComingSoon} style={styles.auxButton} variant="dark">
                替换动作
              </AppButton>
              <AppButton disabled={!hasNextExercise} onPress={goNextExercise} style={styles.auxButton} variant="dark">
                下一个动作
              </AppButton>
            </View>

            <View style={styles.footerStatus}>
              <View style={styles.timerRow}>
                <Ionicons color={colors.darkMuted} name="timer-outline" size={18} />
                <AppText tone="inverse" variant="bodySmall">
                  {formatTimer(elapsedSeconds)}
                </AppText>
              </View>
              <View style={styles.savedRow}>
                <AppText tone="muted" variant="caption">
                  {lastSavedAt ? '已自动保存' : '等待记录'}
                </AppText>
                <Ionicons color={colors.success} name="checkmark-circle" size={16} />
              </View>
            </View>

            <AppButton disabled={isFinishing} onPress={() => void finishWorkout()} variant="secondary">
              {isFinishing ? '生成总结中...' : '完成训练并查看总结'}
            </AppButton>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.dark,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  circleButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  progressPanel: {
    gap: spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.pill,
    height: 8,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    height: '100%',
  },
  exerciseHero: {
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    minHeight: 150,
    overflow: 'hidden',
  },
  exerciseHeroImageBackground: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  exerciseHeroImage: {
    opacity: 0.88,
  },
  exerciseHeroScrim: {
    backgroundColor: 'rgba(1,12,22,0.58)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  exerciseHeroOverlay: {
    backgroundColor: 'rgba(1,12,22,0.2)',
    flex: 1,
    gap: spacing.sm,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  exerciseTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  restCard: {
    alignItems: 'center',
    backgroundColor: colors.darkCard,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  restActions: {
    gap: spacing.xs,
  },
  memberList: {
    gap: spacing.md,
  },
  memberCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.lg,
  },
  memberHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  stepperGrid: {
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
    gap: spacing.xs,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stepperInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    color: colors.text,
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    minHeight: 38,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  optionGroup: {
    gap: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 34,
    justifyContent: 'center',
    minWidth: 48,
    paddingHorizontal: spacing.sm,
  },
  optionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionClearActive: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.borderStrong,
  },
  completedSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  completedEmpty: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  completedSetCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.md,
    padding: spacing.md,
  },
  completedSetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  completedSetTitle: {
    flex: 1,
    gap: 2,
  },
  completedSetActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  iconButtonDanger: {
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  completedEditor: {
    gap: spacing.md,
  },
  notesInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    color: colors.text,
    minHeight: 72,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  auxRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  auxButton: {
    flex: 1,
  },
  footerStatus: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  timerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  savedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
