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
import { Avatar } from '@/components/avatar';
import { ExercisePickerSheet } from '@/components/exercises/ExercisePickerSheet';
import { AppButton, AppCard, AppModalSheet, AppText } from '@/components/ui';
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
  WORKOUT_EXTRA_SET_NOTE,
  WORKOUT_REPLACEMENT_NOTE,
  WORKOUT_SKIPPED_EXERCISE_NOTE,
  WORKOUT_TEMPORARY_EXERCISE_NOTE,
  checkShortWorkout,
  getWorkoutCursorFromQueue,
  getNextWorkoutSetForRotation,
  getWorkoutExerciseSetProgress,
  getWorkoutRecordInitialReps,
  summarizeWorkoutAdjustments,
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

function parseDateMs(value: string | undefined): number | null {
  if (!value) {
    return null;
  }
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function getElapsedSecondsFromSession(startedAt: string | undefined, finishedAt?: string): number {
  const startedAtMs = parseDateMs(startedAt);
  if (!startedAtMs) {
    return 0;
  }
  const endedAtMs = parseDateMs(finishedAt) ?? getNowMs();
  return Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));
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
  endedAt?: number;
  endTime: number;
  isResting: boolean;
  plannedSeconds?: number;
  readyNotified?: boolean;
  remaining: number;
  sourceSetId?: string;
  startedAt?: number;
  status: 'ready' | 'resting';
};

type WorkoutMemberAdjustmentAction = 'extra_set' | 'remove_set' | 'skip';

type CompletedSetDeletionConfirm = {
  memberIds: string[];
  sets: WorkoutSet[];
} | null;

