import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { AppText, PriorityTag, Tag } from '@/components/ui';
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
      <View style={styles.stepperLabelRow}>
        <AppText tone="muted" variant="caption">
          {label}
        </AppText>
        {unit ? (
          <AppText tone="muted" variant="caption">
            {unit}
          </AppText>
        ) : null}
      </View>
      <View style={styles.stepperControls}>
        <Pressable
          accessibilityRole="button"
          onPress={() => changeByStep(-1)}
          style={styles.stepperButton}
        >
          <Ionicons color={colors.text} name="remove" size={22} />
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
        <Pressable
          accessibilityRole="button"
          onPress={() => changeByStep(1)}
          style={styles.stepperButton}
        >
          <Ionicons color={colors.text} name="add" size={22} />
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
              style={[styles.optionPill, isActive && styles.optionPillActive]}
            >
              <AppText
                tone={isActive ? 'inverse' : 'muted'}
                variant="caption"
                weight="800"
              >
                {option}
              </AppText>
            </Pressable>
          );
        })}
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange(undefined)}
          style={[styles.optionPill, value === undefined && styles.optionPillClearActive]}
        >
          <AppText
            tone={value === undefined ? 'inverse' : 'muted'}
            variant="caption"
            weight="800"
          >
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
          <AppText tone="inverse" variant="bodySmall" weight="700">
            第 {set.setNumber} 组 · {memberName}
          </AppText>
          <AppText tone="muted" variant="caption">
            {formatNumber(set.actualWeight ?? set.plannedWeight)} kg x {set.actualReps ?? set.plannedReps ?? 0}
            {set.rpe !== undefined ? ` · RPE ${formatNumber(set.rpe)}` : ''}
            {set.rir !== undefined ? ` · RIR ${formatNumber(set.rir)}` : ''}
          </AppText>
        </View>
        <View style={styles.completedSetActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsEditing((current) => !current)}
            style={styles.iconButton}
          >
            <Ionicons
              color={colors.darkMuted}
              name={isEditing ? 'checkmark-outline' : 'create-outline'}
              size={18}
            />
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
            placeholderTextColor={colors.darkMuted}
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
  const restEndTimeRef = useRef<number>(0);

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

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((restEndTimeRef.current - Date.now()) / 1000));
      if (remaining <= 0) {
        setRestSecondsRemaining(0);
        setIsResting(false);
      } else {
        setRestSecondsRemaining(remaining);
      }
    }, 250);

    return () => clearInterval(timer);
  }, [isResting]);

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
        restEndTimeRef.current = Date.now() + restSeconds * 1000;
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
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => {
            Alert.alert('退出训练？', '训练数据已自动保存，可以稍后回来继续。', [
              { text: '继续训练', style: 'cancel' },
              { text: '结束并返回', style: 'destructive', onPress: () => void finishWorkout() },
            ]);
          }} style={styles.topButton}>
            <Ionicons color={colors.surface} name="close" size={22} />
          </Pressable>
          <AppText tone="inverse" variant="subtitle" weight="800">
            训练中
          </AppText>
          <Pressable accessibilityRole="button" onPress={() => {
            Alert.alert('训练选项', '', [
              { text: '取消', style: 'cancel' },
              { text: '跳过当前动作', onPress: () => {
                if (activeExerciseIndex < (detail?.exercises.length ?? 1) - 1) {
                  setActiveExerciseIndex((prev) => prev + 1);
                }
              }},
              { text: '结束训练', style: 'destructive', onPress: () => void finishWorkout() },
            ]);
          }} style={styles.topButton}>
            <Ionicons color={colors.surface} name="ellipsis-horizontal" size={20} />
          </Pressable>
        </View>

        <View style={styles.progressPanel}>
          <View style={styles.progressInfo}>
            <AppText tone="inverse" variant="caption" weight="700">
              动作 {activeExerciseIndex + 1}/{detail?.exercises.length ?? 0}
            </AppText>
            <AppText tone="inverse" variant="caption" weight="700">
              {completedSets}/{activeSets.length} 组
            </AppText>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(progress * 100)}%` },
              ]}
            />
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={colors.primary} size="large" />
            </View>
          ) : null}

          {error && !isLoading ? (
            <View style={styles.errorContainer}>
              <Ionicons color={colors.warning} name="alert-circle-outline" size={28} />
              <AppText tone="muted" variant="bodySmall">
                {error}
              </AppText>
            </View>
          ) : null}

          {!isLoading && !error && !detail ? (
            <View style={styles.emptyContainer}>
              <Ionicons color={colors.darkMuted} name="barbell-outline" size={40} />
              <AppText tone="muted" variant="bodySmall">
                未找到训练记录
              </AppText>
            </View>
          ) : null}

          {detail && activeRecord ? (
            <>
              <View style={styles.exerciseCard}>
                <ImageBackground
                  imageStyle={styles.exerciseHeroImage}
                  resizeMode="cover"
                  source={liftmarkImages.trainingHero}
                  style={styles.exerciseHeroBg}
                >
                  <View style={styles.exerciseHeroScrim} />
                </ImageBackground>
                <View style={styles.exerciseOverlay}>
                  <View style={styles.exerciseTitleRow}>
                    <AppText tone="inverse" variant="headline" weight="900">
                      {activeExercise?.name ?? activeRecord.exerciseId}
                    </AppText>
                    <PriorityTag priority={activeRecord.priority} />
                  </View>
                  <View style={styles.exerciseMeta}>
                    <View style={styles.exerciseMetaItem}>
                      <Ionicons color={colors.primary} name="repeat-outline" size={14} />
                      <AppText tone="inverse" variant="caption">
                        {formatPrescription(activeRecord)}
                      </AppText>
                    </View>
                    {activeRecord.plannedPercent1RM ? (
                      <View style={styles.exerciseMetaItem}>
                        <Ionicons color={colors.primary} name="flash-outline" size={14} />
                        <AppText tone="inverse" variant="caption">
                          {Math.round(activeRecord.plannedPercent1RM * 100)}% 1RM
                        </AppText>
                      </View>
                    ) : null}
                    <View style={styles.exerciseMetaItem}>
                      <Ionicons color={colors.primary} name="speedometer-outline" size={14} />
                      <AppText tone="inverse" variant="caption">
                        {activeRecord.plannedRpe ? `RPE ${activeRecord.plannedRpe}` : '按计划执行'}
                      </AppText>
                    </View>
                    <View style={styles.exerciseMetaItem}>
                      <Ionicons color={colors.primary} name="hourglass-outline" size={14} />
                      <AppText tone="inverse" variant="caption">
                        休息 {formatRestLabel(activeRecord.plannedRestSeconds)}
                      </AppText>
                    </View>
                  </View>
                </View>
              </View>

              {isResting ? (
                <View style={styles.restCard}>
                  <View style={styles.restHeader}>
                    <View style={styles.restIndicator} />
                    <View>
                      <AppText tone="inverse" variant="subtitle" weight="800">
                        休息中
                      </AppText>
                      <AppText tone="muted" variant="caption">
                        结束后自动进入下一组
                      </AppText>
                    </View>
                  </View>
                  <AppText tone="inverse" variant="headline" weight="900">
                    {formatTimer(restSecondsRemaining)}
                  </AppText>
                  <Pressable onPress={skipRest} style={styles.restSkipButton}>
                    <AppText tone="inverse" variant="caption" weight="700">
                      跳过休息
                    </AppText>
                    <Ionicons color={colors.surface} name="play-forward" size={16} />
                  </Pressable>
                </View>
              ) : null}

              <View style={styles.memberSection}>
                {members.map((member) => {
                  const profile = profiles[member.id] ?? null;
                  const memberSets = activeSets
                    .filter((set) => set.memberId === member.id)
                    .sort((a, b) => a.setNumber - b.setNumber);
                  const workoutSet = selectDisplaySet(memberSets);
                  const increment = getWeightIncrement(profile, activeExercise);

                  if (!workoutSet) {
                    return null;
                  }

                  return (
                    <View key={member.id} style={styles.memberCard}>
                      <View style={styles.memberHeader}>
                        <View style={styles.avatar}>
                          <AppText tone="inverse" variant="caption" weight="800">
                            {member.displayName.slice(0, 1)}
                          </AppText>
                        </View>
                        <View style={styles.memberInfo}>
                          <AppText tone="inverse" variant="bodySmall" weight="800">
                            {member.displayName}
                          </AppText>
                          <AppText tone="muted" variant="caption">
                            第 {workoutSet.setNumber} 组 · 计划{' '}
                            {formatNumber(workoutSet.plannedWeight)} kg x{' '}
                            {workoutSet.plannedReps ?? getWorkoutRecordInitialReps(activeRecord) ?? 0}
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

                      <View style={styles.optionRow}>
                        <View style={styles.optionColumn}>
                          <AppText tone="muted" variant="caption">
                            RPE
                          </AppText>
                          <View style={styles.optionPillRow}>
                            {rpeOptions.map((option) => {
                              const isActive = workoutSet.rpe === option;
                              return (
                                <Pressable
                                  accessibilityRole="button"
                                  key={option}
                                  onPress={() => void saveSetPatch(workoutSet, { rpe: option })}
                                  style={[styles.optionPill, isActive && styles.optionPillActive]}
                                >
                                  <AppText
                                    tone={isActive ? 'inverse' : 'muted'}
                                    variant="caption"
                                    weight="800"
                                  >
                                    {option}
                                  </AppText>
                                </Pressable>
                              );
                            })}
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => void saveSetPatch(workoutSet, { rpe: undefined })}
                              style={[
                                styles.optionPill,
                                workoutSet.rpe === undefined && styles.optionPillClearActive,
                              ]}
                            >
                              <AppText
                                tone={workoutSet.rpe === undefined ? 'inverse' : 'muted'}
                                variant="caption"
                                weight="800"
                              >
                                清空
                              </AppText>
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      <View style={styles.optionRow}>
                        <View style={styles.optionColumn}>
                          <AppText tone="muted" variant="caption">
                            RIR
                          </AppText>
                          <View style={styles.optionPillRow}>
                            {rirOptions.map((option) => {
                              const isActive = workoutSet.rir === option;
                              return (
                                <Pressable
                                  accessibilityRole="button"
                                  key={option}
                                  onPress={() => void saveSetPatch(workoutSet, { rir: option })}
                                  style={[styles.optionPill, isActive && styles.optionPillActive]}
                                >
                                  <AppText
                                    tone={isActive ? 'inverse' : 'muted'}
                                    variant="caption"
                                    weight="800"
                                  >
                                    {option}
                                  </AppText>
                                </Pressable>
                              );
                            })}
                            <Pressable
                              accessibilityRole="button"
                              onPress={() => void saveSetPatch(workoutSet, { rir: undefined })}
                              style={[
                                styles.optionPill,
                                workoutSet.rir === undefined && styles.optionPillClearActive,
                              ]}
                            >
                              <AppText
                                tone={workoutSet.rir === undefined ? 'inverse' : 'muted'}
                                variant="caption"
                                weight="800"
                              >
                                清空
                              </AppText>
                            </Pressable>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>

              {completedActiveSets.length > 0 ? (
                <View style={styles.completedSection}>
                  <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                      <Ionicons color={colors.success} name="checkmark-circle-outline" size={18} />
                      <AppText tone="inverse" variant="bodySmall" weight="700">
                        已完成组
                      </AppText>
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={confirmUndoLatestRound}
                      style={styles.undoButton}
                    >
                      <Ionicons color={colors.darkMuted} name="arrow-undo-outline" size={14} />
                      <AppText tone="muted" variant="caption">
                        撤销
                      </AppText>
                    </Pressable>
                  </View>

                  {completedActiveSets.map((set) => (
                    <CompletedSetCard
                      key={set.id}
                      memberName={membersById.get(set.memberId)?.displayName ?? '成员'}
                      onDelete={() => confirmDeleteSet(set)}
                      onSavePatch={(patch) => void saveSetPatch(set, patch)}
                      set={set}
                    />
                  ))}
                </View>
              ) : null}
            </>
          ) : null}
        </ScrollView>

        {detail && activeRecord ? (
          <View style={styles.bottomBar}>
            <View style={styles.bottomTimerRow}>
              <View style={styles.timerBadge}>
                <Ionicons color={colors.primary} name="timer-outline" size={16} />
                <AppText tone="inverse" variant="caption" weight="700">
                  {formatTimer(elapsedSeconds)}
                </AppText>
              </View>
              <View style={styles.savedBadge}>
                <Ionicons
                  color={lastSavedAt ? colors.success : colors.darkMuted}
                  name={lastSavedAt ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                />
                <AppText tone={lastSavedAt ? 'muted' : 'muted'} variant="caption">
                  {lastSavedAt ? '已自动保存' : '等待记录'}
                </AppText>
              </View>
            </View>

            <Pressable
              onPress={() => void completeCurrentRound()}
              style={[styles.primaryButton, isWorkoutReadyToFinish && styles.primaryButtonFinish]}
              disabled={isFinishing}
            >
              <Ionicons
                color={colors.surface}
                name={isWorkoutReadyToFinish ? 'flag-outline' : 'checkmark-circle-outline'}
                size={20}
              />
              <AppText tone="inverse" variant="body" weight="800">
                {primaryActionLabel}
              </AppText>
            </Pressable>

            <View style={styles.auxRow}>
              <Pressable onPress={showSkipComingSoon} style={styles.auxButton}>
                <Ionicons color={colors.darkMuted} name="play-skip-forward-outline" size={16} />
                <AppText tone="muted" variant="caption">
                  跳过
                </AppText>
              </Pressable>
              <View style={styles.auxDivider} />
              <Pressable onPress={showReplaceComingSoon} style={styles.auxButton}>
                <Ionicons color={colors.darkMuted} name="swap-horizontal-outline" size={16} />
                <AppText tone="muted" variant="caption">
                  替换动作
                </AppText>
              </Pressable>
              <View style={styles.auxDivider} />
              <Pressable
                disabled={!hasNextExercise}
                onPress={goNextExercise}
                style={[styles.auxButton, !hasNextExercise && styles.auxButtonDisabled]}
              >
                <Ionicons color={hasNextExercise ? colors.darkMuted : colors.darkCard} name="arrow-forward-outline" size={16} />
                <AppText tone={hasNextExercise ? 'muted' : 'muted'} variant="caption">
                  下一个动作
                </AppText>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.dark,
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  topButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  progressPanel: {
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressTrack: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    height: 6,
    overflow: 'hidden',
  },
  progressFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: '100%',
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: colors.darkCard,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  exerciseCard: {
    borderRadius: radius.lg,
    minHeight: 160,
    overflow: 'hidden',
  },
  exerciseHeroBg: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  exerciseHeroImage: {
    opacity: 0.85,
  },
  exerciseHeroScrim: {
    backgroundColor: 'rgba(1,12,22,0.65)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  exerciseOverlay: {
    gap: spacing.md,
    justifyContent: 'flex-end',
    padding: spacing.lg,
  },
  exerciseTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  exerciseMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  exerciseMetaItem: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  restCard: {
    alignItems: 'center',
    backgroundColor: colors.darkCard,
    borderColor: colors.primary,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  restHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  restIndicator: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 8,
    width: 8,
  },
  restSkipButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  memberSection: {
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
  stepperLabelRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  stepperInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    color: colors.textStrong,
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    height: 54,
    paddingHorizontal: spacing.sm,
    textAlign: 'center',
  },
  optionRow: {
    gap: spacing.xs,
  },
  optionColumn: {
    gap: spacing.xs,
  },
  optionPillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  optionPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    minWidth: 42,
    paddingHorizontal: spacing.sm,
  },
  optionPillActive: {
    backgroundColor: colors.primary,
  },
  optionPillClearActive: {
    backgroundColor: colors.darkMuted,
  },
  completedSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionHeaderLeft: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  undoButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  completedSetCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
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
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconButtonDanger: {
    alignItems: 'center',
    backgroundColor: 'rgba(229,72,77,0.15)',
    borderRadius: radius.pill,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  completedEditor: {
    gap: spacing.md,
  },
  notesInput: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    color: colors.surface,
    minHeight: 72,
    padding: spacing.md,
    textAlignVertical: 'top',
  },
  bottomBar: {
    backgroundColor: colors.dark,
    borderTopColor: 'rgba(255,255,255,0.08)',
    borderTopWidth: 1,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    paddingTop: spacing.md,
  },
  bottomTimerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,90,77,0.12)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  savedBadge: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  primaryButtonFinish: {
    backgroundColor: colors.brandDark,
  },
  auxRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  auxButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  auxButtonDisabled: {
    opacity: 0.3,
  },
  auxDivider: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    height: 16,
    width: 1,
  },
  optionGroup: {
    gap: spacing.xs,
  },
});
