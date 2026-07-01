import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthGateSheets } from '@/components/auth';
import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import { AppButton, AppText } from '@/components/ui';
import { CompletedSetList } from '@/components/workout/CompletedSetList';
import { CurrentSetRecorder } from '@/components/workout/CurrentSetRecorder';
import { ExerciseHeroCard } from '@/components/workout/ExerciseHeroCard';
import { GroupMemberStrip } from '@/components/workout/GroupMemberStrip';
import { RotationOrderCard } from '@/components/workout/RotationOrderCard';
import { WorkoutProgressStrip } from '@/components/workout/WorkoutProgressStrip';
import { WorkoutLiveStatsBar } from '@/components/workout/WorkoutLiveStatsBar';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { DEFAULT_BARBELL_INCREMENT, DEFAULT_DUMBBELL_INCREMENT } from '@/domain/weight/weight-calculator';
import {
  checkShortWorkout,
  getNextWorkoutSetForRotation,
  getWorkoutExerciseSetProgress,
  getWorkoutRecordInitialReps,
} from '@/domain/workout/workout.service';
import type {
  SaveWorkoutSetInput,
  WorkoutSessionDetail,
  WorkoutSet,
} from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { syncGroupMembersAvatar } from '@/services/memberSyncService';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
import { colors, radius, spacing } from '@/theme';

function formatTimer(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remain = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
}

function getNowMs(): number {
  return Date.now();
}

function getWeightIncrement(profile: MemberProfile | null, exercise: Exercise | null): number {
  if (exercise?.equipment === 'dumbbell') {
    return profile?.dumbbellIncrement ?? DEFAULT_DUMBBELL_INCREMENT;
  }
  return profile?.barbellIncrement ?? DEFAULT_BARBELL_INCREMENT;
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

type MemberRestTimerState = {
  endTime: number;
  isResting: boolean;
  plannedSeconds?: number;
  remaining: number;
  sourceSetId?: string;
  startedAt?: number;
};

function confirmExceptionalSetInput(weight: number, reps: number): Promise<boolean> {
  const reasons: string[] = [];
  if (weight > 1000) {
    reasons.push(`重量为 ${weight}kg`);
  }
  if (reps === 0) {
    reasons.push('次数为 0');
  }
  if (reps > 100) {
    reasons.push(`次数为 ${reps}`);
  }

  if (reasons.length === 0) {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    Alert.alert('确认本组数据？', `${reasons.join('、')}，请确认是否按当前数据保存。`, [
      { text: '返回修改', style: 'cancel', onPress: () => resolve(false) },
      { text: '确认保存', onPress: () => resolve(true) },
    ]);
  });
}