type ParticipantRemovalConfirm = {
  completedCount: number;
  member: GroupMember;
} | null;

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
  const [allGroupMembers, setAllGroupMembers] = useState<GroupMember[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [replacementExercises, setReplacementExercises] = useState<Exercise[]>([]);
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [memberRestState, setMemberRestState] = useState<Record<string, MemberRestTimerState>>({});
  const [isWorkoutReadyToFinish, setWorkoutReadyToFinish] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [exercisePickerMode, setExercisePickerMode] = useState<'addTemporary' | 'replace' | null>(null);
  const [isAdjustmentSheetVisible, setAdjustmentSheetVisible] = useState(false);
  const [memberAdjustmentAction, setMemberAdjustmentAction] = useState<WorkoutMemberAdjustmentAction | null>(null);
  const [isParticipantSheetVisible, setParticipantSheetVisible] = useState(false);
  const [completedSetDeletionConfirm, setCompletedSetDeletionConfirm] =
    useState<CompletedSetDeletionConfirm>(null);
  const [participantRemovalConfirm, setParticipantRemovalConfirm] =
    useState<ParticipantRemovalConfirm>(null);
  const [restNotice, setRestNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!detail?.session.startedAt) {
      return;
    }
    const updateElapsed = () => {
      setElapsedSeconds(getElapsedSecondsFromSession(detail.session.startedAt, detail.session.finishedAt));
    };
    const immediateTimer = setTimeout(updateElapsed, 0);
    const timer = setInterval(updateElapsed, 1000);
    return () => {
      clearTimeout(immediateTimer);
      clearInterval(timer);
    };
  }, [detail?.session.finishedAt, detail?.session.startedAt]);

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

      const tempDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      if (tempDetail.session.groupId) {
        void syncGroupMembersAvatar(tempDetail.session.groupId).catch(() => undefined);
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
      setAllGroupMembers(allMembers);
      setMembers(nextMembers);
      setProfiles(Object.fromEntries(nextProfiles));
      setExerciseMap(Object.fromEntries(nextExercises.map((exercise) => [exercise.id, exercise])));
      const cursor = getWorkoutCursorFromQueue(
        nextDetail,
        nextMembers.map((member) => member.id),
      );
      const cursorMemberId = cursor ? nextMembers[cursor.memberIndex]?.id : undefined;
      setActiveMemberId((current) =>
        current && nextMembers.some((member) => member.id === current)
          ? current
          : cursorMemberId ?? nextMembers[0]?.id ?? null,
      );
      setActiveExerciseIndex((index) =>
        cursor
          ? cursor.exerciseIndex
          : nextDetail.exercises.length > 0
            ? Math.min(index, nextDetail.exercises.length - 1)
            : 0,
      );
      setWorkoutReadyToFinish(!cursor && nextDetail.sets.some((set) => set.completed || set.skipped));
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

  useEffect(() => {
    const hasRestTimers = Object.values(memberRestState).some((state) => state.status === 'resting');
    if (!hasRestTimers) {
      return;
    }

    const timer = setInterval(() => {
      const now = getNowMs();
      const timersToPersist: { memberId: string; state: MemberRestTimerState }[] = [];
      let changed = false;
      const nextState = { ...memberRestState };

      Object.entries(memberRestState).forEach(([memberId, state]) => {
        if (state.status !== 'resting') {
          return;
        }

        const remaining = Math.max(0, Math.ceil((state.endTime - now) / 1000));
        if (remaining <= 0) {
          changed = true;
          timersToPersist.push({ memberId, state });
          nextState[memberId] = {
            ...state,
            endedAt: now,
            isResting: false,
            readyNotified: true,
            remaining: 0,
            status: 'ready',
          };
          return;
        }

        if (remaining !== state.remaining) {
          changed = true;
          nextState[memberId] = { ...state, remaining };
        }
      });

      if (changed) {
        setMemberRestState(nextState);
      }

      timersToPersist.forEach(({ memberId, state }) => {
        const memberName = members.find((member) => member.id === memberId)?.displayName ?? '成员';
        setRestNotice(`${memberName}休息结束，可以准备下一组`);

        if (!state.sourceSetId || !state.startedAt) {
          return;
        }

        const sourceSet = detail?.sets.find((set) => set.id === state.sourceSetId);
        if (!sourceSet) {
          return;
        }

        const actualRestSeconds = Math.max(0, Math.round((now - state.startedAt) / 1000));
        void saveSetPatch(sourceSet, { actualRestSeconds });
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [detail?.sets, memberRestState, members, saveSetPatch]);

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

  const finishWorkout = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    if (isFinishing) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    if (detail) {
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

      if (completedSetCount === 0) {
        Alert.alert(
          '本次训练没有有效记录',
          '还没有完成任何一组。继续训练，或放弃这次空记录。',
          [
            { text: '继续训练', style: 'cancel' },
            { text: '放弃本次', style: 'destructive', onPress: confirmDiscardWorkout },
          ],
        );
        return;
      }

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

      Alert.alert('结束本次训练？', '已完成的组会保存到历史记录，未完成组不会计入完成组。', [
        { text: '继续训练', style: 'cancel' },
        { text: '保存并结束', style: 'destructive', onPress: () => void saveCompletedWorkout() },
      ]);
      return;
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
  const validActiveMemberId =
    activeMemberId && members.some((member) => member.id === activeMemberId)
      ? activeMemberId
      : null;
  const currentMemberId = validActiveMemberId ?? pendingRotationSet?.memberId ?? members[0]?.id ?? '';
  const currentMemberSets = sortedActiveSets.filter((set) => set.memberId === currentMemberId);
  const currentDisplaySet =
    currentMemberSets.find((set) => !set.completed && !set.skipped) ?? null;
  const hasPendingForOtherMember = Boolean(
    pendingRotationSet && pendingRotationSet.memberId !== currentMemberId,
  );
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
  const adjustmentSummary = useMemo(
    () => (detail ? summarizeWorkoutAdjustments(detail) : null),
    [detail],
  );

  const exerciseProgressItems = useMemo(() => {
    if (!detail) return [];
    return detail.exercises.map((record, index) => ({
      id: record.id,
      name: exerciseMap[record.exerciseId]?.name ?? record.exerciseId,
      status: index < activeExerciseIndex ? 'completed' as const : index === activeExerciseIndex ? 'current' as const : 'upcoming' as const,
    }));
  }, [detail, exerciseMap, activeExerciseIndex]);

  const currentProfile = currentMemberId ? profiles[currentMemberId] ?? null : null;
  const currentIncrement = getWeightIncrement(currentProfile, activeExercise);
  const previousCompletedWeightForCurrentSet = currentDisplaySet
    ? [...activeSets]
        .filter(
          (set) =>
            set.memberId === currentMemberId &&
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
    setWorkoutReadyToFinish(false);
    setActiveExerciseIndex((index) => Math.min(detail.exercises.length - 1, index + 1));
  }

  const currentMemberRest = memberRestState[currentMemberId];
  const isCurrentMemberResting = currentMemberRest?.status === 'resting';
  const currentMemberRestSeconds = currentMemberRest?.remaining ?? 0;
  const currentRestElapsedSeconds = currentMemberRest?.plannedSeconds
    ? Math.max(0, currentMemberRest.plannedSeconds - currentMemberRestSeconds)
    : 0;
  const nextSetForCurrentMember = activeSets
    .filter((set) => set.memberId === currentMemberId && set.setNumber > (currentDisplaySet?.setNumber ?? 0) && !set.skipped)
    .sort((left, right) => left.setNumber - right.setNumber)[0];
  const nextSetLabel = nextPendingAfterCurrent
    ? `第 ${nextPendingAfterCurrent.setNumber} 组`
    : nextSetForCurrentMember
      ? `第 ${nextSetForCurrentMember.setNumber} 组`
      : hasNextExercise ? '下一个动作' : '完成训练';

  function openAdjustmentSheet() {
    setMemberAdjustmentAction(null);
    setAdjustmentSheetVisible(true);
  }

  function openMemberAdjustment(action: WorkoutMemberAdjustmentAction) {
    setAdjustmentSheetVisible(false);
    setMemberAdjustmentAction(action);
  }

  function findLastSetForMember(memberId: string, includeCompleted: boolean): WorkoutSet | null {
    const candidates = activeSets
      .filter((set) => set.memberId === memberId && !set.skipped && (includeCompleted || !set.completed))
      .sort(
        (left, right) =>
          right.setNumber - left.setNumber ||
          right.updatedAt.localeCompare(left.updatedAt) ||
          right.id.localeCompare(left.id),
      );
    return candidates[0] ?? null;
  }

  async function completeCurrentRound() {
    if (isWorkoutReadyToFinish) {
      await finishWorkout();
      return;
    }
    const targetSet = currentDisplaySet && !currentDisplaySet.completed && !currentDisplaySet.skipped
      ? currentDisplaySet
      : null;
    if (!targetSet) {
      if (pendingRotationSet?.memberId && pendingRotationSet.memberId !== currentMemberId) {
        setActiveMemberId(pendingRotationSet.memberId);
        return;
      }
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
          endTime: startedAt + restSeconds * 1000,
          isResting: true,
          plannedSeconds: restSeconds,
          readyNotified: false,
          remaining: restSeconds,
          sourceSetId: savedSet.id,
          startedAt,
          status: 'resting',
        },
      }));
    }

    if (nextPendingSet) {
      setActiveMemberId(nextPendingSet.memberId);
      setWorkoutReadyToFinish(false);
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
            notes: WORKOUT_EXTRA_SET_NOTE,
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
      setActiveMemberId(uniqueTargetMemberIds[0] ?? currentMemberId);
      setWorkoutReadyToFinish(false);
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

  async function removeLastSetsForMembers(
    targetMemberIds: string[],
    allowCompletedDeletion = false,
  ): Promise<'deleted' | 'confirming' | 'idle'> {
    if (!activeRecord || !detail) {
      return 'idle';
    }
    if (!guardFeature('save_workout')) {
      return 'idle';
    }

    const uniqueTargetMemberIds = Array.from(new Set(targetMemberIds.filter(Boolean)));
    const pendingSets = uniqueTargetMemberIds
      .map((memberId) => findLastSetForMember(memberId, false))
      .filter((set): set is WorkoutSet => Boolean(set));
    const targetSets =
      pendingSets.length > 0
        ? pendingSets
        : uniqueTargetMemberIds
            .map((memberId) => findLastSetForMember(memberId, true))
            .filter((set): set is WorkoutSet => Boolean(set));

    if (targetSets.length === 0) {
      Alert.alert('没有可删除的组', '当前动作下选中成员没有可调整的训练组。');
      return 'idle';
    }

    const touchesCompletedRecord = targetSets.some((set) => set.completed);
    if (touchesCompletedRecord && !allowCompletedDeletion) {
      setCompletedSetDeletionConfirm({ memberIds: uniqueTargetMemberIds, sets: targetSets });
      setAdjustmentSheetVisible(false);
      return 'confirming';
    }

    setDetail((current) =>
      current
        ? {
            ...current,
            sets: current.sets.filter((set) => !targetSets.some((target) => target.id === set.id)),
          }
        : current,
    );
    setWorkoutReadyToFinish(false);
    setLastSavedAt(new Date().toISOString());

    try {
      await Promise.all(targetSets.map((set) => repositories.workoutRepository.deleteSet(set.id)));
      setCompletedSetDeletionConfirm(null);
      return 'deleted';
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除训练组失败。');
      void loadWorkout();
      return 'idle';
    }
  }

  function confirmAddExtraSet() {
    if (!activeRecord || !detail) {
      return;
    }
    openMemberAdjustment('extra_set');
  }

  async function addParticipantMember(memberId: string) {
    if (!detail || members.some((member) => member.id === memberId)) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    try {
      setError(null);
      const addedSets: WorkoutSet[] = [];
      for (const record of detail.exercises) {
        const plannedSetCount = Math.max(
          1,
          record.plannedSets ?? 0,
          ...detail.sets
            .filter((set) => set.exerciseRecordId === record.id)
            .map((set) => set.setNumber),
        );
        for (let index = 0; index < plannedSetCount; index += 1) {
          const set = await repositories.workoutRepository.addSetToExerciseRecord({
            completed: false,
            exerciseRecordId: record.id,
            memberId,
            reps: getWorkoutRecordInitialReps(record),
            sessionId: detail.session.id,
          });
          addedSets.push(set);
        }
      }

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
      ).catch(() => undefined);

      setActiveMemberId(memberId);
      await loadWorkout();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '添加参与成员失败。');
    }
  }

  async function removeParticipantMember(memberId: string, force = false) {
    if (!detail || members.length <= 1) {
      Alert.alert('无法移除', '本次训练至少需要保留 1 位参与成员。');
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    const memberSets = detail.sets.filter((set) => set.memberId === memberId);
    const completedCount = memberSets.filter((set) => set.completed).length;
    if (completedCount > 0 && !force) {
      const member = allGroupMembers.find((member) => member.id === memberId);
      if (member) {
        setParticipantRemovalConfirm({ completedCount, member });
      }
      return;
    }

    try {
      await repositories.workoutRepository.deleteMemberSetsInSession(detail.session.id, memberId);
      const nextMemberId = members.find((member) => member.id !== memberId)?.id ?? null;
      setActiveMemberId(nextMemberId);
      await loadWorkout();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : '移除参与成员失败。');
    }
  }

  function openParticipantEditor() {
    if (!detail) {
      return;
    }

    setAdjustmentSheetVisible(false);
    setParticipantSheetVisible(true);
  }

  function confirmFinishWorkout() {
    void finishWorkout();
  }

  function openWorkoutAdjustmentMenu() {
    openAdjustmentSheet();
  }

  async function refreshDetailCursor() {
    if (!detail) {
      return;
    }
    const nextDetail = await repositories.workoutRepository.getSessionDetail(detail.session.id);
    const cursor = getWorkoutCursorFromQueue(nextDetail, memberOrder);
    setDetail(nextDetail);
    if (cursor) {
      setActiveExerciseIndex(cursor.exerciseIndex);
      setWorkoutReadyToFinish(false);
      return;
    }
    setWorkoutReadyToFinish(nextDetail.sets.some((set) => set.completed || set.skipped));
  }

  async function skipCurrentExerciseForMembers(targetMemberIds: string[]) {
    if (!activeRecord || !detail) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

    const targetMemberSet = new Set(targetMemberIds);
    const targetSets = activeSets.filter(
      (set) =>
        !set.completed &&
        !set.skipped &&
        targetMemberSet.has(set.memberId),
    );
    if (targetSets.length === 0) {
      Alert.alert('无需跳过', '当前范围没有待记录的组。');
      return;
    }

    try {
      await Promise.all(
        targetSets.map((set) =>
          saveSetPatch(set, {
            completed: false,
            notes: set.notes ? `${set.notes}；${WORKOUT_SKIPPED_EXERCISE_NOTE}` : WORKOUT_SKIPPED_EXERCISE_NOTE,
            skipped: true,
          }),
        ),
      );
      await refreshDetailCursor();
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : '本次跳过动作失败。');
    }
  }

  async function applyMemberAdjustment(action: WorkoutMemberAdjustmentAction, targetMemberIds: string[]) {
    if (!activeRecord || !detail) {
      return;
    }

    const uniqueTargetMemberIds = Array.from(new Set(targetMemberIds.filter((memberId) => memberOrder.includes(memberId))));
    if (uniqueTargetMemberIds.length === 0) {
      Alert.alert('请选择成员', '至少选择一位成员后再调整。');
      return;
    }

    if (action === 'extra_set') {
      await addExtraSetsForMembers(uniqueTargetMemberIds);
      setMemberAdjustmentAction(null);
      const name = uniqueTargetMemberIds.length === 1
        ? membersById.get(uniqueTargetMemberIds[0])?.displayName ?? '成员'
        : `${uniqueTargetMemberIds.length} 位成员`;
      setRestNotice(`已为${name}增加 1 组`);
      return;
    }

    if (action === 'remove_set') {
      const result = await removeLastSetsForMembers(uniqueTargetMemberIds);
      if (result === 'deleted' || result === 'idle') {
        setMemberAdjustmentAction(null);
      }
      if (result === 'deleted') {
        const name = uniqueTargetMemberIds.length === 1
          ? membersById.get(uniqueTargetMemberIds[0])?.displayName ?? '成员'
          : `${uniqueTargetMemberIds.length} 位成员`;
        setRestNotice(`已为${name}减少 1 组`);
      }
      return;
    }

    Alert.alert('跳过当前动作？', '这会把所选成员当前动作的未完成组标记为跳过，只影响本次训练。', [
      { text: '返回', style: 'cancel' },
      {
        text: '确认跳过',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await skipCurrentExerciseForMembers(uniqueTargetMemberIds);
            setMemberAdjustmentAction(null);
          })();
        },
      },
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
    setExercisePickerMode('replace');
  }

  async function openTemporaryExerciseSheet() {
    const exercises = await repositories.exerciseRepository.listExercises();
    setReplacementExercises(exercises.slice().sort((left, right) => left.name.localeCompare(right.name)));
    setExercisePickerMode('addTemporary');
  }

  function handleExercisePickerSelect(exercise: Exercise) {
    if (exercisePickerMode === 'replace') {
      confirmReplaceCurrentExercise(exercise);
      return;
    }
    if (exercisePickerMode === 'addTemporary') {
      confirmTemporaryExercisePlacement(exercise);
    }
  }

  function confirmReplaceCurrentExercise(exercise: Exercise) {
    Alert.alert('替换原因', '替换只影响本次训练，已完成组会保留为原动作。', [
      { text: '取消', style: 'cancel' },
      { text: '器械被占', onPress: () => void replaceCurrentExercise(exercise, '器械被占') },
      { text: '状态不好', onPress: () => void replaceCurrentExercise(exercise, '状态不好') },
      { text: '动作不适', onPress: () => void replaceCurrentExercise(exercise, '动作不适') },
      { text: '临时调整', onPress: () => void replaceCurrentExercise(exercise, '临时调整') },
    ]);
  }

  async function replaceCurrentExercise(exercise: Exercise, reason: string) {
    if (!activeRecord || !detail) return;
    try {
      const note = `${WORKOUT_REPLACEMENT_NOTE}：${reason}`;
      await repositories.workoutRepository.updateExerciseRecordExercise(activeRecord.id, exercise.id, note);
      const nextExercises = { ...exerciseMap, [exercise.id]: exercise };
      setExerciseMap(nextExercises);
      setDetail({
        ...detail,
        exercises: detail.exercises.map((record) =>
          record.id === activeRecord.id
            ? {
                ...record,
                exerciseId: exercise.id,
                notes: note,
                replacedFromExerciseId: record.replacedFromExerciseId ?? record.exerciseId,
              }
            : record,
        ),
      });
      void enqueueSyncCandidate({
        entityType: 'workoutExerciseRecords',
        localId: activeRecord.id,
        operation: 'update',
        payload: {
          exerciseId: exercise.id,
          groupId: detail.session.groupId,
          notes: note,
          orderIndex: activeRecord.orderIndex,
          parentServerId: detail.session.id,
          planExerciseId: activeRecord.planExerciseId,
          plannedPercent1RM: activeRecord.plannedPercent1RM,
          plannedRepMax: activeRecord.plannedRepMax,
          plannedRepMin: activeRecord.plannedRepMin,
          plannedReps: activeRecord.plannedReps,
          plannedRestSeconds: activeRecord.plannedRestSeconds,
          plannedSets: activeRecord.plannedSets,
          priority: activeRecord.priority,
          replacedFromExerciseId: activeRecord.replacedFromExerciseId ?? activeRecord.exerciseId,
          sessionId: activeRecord.sessionId,
        },
        status: 'pending_update',
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
      setExercisePickerMode(null);
    } catch (replaceError) {
      setError(replaceError instanceof Error ? replaceError.message : '动作替换失败。');
    }
  }

  function confirmTemporaryExercisePlacement(exercise: Exercise) {
    if (!activeRecord) {
      return;
    }

    Alert.alert('添加临时动作', '默认只加入本次训练，不会写回原计划。', [
      { text: '取消', style: 'cancel' },
      {
        text: '添加到当前位置',
        onPress: () => void addTemporaryExercise(exercise, activeRecord.orderIndex),
      },
      {
        text: '添加到当前动作之后',
        onPress: () => void addTemporaryExercise(exercise, activeRecord.orderIndex + 1),
      },
      {
        text: '添加到训练末尾',
        onPress: () => void addTemporaryExercise(exercise),
      },
    ]);
  }

  async function addTemporaryExercise(exercise: Exercise, insertOrderIndex?: number) {
    if (!detail || !guardFeature('save_workout')) {
      return;
    }

    const beforeRecordIds = new Set(detail.exercises.map((record) => record.id));
    const defaultSetCount = Math.max(1, activeRecord?.plannedSets ?? 3);
    const defaultReps = currentDisplaySet?.actualReps ?? currentDisplaySet?.plannedReps ?? activeRecord?.plannedReps ?? 10;
    const defaultWeight = currentDisplaySet?.actualWeight ?? currentDisplaySet?.plannedWeight;

    try {
      const nextDetail = await repositories.workoutRepository.addExerciseToSession({
        exerciseId: exercise.id,
        insertOrderIndex,
        memberId: memberOrder[0] ?? currentMemberId,
        memberIds: memberOrder.length > 0 ? memberOrder : [currentMemberId],
        notes: WORKOUT_TEMPORARY_EXERCISE_NOTE,
        sessionId: detail.session.id,
        sets: Array.from({ length: defaultSetCount }, () => ({
          completed: false,
          notes: WORKOUT_TEMPORARY_EXERCISE_NOTE,
          reps: defaultReps,
          weight: defaultWeight,
        })),
      });
      const nextRecord = nextDetail.exercises.find((record) => !beforeRecordIds.has(record.id));
      const nextRecordIndex = nextRecord
        ? nextDetail.exercises.findIndex((record) => record.id === nextRecord.id)
        : -1;

      setExerciseMap((current) => ({ ...current, [exercise.id]: exercise }));
      setDetail(nextDetail);
      setExercisePickerMode(null);
      setWorkoutReadyToFinish(false);
      if (nextRecordIndex >= 0) {
        setActiveExerciseIndex(nextRecordIndex);
      }
      if (nextRecord) {
        const now = new Date().toISOString();
        void enqueueSyncCandidate({
          entityType: 'workoutExerciseRecords',
          localId: nextRecord.id,
          operation: 'create',
          payload: {
            exerciseId: nextRecord.exerciseId,
            groupId: detail.session.groupId,
            notes: nextRecord.notes,
            orderIndex: nextRecord.orderIndex,
            parentServerId: detail.session.id,
            planExerciseId: nextRecord.planExerciseId,
            plannedPercent1RM: nextRecord.plannedPercent1RM,
            plannedRepMax: nextRecord.plannedRepMax,
            plannedRepMin: nextRecord.plannedRepMin,
            plannedReps: nextRecord.plannedReps,
            plannedRestSeconds: nextRecord.plannedRestSeconds,
            plannedSets: nextRecord.plannedSets,
            priority: nextRecord.priority,
            replacedFromExerciseId: nextRecord.replacedFromExerciseId,
            sessionId: nextRecord.sessionId,
          },
          status: 'pending_create',
          updatedAt: now,
        }).catch(() => undefined);
        void Promise.all(
          nextDetail.sets
            .filter((set) => set.exerciseRecordId === nextRecord.id)
            .map((set) =>
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
        ).catch(() => undefined);
      }
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '添加临时动作失败。');
    }
  }

  const participatingMemberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const addableMembers = useMemo(
    () => allGroupMembers.filter((member) => !participatingMemberIds.has(member.id)),
    [allGroupMembers, participatingMemberIds],
  );

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
          <Pressable accessibilityRole="button" onPress={confirmFinishWorkout}>
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
                onOpenAdjustments={openWorkoutAdjustmentMenu}
                record={activeRecord}
                totalSets={exerciseSetProgress.totalPlannedSets}
              />

              {adjustmentSummary?.hasAdjustments ? (
                <View style={styles.adjustmentHint}>
                  <Ionicons color={colors.primary} name="options-outline" size={16} />
                  <AppText tone="muted" variant="caption" weight="800">
                    本次已调整：替换 {adjustmentSummary.replacementCount} · 加做 {adjustmentSummary.extraSetCount} · 跳过 {adjustmentSummary.skippedExerciseCount} · 临时 {adjustmentSummary.temporaryExerciseCount}
                  </AppText>
                </View>
              ) : null}

              {members.length > 1 ? (
                <GroupMemberStrip
                  currentMemberId={currentMemberId}
                  members={members}
                  onSelectMember={setActiveMemberId}
                  profiles={profiles}
                  restStates={memberRestState}
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
              ) : (
                <MemberExerciseCompleteCard
                  hasNextExercise={hasNextExercise}
                  hasPendingForOtherMember={hasPendingForOtherMember}
                  memberName={membersById.get(currentMemberId)?.displayName ?? '成员'}
                  nextMemberName={pendingRotationSet ? membersById.get(pendingRotationSet.memberId)?.displayName : undefined}
                  onAddSet={confirmAddExtraSet}
                  onNextExercise={goNextExercise}
                  onSwitchNextMember={() => {
                    if (pendingRotationSet?.memberId) {
                      setActiveMemberId(pendingRotationSet.memberId);
                    }
                  }}
                  onFinish={() => void finishWorkout()}
                />
              )}

              {restNotice ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setRestNotice(null)}
                  style={styles.restNotice}
                >
                  <Ionicons color={colors.success} name="checkmark-circle-outline" size={18} />
                  <AppText variant="bodySmall" weight="900" style={styles.restNoticeText}>
                    {restNotice}
                  </AppText>
                </Pressable>
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

          </View>
        ) : null}
      </View>
      <ExercisePickerSheet
        exercises={replacementExercises}
        onClose={() => setExercisePickerMode(null)}
        onCreateCustomExercise={(input) => repositories.exerciseRepository.createCustomExercise(input)}
        onSelect={handleExercisePickerSelect}
        selectedExerciseIds={exercisePickerMode === 'replace' && activeRecord ? [activeRecord.exerciseId] : []}
        title={exercisePickerMode === 'addTemporary' ? '添加临时动作' : '替换当前动作'}
        visible={Boolean(exercisePickerMode)}
      />
      <WorkoutAdjustmentSheet
        activeExerciseName={activeExercise?.name ?? activeRecord?.exerciseId ?? '当前动作'}
        currentMemberId={currentMemberId}
        members={members}
        onAddExtraSet={() => openMemberAdjustment('extra_set')}
        onClose={() => setAdjustmentSheetVisible(false)}
        onEditParticipants={openParticipantEditor}
        onRemoveSet={() => openMemberAdjustment('remove_set')}
        onReplace={() => {
          setAdjustmentSheetVisible(false);
          void openReplaceSheet();
        }}
        onSkip={() => openMemberAdjustment('skip')}
        onTemporary={() => {
          setAdjustmentSheetVisible(false);
          void openTemporaryExerciseSheet();
        }}
        visible={isAdjustmentSheetVisible}
      />
      <WorkoutMemberAdjustmentSheet
        action={memberAdjustmentAction}
        currentMemberId={currentMemberId}
        members={members}
        onClose={() => setMemberAdjustmentAction(null)}
        onSelect={(memberIds) => {
          if (memberAdjustmentAction) {
            void applyMemberAdjustment(memberAdjustmentAction, memberIds);
          }
        }}
      />
      <ParticipantEditorSheet
        addableMembers={addableMembers}
        currentMembers={members}
        onAdd={(memberId) => void addParticipantMember(memberId)}
        onClose={() => setParticipantSheetVisible(false)}
        onRemove={(memberId) => void removeParticipantMember(memberId)}
        profiles={profiles}
        visible={isParticipantSheetVisible}
      />
      <AppModalSheet
        onClose={() => {
          setCompletedSetDeletionConfirm(null);
          setMemberAdjustmentAction(null);
        }}
        position="center"
        subtitle="这会删除已经保存的训练组，历史分析会同步变化。"
        title="删除已完成组？"
        visible={Boolean(completedSetDeletionConfirm)}
      >
        {completedSetDeletionConfirm ? (
          <AppCard style={styles.confirmPreview} tone="soft">
            <AppText variant="bodySmall" weight="900">
              将删除 {completedSetDeletionConfirm.sets.length} 组已完成记录
            </AppText>
            <AppText tone="muted" variant="caption">
              {completedSetDeletionConfirm.sets
                .map((set) => `${membersById.get(set.memberId)?.displayName ?? '成员'} 第 ${set.setNumber} 组`)
                .join('、')}
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.sheetFooterRow}>
          <AppButton onPress={() => setCompletedSetDeletionConfirm(null)} variant="secondary">
            取消
          </AppButton>
          <AppButton
            onPress={() => {
              if (completedSetDeletionConfirm) {
                void removeLastSetsForMembers(completedSetDeletionConfirm.memberIds, true);
                setMemberAdjustmentAction(null);
              }
            }}
            variant="danger"
          >
            确认删除
          </AppButton>
        </View>
      </AppModalSheet>
      <AppModalSheet
        onClose={() => setParticipantRemovalConfirm(null)}
        position="center"
        subtitle="移除后会删除该成员本次训练数据，但不影响小组成员列表。"
        title="移除已有记录成员？"
        visible={Boolean(participantRemovalConfirm)}
      >
        {participantRemovalConfirm ? (
          <AppCard style={styles.confirmPreview} tone="soft">
            <AppText variant="bodySmall" weight="900">
              {participantRemovalConfirm.member.displayName}
            </AppText>
            <AppText tone="muted" variant="caption">
              已完成 {participantRemovalConfirm.completedCount} 组
            </AppText>
          </AppCard>
        ) : null}
        <View style={styles.sheetFooterRow}>
          <AppButton onPress={() => setParticipantRemovalConfirm(null)} variant="secondary">
            取消
          </AppButton>
          <AppButton
            onPress={() => {
              if (participantRemovalConfirm) {
                void removeParticipantMember(participantRemovalConfirm.member.id, true);
                setParticipantRemovalConfirm(null);
              }
            }}
            variant="danger"
          >
            确认移除
          </AppButton>
        </View>
      </AppModalSheet>
      <AuthGateSheets {...sheets} />
    </SafeAreaView>
  );
}

function MemberExerciseCompleteCard({
  hasNextExercise,
  hasPendingForOtherMember,
  memberName,
  nextMemberName,
  onAddSet,
  onFinish,
  onNextExercise,
  onSwitchNextMember,
}: {
  hasNextExercise: boolean;
  hasPendingForOtherMember: boolean;
  memberName: string;
  nextMemberName?: string;
  onAddSet: () => void;
  onFinish: () => void;
  onNextExercise: () => void;
  onSwitchNextMember: () => void;
}) {
  return (
    <View style={styles.memberDoneCard}>
      <View style={styles.memberDoneIcon}>
        <Ionicons color={colors.success} name="checkmark-circle-outline" size={22} />
      </View>
      <View style={styles.memberDoneText}>
        <AppText variant="bodySmall" weight="900">
          {memberName} 当前动作已完成
        </AppText>
        <AppText tone="muted" variant="caption">
          可以给他加做一组，或继续记录下一位成员。
        </AppText>
      </View>
      <View style={styles.memberDoneActions}>
        <Pressable accessibilityRole="button" onPress={onAddSet} style={styles.memberDoneSecondary}>
          <Ionicons color={colors.primary} name="add-circle-outline" size={16} />
          <AppText tone="brand" variant="caption" weight="900">
            加一组
          </AppText>
        </Pressable>
        {hasPendingForOtherMember ? (
          <Pressable accessibilityRole="button" onPress={onSwitchNextMember} style={styles.memberDonePrimary}>
            <AppText tone="inverse" variant="caption" weight="900">
              记录 {nextMemberName ?? '下一位'}
            </AppText>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={hasNextExercise ? onNextExercise : onFinish}
            style={styles.memberDonePrimary}
          >
            <AppText tone="inverse" variant="caption" weight="900">
              {hasNextExercise ? '下个动作' : '结束训练'}
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function WorkoutAdjustmentSheet({
  activeExerciseName,
  currentMemberId,
  members,
  onAddExtraSet,
  onClose,
  onEditParticipants,
  onRemoveSet,
  onReplace,
  onSkip,
  onTemporary,
  visible,
}: {
  activeExerciseName: string;
  currentMemberId: string;
  members: GroupMember[];
  onAddExtraSet: () => void;
  onClose: () => void;
  onEditParticipants: () => void;
  onRemoveSet: () => void;
  onReplace: () => void;
  onSkip: () => void;
  onTemporary: () => void;
  visible: boolean;
}) {
  const memberName = members.find((member) => member.id === currentMemberId)?.displayName ?? '当前成员';

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle={`只影响本次训练，不修改原计划 · ${activeExerciseName}`}
      title="本次调整"
      visible={visible}
    >
      <View style={styles.adjustmentActionList}>
        <AdjustmentActionRow
          icon="add-circle-outline"
          label="多做一组"
          meta={`先选成员；当前成员是 ${memberName}`}
          onPress={onAddExtraSet}
        />
        <AdjustmentActionRow
          danger
          icon="remove-circle-outline"
          label="少做一组"
          meta="优先删除未完成的最后一组"
          onPress={onRemoveSet}
        />
        <AdjustmentActionRow
          icon="swap-horizontal-outline"
          label="替换当前动作"
          meta="进入动作选择，只影响本次训练"
          onPress={onReplace}
        />
        <AdjustmentActionRow
          danger
          icon="play-skip-forward-outline"
          label="本次跳过动作"
          meta="选择成员后需要确认"
          onPress={onSkip}
        />
        <AdjustmentActionRow
          icon="add-outline"
          label="添加临时动作"
          meta="加入本次训练快照，不写回计划"
          onPress={onTemporary}
        />
        <AdjustmentActionRow
          icon="people-outline"
          label="编辑参与成员"
          meta={`${members.length} 位成员参与本次训练`}
          onPress={onEditParticipants}
        />
      </View>

      <View style={styles.adjustmentResponsibilityCard}>
        <Ionicons color={colors.primary} name="information-circle-outline" size={18} />
        <AppText tone="muted" variant="caption" style={styles.adjustmentResponsibilityText}>
          多做/少做一组只调整当前动作的训练组；编辑参与成员只决定谁参加本次训练。
        </AppText>
      </View>
    </AppModalSheet>
  );
}

function AdjustmentActionRow({
  danger = false,
  icon,
  label,
  meta,
  onPress,
}: {
  danger?: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.adjustmentActionRow,
        danger && styles.adjustmentActionRowDanger,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.adjustmentActionIcon, danger && styles.adjustmentActionIconDanger]}>
        <Ionicons color={danger ? colors.danger : colors.primary} name={icon} size={19} />
      </View>
      <View style={styles.adjustmentActionText}>
        <AppText variant="bodySmall" weight="900">
          {label}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {meta}
        </AppText>
      </View>
      <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function WorkoutMemberAdjustmentSheet({
  action,
  currentMemberId,
  members,
  onClose,
  onSelect,
}: {
  action: WorkoutMemberAdjustmentAction | null;
  currentMemberId: string;
  members: GroupMember[];
  onClose: () => void;
  onSelect: (memberIds: string[]) => void;
}) {
  const currentMember = members.find((member) => member.id === currentMemberId) ?? members[0] ?? null;
  const otherMembers = members.filter((member) => member.id !== currentMember?.id);
  const copy = action ? getMemberAdjustmentCopy(action) : null;
  const visible = Boolean(action);

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle={copy?.subtitle}
      title={copy?.title ?? '选择成员'}
      visible={visible}
    >
      <View style={styles.memberActionList}>
        {currentMember ? (
          <MemberActionOption
            icon="person-outline"
            label="当前成员"
            member={currentMember}
            meta={currentMember.displayName}
            onPress={() => onSelect([currentMember.id])}
          />
        ) : null}
        {members.length > 1 ? (
          <MemberActionOption
            icon="people-outline"
            label="全部成员"
            meta={`${members.length} 位成员各执行一次`}
            onPress={() => onSelect(members.map((member) => member.id))}
          />
        ) : null}
        {action !== 'skip'
          ? otherMembers.map((member) => (
              <MemberActionOption
                key={member.id}
                label={member.displayName}
                member={member}
                meta="只调整这位成员"
                onPress={() => onSelect([member.id])}
              />
            ))
          : null}
      </View>
    </AppModalSheet>
  );
}

function getMemberAdjustmentCopy(action: WorkoutMemberAdjustmentAction) {
  if (action === 'extra_set') {
    return {
      subtitle: '选择后立即增加当前动作下一组',
      title: '多做一组',
    };
  }
  if (action === 'remove_set') {
    return {
      subtitle: '优先删除未完成组；删除已完成组会二次确认',
      title: '少做一组',
    };
  }
  return {
    subtitle: '只跳过本次训练中的当前动作',
    title: '本次跳过动作',
  };
}

function MemberActionOption({
  icon,
  label,
  member,
  meta,
  onPress,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  member?: GroupMember;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.memberActionOption, pressed && styles.pressed]}>
      {member ? (
        <Avatar avatarUrl={member.avatarUrl} name={member.displayName} size={40} />
      ) : (
        <View style={styles.memberActionIcon}>
          <Ionicons color={colors.primary} name={icon ?? 'people-outline'} size={18} />
        </View>
      )}
      <View style={styles.memberActionText}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {label}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="caption">
          {meta}
        </AppText>
      </View>
      <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
    </Pressable>
  );
}