export default function WorkoutRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [replacementExercises, setReplacementExercises] = useState<Exercise[]>([]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [memberRestState, setMemberRestState] = useState<Record<string, MemberRestTimerState>>({});
  const [isWorkoutReadyToFinish, setWorkoutReadyToFinish] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [isReplaceSheetVisible, setReplaceSheetVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startedAt = detail?.session.startedAt ? new Date(detail.session.startedAt).getTime() : getNowMs();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((getNowMs() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [detail?.session.startedAt]);

  useEffect(() => {
    const activeRestMembers = Object.entries(memberRestState).filter(([, state]) => state.isResting);
    if (activeRestMembers.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      setMemberRestState((prev) => {
        const next = { ...prev };
        Object.entries(next).forEach(([memberId, state]) => {
          if (state.isResting && state.remaining > 0) {
            const remaining = Math.max(0, Math.ceil((state.endTime - getNowMs()) / 1000));
            next[memberId] = { ...state, remaining };
          }
        });
        return next;
      });
    }, 250);
    return () => clearInterval(timer);
  }, [memberRestState]);

  const loadWorkout = useCallback(async () => {
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

      // 先从服务器同步成员头像
      const tempDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      if (tempDetail.session.groupId) {
        await syncGroupMembersAvatar(tempDetail.session.groupId);
      }

      const nextDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      const allMembers = await repositories.memberRepository.listMembers(nextDetail.session.groupId);
      const participantIds = new Set(nextDetail.sets.map((set) => set.memberId));
      const nextMembers =
        participantIds.size > 0
          ? allMembers.filter((member) => participantIds.has(member.id))
          : allMembers;
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
  }, [authMode, repositories, sessionId]);

  useFocusEffect(
    useCallback(() => {
      void loadWorkout();
    }, [loadWorkout]),
  );

  const saveSetPatch = useCallback(
    async (set: WorkoutSet, patch: Omit<SaveWorkoutSetInput, 'id'>): Promise<WorkoutSet | null> => {
      if (!guardFeature('save_workout')) {
        return null;
      }

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
        void enqueueSyncCandidate({
          entityType: 'workoutSets',
          localId: saved.id,
          operation: 'update',
          payload: {
            actualReps: saved.actualReps,
            actualRestSeconds: saved.actualRestSeconds,
            actualWeight: saved.actualWeight,
            completed: saved.completed,
            exerciseRecordId: saved.exerciseRecordId,
            memberId: saved.memberId,
            notes: saved.notes,
            plannedReps: saved.plannedReps,
            plannedWeight: saved.plannedWeight,
            rpe: saved.rpe,
            sessionId: saved.sessionId,
            setNumber: saved.setNumber,
            skipped: saved.skipped,
          },
          status: 'pending_update',
          updatedAt: saved.updatedAt,
        }).catch(() => undefined);
        return saved;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '本组保存失败。');
        setDetail((current) => replaceSet(current, set));
        return null;
      }
    },
    [guardFeature, repositories],
  );

  const discardWorkout = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    try {
      await repositories.workoutRepository.deleteSession(sessionId);
      router.replace('/(tabs)/today');
    } catch (discardError) {
      setError(discardError instanceof Error ? discardError.message : '放弃本次训练失败。');
    }
  }, [repositories, sessionId]);

  const confirmDiscardWorkout = useCallback(() => {
    Alert.alert('放弃本次训练？', '这会删除本次已经记录的组数据，且无法撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '确认放弃', style: 'destructive', onPress: () => void discardWorkout() },
    ]);
  }, [discardWorkout]);

  const saveCompletedWorkout = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    if (isFinishing) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    setIsFinishing(true);
    setError(null);
    try {
      await repositories.workoutRepository.finishSession(sessionId);
      if (detail) {
        void enqueueSyncCandidate({
          entityType: 'workoutSessions',
          localId: detail.session.id,
          operation: 'update',
          payload: {
            date: detail.session.date,
            groupId: detail.session.groupId,
            planId: detail.session.planId,
            status: 'completed',
            title: detail.session.title,
            trainingMode: detail.session.trainingMode,
            week: detail.session.week,
            weekday: detail.session.weekday,
          },
          status: 'pending_update',
          updatedAt: new Date().toISOString(),
        }).catch(() => undefined);
      }
      router.replace({ pathname: '/workout/summary/[sessionId]', params: { sessionId } });
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : '完成训练失败。');
    } finally {
      setIsFinishing(false);
    }
  }, [detail, guardFeature, isFinishing, repositories, sessionId]);

  const finishWorkout = useCallback(async (options: { force?: boolean } = {}) => {
    if (!sessionId) {
      return;
    }
    if (isFinishing) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    if (!options.force && detail) {
      const completedSetCount = detail.sets.filter((set) => set.completed).length;
      const completedExerciseCount = detail.exercises.filter((record) =>
        detail.sets.some((set) => set.exerciseRecordId === record.id && set.completed),
      ).length;
      const currentTotalVolumeKg = detail.sets
        .filter((set) => set.completed)
        .reduce(
          (sum, set) =>
            sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0),
          0,
        );
      const shortWorkout = checkShortWorkout({
        completedExerciseCount,
        completedSetCount,
        elapsedSeconds,
        totalExerciseCount: detail.exercises.length,
        totalVolumeKg: currentTotalVolumeKg,
      });

      if (shortWorkout.shouldConfirm) {
        Alert.alert(
          '本次训练记录较少',
          `当前${shortWorkout.reasons.join('、')}。是否仍然保存为正式训练记录？`,
          [
            { text: '继续训练', style: 'cancel' },
            { text: '保存记录', onPress: () => void saveCompletedWorkout() },
            { text: '放弃本次', style: 'destructive', onPress: confirmDiscardWorkout },
          ],
        );
        return;
      }
    }

    await saveCompletedWorkout();
  }, [confirmDiscardWorkout, detail, elapsedSeconds, guardFeature, isFinishing, saveCompletedWorkout, sessionId]);

  const activeRecord = detail?.exercises[activeExerciseIndex] ?? null;
  const activeExercise = activeRecord ? exerciseMap[activeRecord.exerciseId] ?? null : null;
  const activeSets = activeRecord
    ? detail?.sets.filter((set) => set.exerciseRecordId === activeRecord.id) ?? []
    : [];
  const memberOrder = useMemo(() => members.map((member) => member.id), [members]);
  const exerciseSetProgress = activeRecord
    ? getWorkoutExerciseSetProgress(activeSets, activeRecord.id)
    : {
        completedMemberSets: 0,
        currentSetNumber: 0,
        isComplete: false,
        totalMemberSets: 0,
        totalPlannedSets: 0,
      };
  const sortedActiveSets = [...activeSets].sort(
    (left, right) =>
      left.setNumber - right.setNumber ||
      memberOrder.indexOf(left.memberId) - memberOrder.indexOf(right.memberId) ||
      left.id.localeCompare(right.id),
  );
  const pendingRotationSet = activeRecord
    ? getNextWorkoutSetForRotation(activeSets, memberOrder, activeRecord.id)
    : null;
  const membersById = useMemo(() => new Map(members.map((member) => [member.id, member])), [members]);
  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => map.set(member.id, member.displayName));
    return map;
  }, [members]);
  const hasNextExercise = detail ? activeExerciseIndex < detail.exercises.length - 1 : false;
  const sessionSubtitle = detail
    ? `${detail.session.title} · 第 ${detail.session.week} 周 · 周 ${detail.session.weekday}`
    : '读取训练快照';

  const totalVolumeKg = useMemo(() => {
    if (!detail) return 0;
    return detail.sets
      .filter((set) => set.completed)
      .reduce((sum, set) => sum + (set.actualWeight ?? set.plannedWeight ?? 0) * (set.actualReps ?? set.plannedReps ?? 0), 0);
  }, [detail]);
  const completedSessionSets = useMemo(
    () => detail?.sets.filter((set) => set.completed).length ?? 0,
    [detail],
  );
  const totalSessionSets = detail?.sets.length ?? 0;
  const averageRpe = useMemo(() => {
    const values = detail?.sets
      .filter((set) => set.completed && set.rpe !== undefined)
      .map((set) => set.rpe as number) ?? [];
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;
  }, [detail]);

  const exerciseProgressItems = useMemo(() => {
    if (!detail) return [];
    return detail.exercises.map((record, index) => ({
      id: record.id,
      name: exerciseMap[record.exerciseId]?.name ?? record.exerciseId,
      status: index < activeExerciseIndex ? 'completed' as const : index === activeExerciseIndex ? 'current' as const : 'upcoming' as const,
    }));
  }, [detail, exerciseMap, activeExerciseIndex]);

  const fallbackDisplaySet =
    (activeMemberId
      ? sortedActiveSets.filter((set) => set.memberId === activeMemberId).at(-1)
      : sortedActiveSets.at(-1)) ??
    sortedActiveSets.at(-1) ??
    null;
  const focusedRestState = activeMemberId ? memberRestState[activeMemberId] : null;
  const focusedRestSourceSet =
    activeRecord && focusedRestState?.isResting && focusedRestState.sourceSetId
      ? activeSets.find(
          (set) =>
            set.id === focusedRestState.sourceSetId &&
            set.exerciseRecordId === activeRecord.id,
        ) ?? null
      : null;
  const currentDisplaySet = focusedRestSourceSet ?? pendingRotationSet ?? fallbackDisplaySet;
  const currentProfile = currentDisplaySet ? profiles[currentDisplaySet.memberId] ?? null : null;
  const currentIncrement = getWeightIncrement(currentProfile, activeExercise);
  const currentMemberId = currentDisplaySet?.memberId ?? members[0]?.id ?? '';
  const previousCompletedWeightForCurrentSet = currentDisplaySet
    ? [...activeSets]
        .filter(
          (set) =>
            set.memberId === currentDisplaySet.memberId &&
            set.completed &&
            set.setNumber < currentDisplaySet.setNumber &&
            set.actualWeight !== undefined &&
            Number.isFinite(set.actualWeight),
        )
        .sort((left, right) => right.setNumber - left.setNumber)[0]?.actualWeight
    : undefined;
  const completedActiveSets = [...activeSets]
    .filter((set) => set.completed && set.memberId === currentMemberId)
    .sort((left, right) => left.setNumber - right.setNumber);
  const activeSetsAfterCurrent = currentDisplaySet
    ? activeSets.map((set) =>
        set.id === currentDisplaySet.id ? { ...set, completed: true, skipped: false } : set,
      )
    : activeSets;
  const nextPendingAfterCurrent =
    activeRecord && currentDisplaySet
      ? getNextWorkoutSetForRotation(activeSetsAfterCurrent, memberOrder, activeRecord.id)
      : null;
  const nextMemberName =
    members.length > 1 && nextPendingAfterCurrent
      ? membersById.get(nextPendingAfterCurrent.memberId)?.displayName
      : undefined;
  function goNextExercise() {
    if (!detail) return;
    setMemberRestState({});
    setWorkoutReadyToFinish(false);
    setActiveExerciseIndex((index) => Math.min(detail.exercises.length - 1, index + 1));
  }

  async function completeMemberRest(memberId: string) {
    const restState = memberRestState[memberId];
    setMemberRestState((prev) => ({
      ...prev,
      [memberId]: { remaining: 0, endTime: 0, isResting: false },
    }));

    if (!restState?.sourceSetId || !restState.startedAt) {
      return;
    }

    const sourceSet = detail?.sets.find((set) => set.id === restState.sourceSetId);
    if (!sourceSet) {
      return;
    }

    const actualRestSeconds = Math.max(0, Math.round((getNowMs() - restState.startedAt) / 1000));
    await saveSetPatch(sourceSet, { actualRestSeconds });
    const nextPendingSet = activeRecord
      ? getNextWorkoutSetForRotation(activeSets, memberOrder, activeRecord.id)
      : null;
    setActiveMemberId(nextPendingSet?.memberId ?? null);
  }

  const currentMemberRest = memberRestState[currentMemberId];
  const isCurrentMemberResting =
    Boolean(currentMemberRest?.isResting) &&
    (!currentMemberRest?.sourceSetId || currentMemberRest.sourceSetId === currentDisplaySet?.id);
  const currentMemberRestSeconds = currentMemberRest?.remaining ?? 0;
  const currentRestElapsedSeconds = currentMemberRest?.plannedSeconds
    ? Math.max(0, currentMemberRest.plannedSeconds - currentMemberRestSeconds)
    : 0;
  const otherRestingMembers = members.filter(
    (member) => member.id !== currentMemberId && memberRestState[member.id]?.isResting,
  );
  const nextSetForCurrentMember = activeSets
    .filter((set) => set.memberId === currentMemberId && set.setNumber > (currentDisplaySet?.setNumber ?? 0) && !set.skipped)
    .sort((left, right) => left.setNumber - right.setNumber)[0];
  const nextSetLabel = nextPendingAfterCurrent
    ? `第 ${nextPendingAfterCurrent.setNumber} 组`
    : nextSetForCurrentMember
      ? `第 ${nextSetForCurrentMember.setNumber} 组`
      : hasNextExercise ? '下一个动作' : '完成训练';

  async function completeCurrentRound() {
    if (isWorkoutReadyToFinish) {
      await finishWorkout();
      return;
    }
    const currentRestState = memberRestState[currentMemberId];
    if (
      currentRestState?.isResting &&
      (!currentRestState.sourceSetId || currentRestState.sourceSetId === currentDisplaySet?.id)
    ) {
      await completeMemberRest(currentMemberId);
      return;
    }
    const targetSet = currentDisplaySet && !currentDisplaySet.completed && !currentDisplaySet.skipped
      ? currentDisplaySet
      : pendingRotationSet;
    if (!targetSet) {
      if (hasNextExercise) {
        goNextExercise();
      } else {
        setWorkoutReadyToFinish(true);
      }
      return;
    }

    const previousCompletedWeight = [...activeSets]
      .filter(
        (set) =>
          set.memberId === targetSet.memberId &&
          set.completed &&
          set.setNumber < targetSet.setNumber &&
          set.actualWeight !== undefined &&
          Number.isFinite(set.actualWeight),
      )
      .sort((left, right) => right.setNumber - left.setNumber)[0]?.actualWeight;
    const actualWeight = targetSet.actualWeight ?? targetSet.plannedWeight ?? previousCompletedWeight;
    const actualReps =
      targetSet.actualReps ??
      targetSet.plannedReps ??
      (activeRecord ? getWorkoutRecordInitialReps(activeRecord) : undefined);

    if (actualWeight === undefined || !Number.isFinite(actualWeight)) {
      Alert.alert('请先填写重量', '当前组没有可用的建议重量，请填写实际重量后再保存。');
      return;
    }
    if (actualReps === undefined || !Number.isInteger(actualReps) || actualReps < 0) {
      Alert.alert('请先填写次数', '当前组次数必须是非负整数。');
      return;
    }
    if (!(await confirmExceptionalSetInput(actualWeight, actualReps))) {
      return;
    }

    const savedSet = await saveSetPatch(targetSet, {
      actualReps,
      actualWeight,
      completed: true,
      skipped: false,
    });
    if (!savedSet) {
      Alert.alert('保存失败', '本组数据未保存，请重试。');
      return;
    }

    const nextActiveSets = activeSets.map((set) => (set.id === savedSet.id ? savedSet : set));
    const nextPendingSet = activeRecord
      ? getNextWorkoutSetForRotation(nextActiveSets, memberOrder, activeRecord.id)
      : null;
    const restSeconds = activeRecord?.plannedRestSeconds ?? 0;
    if (restSeconds > 0) {
      const startedAt = getNowMs();
      setMemberRestState((prev) => ({
        ...prev,
        [savedSet.memberId]: {
          remaining: restSeconds,
          endTime: startedAt + restSeconds * 1000,
          isResting: true,
          plannedSeconds: restSeconds,
          sourceSetId: savedSet.id,
          startedAt,
        },
      }));
    }

    if (nextPendingSet) {
      setWorkoutReadyToFinish(false);
      setActiveMemberId(
        restSeconds > 0 && nextPendingSet.setNumber > savedSet.setNumber
          ? savedSet.memberId
          : nextPendingSet.memberId,
      );
      return;
    }

    if (hasNextExercise) {
      goNextExercise();
      return;
    }
    setWorkoutReadyToFinish(true);
  }

  function handleDeleteSet(setId: string) {
    setDetail((current) => removeSet(current, setId));
    void repositories.workoutRepository.deleteSet(setId).catch((deleteError) => {
      setError(deleteError instanceof Error ? deleteError.message : '删除训练组失败。');
      void loadWorkout();
    });
  }

  function handleSavePatch(set: WorkoutSet, patch: Omit<SaveWorkoutSetInput, 'id'>) {
    void saveSetPatch(set, patch);
  }

  function handleUndoLatestRound() {
    const latestSetNumber = Math.max(0, ...completedActiveSets.map((set) => set.setNumber));
    const targetSets = completedActiveSets.filter((set) => set.setNumber === latestSetNumber);
    if (targetSets.length === 0) return;
    setWorkoutReadyToFinish(false);
    setMemberRestState({});
    void Promise.all(
      targetSets.map((set) =>
        saveSetPatch(set, {
          completed: false,
          skipped: false,
        }),
      ),
    );
  }

  function handleBack() {
    Alert.alert('退出训练？', '训练数据已自动保存，可以稍后回来继续。', [
      { text: '继续训练', style: 'cancel' },
      { text: '结束并返回', style: 'destructive', onPress: () => void finishWorkout() },
    ]);
  }

  function getExtraSetDefaults(memberId: string) {
    const latestSet = activeSets
      .filter((set) => set.memberId === memberId)
      .sort(
        (left, right) =>
          right.setNumber - left.setNumber ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.id.localeCompare(left.id),
      )[0];

    return {
      reps:
        latestSet?.actualReps ??
        latestSet?.plannedReps ??
        (activeRecord ? getWorkoutRecordInitialReps(activeRecord) : undefined),
      weight: latestSet?.actualWeight ?? latestSet?.plannedWeight,
    };
  }

  async function addExtraSetsForMembers(targetMemberIds: string[]) {
    if (!activeRecord || !detail) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    const uniqueTargetMemberIds = Array.from(new Set(targetMemberIds.filter(Boolean)));
    if (uniqueTargetMemberIds.length === 0) {
      Alert.alert('无法添加', '当前动作没有可添加加做组的成员。');
      return;
    }

    try {
      setError(null);
      const addedSets = await Promise.all(
        uniqueTargetMemberIds.map((memberId) => {
          const defaults = getExtraSetDefaults(memberId);
          return repositories.workoutRepository.addSetToExerciseRecord({
            completed: false,
            exerciseRecordId: activeRecord.id,
            memberId,
            notes: '加做组',
            reps: defaults.reps,
            sessionId: detail.session.id,
            weight: defaults.weight,
          });
        }),
      );

      setDetail((current) =>
        current
          ? {
              ...current,
              sets: [...current.sets, ...addedSets],
            }
          : current,
      );
      setWorkoutReadyToFinish(false);
      setActiveMemberId(addedSets[0]?.memberId ?? null);
      setLastSavedAt(new Date().toISOString());

      void Promise.all(
        addedSets.map((set) =>
          enqueueSyncCandidate({
            entityType: 'workoutSets',
            localId: set.id,
            operation: 'create',
            payload: {
              actualReps: set.actualReps,
              actualRestSeconds: set.actualRestSeconds,
              actualWeight: set.actualWeight,
              completed: set.completed,
              exerciseRecordId: set.exerciseRecordId,
              memberId: set.memberId,
              notes: set.notes,
              plannedReps: set.plannedReps,
              plannedWeight: set.plannedWeight,
              rpe: set.rpe,
              sessionId: set.sessionId,
              setNumber: set.setNumber,
              skipped: set.skipped,
            },
            status: 'pending_create',
            updatedAt: set.updatedAt,
          }),
        ),
      ).catch((syncError) => {
        console.warn('Failed to enqueue extra workout set sync candidate', syncError);
      });
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '添加加做组失败。');
    }
  }

  function confirmAddExtraSet() {
    if (!activeRecord || !detail) {
      return;
    }

    if (members.length <= 1) {
      void addExtraSetsForMembers([currentMemberId]);
      return;
    }

    Alert.alert('添加加做组', '加做组只影响本次训练记录，不会修改原计划。', [
      { text: '取消', style: 'cancel' },
      {
        text: `仅 ${membersById.get(currentMemberId)?.displayName ?? '当前成员'}`,
        onPress: () => void addExtraSetsForMembers([currentMemberId]),
      },
      {
        text: '所有成员各加一组',
        onPress: () => void addExtraSetsForMembers(memberOrder),
      },
    ]);
  }

  function handleMoreOptions() {
    Alert.alert('训练选项', '', [
      { text: '取消', style: 'cancel' },
      { text: '添加加做组', onPress: confirmAddExtraSet },
      { text: '跳过当前动作', onPress: () => {
        if (activeExerciseIndex < (detail?.exercises.length ?? 1) - 1) {
          setActiveExerciseIndex((prev) => prev + 1);
        }
      }},
      { text: '结束训练', style: 'destructive', onPress: () => void finishWorkout() },
    ]);
  }

  async function openReplaceSheet() {
    if (!activeRecord) return;
    if (completedActiveSets.length > 0) {
      Alert.alert('替换当前动作？', '当前动作已有完成组。替换只影响本次训练，历史分析会按替换后的动作统计。', [
        { text: '取消', style: 'cancel' },
        { text: '继续替换', onPress: () => void openReplaceSheetAfterConfirm() },
      ]);
      return;
    }
    await openReplaceSheetAfterConfirm();
  }

  async function openReplaceSheetAfterConfirm() {
    if (!activeRecord) return;
    const [exercises, alternatives] = await Promise.all([
      repositories.exerciseRepository.listExercises(),
      repositories.exerciseRepository.listAlternatives(activeRecord.exerciseId),
    ]);
    const alternativeIds = new Set(alternatives.map((item) => item.alternativeExerciseId));
    setReplacementExercises(
      exercises
        .slice()
        .sort(
          (left, right) =>
            Number(alternativeIds.has(right.id)) - Number(alternativeIds.has(left.id)) ||
            left.name.localeCompare(right.name),
        ),
    );
    setReplaceSheetVisible(true);
  }

  async function replaceCurrentExercise(exercise: Exercise) {
    if (!activeRecord || !detail) return;
    try {
      await repositories.workoutRepository.updateExerciseRecordExercise(activeRecord.id, exercise.id);
      const nextExercises = { ...exerciseMap, [exercise.id]: exercise };
      setExerciseMap(nextExercises);
      setDetail({
        ...detail,
        exercises: detail.exercises.map((record) =>
          record.id === activeRecord.id
            ? { ...record, exerciseId: exercise.id, replacedFromExerciseId: record.replacedFromExerciseId ?? record.exerciseId }
            : record,
        ),
      });
      setReplaceSheetVisible(false);
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : '动作替换失败。');
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
            <Ionicons color={colors.textStrong} name="arrow-back" size={24} />
          </Pressable>
          <View style={styles.topTitleGroup}>
            <AppText variant="headline" weight="900">
              训练中
            </AppText>
            <AppText tone="muted" variant="caption">
              {sessionSubtitle}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={handleMoreOptions}>
            <AppText tone="danger" variant="body" weight="700">
              结束训练
            </AppText>
          </Pressable>
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
                {authMode === 'guest_preview' ? '登录后才能进入正式训练 session' : '未找到训练记录'}
              </AppText>
              {authMode === 'guest_preview' ? (
                <AppButton onPress={() => guardFeature('start_workout')}>登录 / 注册</AppButton>
              ) : null}
            </View>
          ) : null}

          {detail && activeRecord ? (
            <>
              <View style={styles.statsRow}>
                <WorkoutLiveStatsBar
                  averageRpe={averageRpe}
                  completedSets={completedSessionSets}
                  elapsedLabel={formatTimer(elapsedSeconds)}
                  totalSets={totalSessionSets}
                  totalVolumeKg={totalVolumeKg}
                />
              </View>

              <ExerciseHeroCard
                currentSetIndex={exerciseSetProgress.currentSetNumber}
                exercise={activeExercise}
                record={activeRecord}
                totalSets={exerciseSetProgress.totalPlannedSets}
              />

              {members.length > 1 ? (
                <GroupMemberStrip
                  currentMemberId={currentMemberId}
                  members={members}
                  onSelectMember={(id) => setActiveMemberId(id)}
                  profiles={profiles}
                />
              ) : null}

              {currentDisplaySet ? (
                <CurrentSetRecorder
                  key={currentDisplaySet.id}
                  exercise={activeExercise}
                  isResting={isCurrentMemberResting}
                  isWorkoutReadyToFinish={isWorkoutReadyToFinish}
                  memberName={membersById.get(currentDisplaySet.memberId)?.displayName ?? '成员'}
                  onCompleteSet={() => void completeCurrentRound()}
                  onNotesChange={(v) => void saveSetPatch(currentDisplaySet, { notes: v })}
                  onRepsChange={(v) => void saveSetPatch(currentDisplaySet, { actualReps: v })}
                  onRpeChange={(v) => void saveSetPatch(currentDisplaySet, { rpe: v })}
                  onSkipRest={() => void completeMemberRest(currentMemberId)}
                  onWeightChange={(v) => void saveSetPatch(currentDisplaySet, { actualWeight: v })}
                  notes={currentDisplaySet.notes}
                  plannedRestSeconds={currentMemberRest?.plannedSeconds ?? activeRecord.plannedRestSeconds}
                  profile={currentProfile}
                  record={activeRecord}
                  restElapsedSeconds={currentRestElapsedSeconds}
                  restSeconds={currentMemberRestSeconds}
                  rpe={currentDisplaySet.rpe}
                  nextMemberName={nextMemberName}
                  nextSetLabel={nextSetLabel}
                  reps={currentDisplaySet.actualReps ?? currentDisplaySet.plannedReps}
                  setNumber={currentDisplaySet.setNumber}
                  weight={currentDisplaySet.actualWeight ?? currentDisplaySet.plannedWeight ?? previousCompletedWeightForCurrentSet}
                  weightIncrement={currentIncrement}
                />
              ) : null}

              {members.length > 1 && otherRestingMembers.length > 0 ? (
                <View style={styles.otherMembersRestSection}>
                  <AppText variant="caption" weight="700" style={styles.otherMembersTitle}>其他成员休息中</AppText>
                  <View style={styles.otherMembersGrid}>
                    {otherRestingMembers.map((member) => (
                      <View key={member.id} style={styles.otherMemberCard}>
                        <AppText variant="caption" weight="800">{member.displayName}</AppText>
                        <AppText variant="caption" weight="900" style={styles.otherMemberTime}>
                          {formatTimer(memberRestState[member.id]?.remaining ?? 0)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <CompletedSetList
                completedSets={completedActiveSets}
                memberNameMap={memberNameMap}
                onDeleteSet={handleDeleteSet}
                onSavePatch={handleSavePatch}
                onUndoLatestRound={handleUndoLatestRound}
              />
            </>
          ) : null}
        </ScrollView>

        {detail && activeRecord ? (
          <View style={styles.bottomBar}>
            <WorkoutProgressStrip
              currentIndex={activeExerciseIndex}
              exercises={exerciseProgressItems}
              mode="dock"
              onJumpToExercise={setActiveExerciseIndex}
            />

            <View style={styles.bottomMetaRow}>
              {members.length > 1 ? (
                <RotationOrderCard
                  currentMemberId={currentMemberId}
                  members={members}
                  mode="dock"
                  nextMemberName={nextMemberName}
                  profiles={profiles}
                />
              ) : null}
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

            <View style={styles.auxRow}>
              <Pressable
                disabled={activeExerciseIndex === 0}
                onPress={() => {
                  setMemberRestState({});
                  setWorkoutReadyToFinish(false);
                  setActiveExerciseIndex((index) => Math.max(0, index - 1));
                }}
                style={[styles.auxButton, activeExerciseIndex === 0 && styles.auxButtonDisabled]}
              >
                <Ionicons color={activeExerciseIndex > 0 ? colors.darkMuted : colors.darkCard} name="arrow-back-outline" size={16} />
                <AppText tone="muted" variant="caption">
                  上一个动作
                </AppText>
              </Pressable>
              <View style={styles.auxDivider} />
              <Pressable
                accessibilityRole="button"
                onPress={() => void openReplaceSheet()}
                style={styles.auxButton}
              >
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
      <ExercisePickerSheet
        exercises={replacementExercises}
        onClose={() => setReplaceSheetVisible(false)}
        onCreateCustomExercise={(input) => repositories.exerciseRepository.createCustomExercise(input)}
        onSelect={(exercise) => void replaceCurrentExercise(exercise)}
        selectedExerciseIds={activeRecord ? [activeRecord.exerciseId] : []}
        title="替换当前动作"
        visible={isReplaceSheetVisible}
      />
      <AuthGateSheets {...sheets} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  container: {
    flex: 1,
  },
  topBar: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    maxWidth: 430,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  topTitleGroup: {
    alignItems: 'center',
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  scrollContent: {
    alignSelf: 'center',
    gap: spacing.md,
    maxWidth: 430,
    padding: spacing.lg,
    paddingBottom: 154,
    width: '100%',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  errorContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  emptyContainer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  otherMembersRestSection: {
    gap: spacing.sm,
  },
  otherMembersTitle: {
    color: colors.textMuted,
  },
  otherMembersGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  otherMemberCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  otherMemberTime: {
    color: colors.primary,
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
  restMembers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
  },
  restMemberChip: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  restMemberDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  restMemberText: {
    color: colors.surface,
  },
  otherMembersRest: {
    gap: spacing.sm,
  },
  otherMembersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  otherMemberChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  otherMemberDot: {
    borderRadius: radius.pill,
    height: 6,
    width: 6,
  },
  restSkipButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  bottomBar: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: spacing.xxs,
    maxWidth: 430,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    paddingTop: spacing.xs,
    width: '100%',
  },
  bottomMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  bottomTimerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timerBadge: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  auxButtonDisabled: {
    opacity: 0.3,
  },
  auxDivider: {
    backgroundColor: colors.border,
    height: 16,
    width: 1,
  },
});