function ParticipantEditorSheet({
  addableMembers,
  currentMembers,
  onAdd,
  onClose,
  onRemove,
  profiles,
  visible,
}: {
  addableMembers: GroupMember[];
  currentMembers: GroupMember[];
  onAdd: (memberId: string) => void;
  onClose: () => void;
  onRemove: (memberId: string) => void;
  profiles: Record<string, MemberProfile | null>;
  visible: boolean;
}) {
  return (
    <AppModalSheet
      onClose={onClose}
      subtitle="只影响本次训练参与者，不修改小组成员列表。"
      title="编辑本次参与成员"
      visible={visible}
    >
      <View style={styles.sheetSection}>
        <AppText tone="muted" variant="caption" weight="900">
          本次参与
        </AppText>
        <View style={styles.participantList}>
          {currentMembers.map((member) => (
            <ParticipantRow
              actionLabel={currentMembers.length <= 1 ? '至少保留 1 人' : '移除'}
              disabled={currentMembers.length <= 1}
              key={member.id}
              member={member}
              onPress={() => onRemove(member.id)}
              profile={profiles[member.id]}
              tone="danger"
            />
          ))}
        </View>
      </View>

      <View style={styles.sheetSection}>
        <AppText tone="muted" variant="caption" weight="900">
          可加入成员
        </AppText>
        {addableMembers.length === 0 ? (
          <AppCard style={styles.confirmPreview} tone="soft">
            <AppText tone="muted" variant="caption">
              小组成员都已在本次训练中。
            </AppText>
          </AppCard>
        ) : (
          <View style={styles.participantList}>
            {addableMembers.map((member) => (
              <ParticipantRow
                actionLabel="加入"
                key={member.id}
                member={member}
                onPress={() => onAdd(member.id)}
                profile={profiles[member.id]}
                tone="brand"
              />
            ))}
          </View>
        )}
      </View>
    </AppModalSheet>
  );
}

function ParticipantRow({
  actionLabel,
  disabled = false,
  member,
  onPress,
  profile,
  tone,
}: {
  actionLabel: string;
  disabled?: boolean;
  member: GroupMember;
  onPress: () => void;
  profile?: MemberProfile | null;
  tone: 'brand' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[styles.participantRow, disabled && styles.participantRowDisabled]}
    >
      <Avatar
        avatarLocalUri={profile?.avatarLocalUri}
        avatarThumbUrl={profile?.avatarThumbUrl}
        avatarUrl={profile?.avatarUrl ?? member.avatarUrl}
        name={member.displayName}
        size={38}
      />
      <View style={styles.participantText}>
        <AppText variant="bodySmall" weight="900">
          {member.displayName}
        </AppText>
        <AppText tone="muted" variant="caption">
          {tone === 'brand' ? '加入后会生成本次训练组' : '移除只影响本次 session'}
        </AppText>
      </View>
      <AppText tone={tone === 'danger' ? 'danger' : 'brand'} variant="caption" weight="900">
        {actionLabel}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  adjustmentResponsibilityCard: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  adjustmentResponsibilityText: {
    flex: 1,
  },
  adjustmentActionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  adjustmentActionIconDanger: {
    backgroundColor: colors.dangerSoft,
  },
  adjustmentActionList: {
    gap: spacing.sm,
  },
  adjustmentActionRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 70,
    padding: spacing.md,
  },
  adjustmentActionRowDanger: {
    borderColor: colors.dangerSoft,
  },
  adjustmentActionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  confirmPreview: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  memberActionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  memberActionList: {
    gap: spacing.sm,
  },
  memberActionOption: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 66,
    padding: spacing.md,
  },
  memberActionText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  participantList: {
    gap: spacing.sm,
  },
  participantRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 62,
    padding: spacing.md,
  },
  participantRowDisabled: {
    opacity: 0.62,
  },
  participantText: {
    flex: 1,
    gap: 2,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.99 }],
  },
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  sheetFooterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  sheetSection: {
    gap: spacing.sm,
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
  adjustmentHint: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  memberDoneActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  memberDoneCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.md,
  },
  memberDoneIcon: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderRadius: radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  memberDonePrimary: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    flex: 1,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  memberDoneSecondary: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  memberDoneText: {
    gap: spacing.xs,
  },
  restNotice: {
    alignItems: 'center',
    backgroundColor: colors.successSoft,
    borderColor: colors.success,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  restNoticeText: {
    color: colors.textStrong,
    flex: 1,
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
