import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
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
import { getRequiredCurrentUserId } from '@/data/local/accountScope';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { ProgressionSuggestion } from '@/domain/progression/progression.types';
import { calculateRecoveryAdjustedWeight } from '@/domain/recovery/recovery-workout.service';
import { DEFAULT_BARBELL_INCREMENT, DEFAULT_DUMBBELL_INCREMENT } from '@/domain/weight/weight-calculator';
import {
  WORKOUT_EXTRA_SET_NOTE,
  WORKOUT_REPLACEMENT_NOTE,
  WORKOUT_SKIPPED_EXERCISE_NOTE,
  WORKOUT_TEMPORARY_EXERCISE_NOTE,
  checkShortWorkout,
  getWorkoutCursorFromQueue,
  getWorkoutCompletionState,
  getWorkoutExerciseProgressStatus,
  getNextWorkoutSetForRotation,
  getWorkoutExerciseSetProgress,
  getWorkoutRecordInitialReps,
  resolveWorkoutSetCompletionInput,
  summarizeWorkoutAdjustments,
} from '@/domain/workout/workout.service';
import type {
  AddWorkoutSetInput,
  SaveWorkoutSetInput,
  WorkoutSessionDetail,
  WorkoutSet,
} from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { useUserPreferences } from '@/hooks/useUserPreferences';
import { finishWorkoutSession } from '@/features/workout-session/application/finishWorkoutSession.usecase';
import { saveWorkoutSet } from '@/features/workout-session/application/saveWorkoutSet.usecase';
import type { WorkoutExecutionPhase, WorkoutLifecycle } from '@/features/workout-session/model/workoutSession.state';
import { schedulePostWorkoutTasks } from '@/features/workout-session/services/postWorkoutTaskScheduler.service';
import { WorkoutWriteCoordinator } from '@/features/workout-session/services/workoutWriteCoordinator.service';
import { parseIncrementKg } from '@/domain/preferences/user-preferences.types';
import { syncGroupMembersAvatar } from '@/services/memberSyncService';
import { enqueueSyncCandidatesBatch } from '@/sync/syncQueue';
import { scheduleSyncDebounced } from '@/sync/syncOrchestrator';
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

type WorkoutAdjustmentOperation = 'extra_set' | 'remove_set' | 'skip' | 'replace' | 'temporary';
type WorkoutAdjustmentScope = 'current' | 'selected' | 'all';

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
  const { recoveryReductionPercent, sessionId } = useLocalSearchParams<{
    recoveryReductionPercent?: string;
    sessionId: string;
  }>();
  const parsedRecoveryReduction = Number(recoveryReductionPercent);
  const activeRecoveryReduction =
    Number.isFinite(parsedRecoveryReduction) && parsedRecoveryReduction > 0
      ? parsedRecoveryReduction
      : null;
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const { preferences } = useUserPreferences();
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
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [localSaveState, setLocalSaveState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [executionPhase, setExecutionPhase] = useState<WorkoutExecutionPhase>('loading');
  const [activeProgressionSuggestion, setActiveProgressionSuggestion] = useState<ProgressionSuggestion | null>(null);
  const [exercisePickerMode, setExercisePickerMode] = useState<'addTemporary' | 'replace' | null>(null);
  const [isAdjustmentSheetVisible, setAdjustmentSheetVisible] = useState(false);
  const [adjustmentOperation, setAdjustmentOperation] = useState<WorkoutAdjustmentOperation>('extra_set');
  const [adjustmentScope, setAdjustmentScope] = useState<WorkoutAdjustmentScope>('current');
  const [selectedAdjustmentMemberIds, setSelectedAdjustmentMemberIds] = useState<string[]>([]);
  const [isParticipantSheetVisible, setParticipantSheetVisible] = useState(false);
  const [completedSetDeletionConfirm, setCompletedSetDeletionConfirm] =
    useState<CompletedSetDeletionConfirm>(null);
  const [participantRemovalConfirm, setParticipantRemovalConfirm] =
    useState<ParticipantRemovalConfirm>(null);
  const [error, setError] = useState<string | null>(null);
  const latestSetByIdRef = useRef<Record<string, WorkoutSet>>({});
  const setSaveTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const exercisePickerCacheRef = useRef<Exercise[] | null>(null);
  const lifecycleRef = useRef<WorkoutLifecycle>('active');
  const mountedRef = useRef(true);
  const finishingRef = useRef(false);
  const completingSetRef = useRef(false);
  const adjustmentOperationRef = useRef(false);
  const activeExerciseIndexRef = useRef(0);
  const activeMemberIdRef = useRef<string | null>(null);
  const writeCoordinator = useMemo(
    () => new WorkoutWriteCoordinator(async (patches) => {
      if (!sessionId) throw new Error('Missing workout session id.');
      return repositories.workoutRepository.saveSetPatchesBatch({ patches, sessionId });
    }),
    [repositories, sessionId],
  );
  const isLoading = executionPhase === 'loading';
  const isFinishing = executionPhase === 'closing';
  const isCompletingSet = executionPhase === 'saving_set';
  const isApplyingAdjustment = executionPhase === 'adjusting';
  const setWorkoutReadyToFinish = useCallback((_ready: boolean) => undefined, []);
  const setIsCompletingSet = useCallback((value: boolean) => {
    completingSetRef.current = value;
    if (mountedRef.current) setExecutionPhase(value ? 'saving_set' : 'active');
  }, []);
  const setIsApplyingAdjustment = useCallback((value: boolean) => {
    adjustmentOperationRef.current = value;
    if (mountedRef.current) setExecutionPhase(value ? 'adjusting' : 'active');
  }, []);

  useEffect(() => {
    activeExerciseIndexRef.current = activeExerciseIndex;
    activeMemberIdRef.current = activeMemberId;
  }, [activeExerciseIndex, activeMemberId]);

  useEffect(() => {
    latestSetByIdRef.current = Object.fromEntries((detail?.sets ?? []).map((set) => [set.id, set]));
  }, [detail?.sets]);

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
    setExecutionPhase('loading');
    setError(null);
    try {
      if (authMode === 'guest_preview') {
        setDetail(null);
        return;
      }

      await initializeLocalDatabase();

      const nextDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      if (nextDetail.session.groupId) {
        void syncGroupMembersAvatar(nextDetail.session.groupId).catch(() => undefined);
      }
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
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '训练记录加载失败。');
    } finally {
      if (mountedRef.current) setExecutionPhase('active');
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
        ...(latestSetByIdRef.current[set.id] ?? set),
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      latestSetByIdRef.current[set.id] = optimisticSet;
      setDetail((current) => replaceSet(current, optimisticSet));
      setLocalSaveState('saving');
      setError(null);
      try {
        writeCoordinator.schedulePatch(set.id, patch);
        const startedAt = Date.now();
        const diagnostics = writeCoordinator.getDiagnostics();
        const saved = await saveWorkoutSet(writeCoordinator, set.id);
        if (!saved) return null;
        latestSetByIdRef.current[saved.id] = saved;
        setDetail((current) => replaceSet(current, saved));
        setLastSavedAt(new Date().toISOString());
        setLocalSaveState('saved');
        if (lifecycleRef.current === 'active') setExecutionPhase('active');
        if (__DEV__) {
          console.log('[workout-set-performance]', {
            localSaveMs: Date.now() - startedAt,
            queuedRevisionCount: diagnostics.queuedRevisionCount,
            setId: set.id,
            syncQueueScheduleMs: 0,
            totalMs: Date.now() - startedAt,
          });
        }
        return saved;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '本组保存失败。');
        setExecutionPhase('save_failed');
        setLocalSaveState('failed');
        return null;
      }
    },
    [guardFeature, writeCoordinator],
  );

  const cancelDebounceTimers = useCallback(() => {
    Object.values(setSaveTimersRef.current).forEach((timer) => clearTimeout(timer));
    setSaveTimersRef.current = {};
  }, []);

  const consumePendingSetPatch = useCallback((setId: string): Omit<SaveWorkoutSetInput, 'id'> | null => {
    const pendingTimer = setSaveTimersRef.current[setId];
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      delete setSaveTimersRef.current[setId];
    }
    return null;
  }, []);

  const flushDebouncedSetWrites = useCallback(async () => {
    cancelDebounceTimers();
    const savedSets = await writeCoordinator.flushSession();
    if (savedSets.length > 0 && mountedRef.current) {
      const savedById = new Map(savedSets.map((set) => [set.id, set]));
      savedSets.forEach((set) => { latestSetByIdRef.current[set.id] = set; });
      setDetail((current) => current
        ? { ...current, sets: current.sets.map((set) => savedById.get(set.id) ?? set) }
        : current);
      setLastSavedAt(new Date().toISOString());
      setLocalSaveState('saved');
    }
  }, [cancelDebounceTimers, writeCoordinator]);

  useEffect(() => {
    mountedRef.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && lifecycleRef.current === 'active' && !finishingRef.current) {
        void flushDebouncedSetWrites().catch(() => undefined);
      }
    });
    return () => {
      mountedRef.current = false;
      lifecycleRef.current = 'unmounted';
      cancelDebounceTimers();
      subscription.remove();
    };
  }, [cancelDebounceTimers, flushDebouncedSetWrites]);

  const saveSetPatchDebounced = useCallback(
    (set: WorkoutSet, patch: Omit<SaveWorkoutSetInput, 'id'>) => {
      const currentSet = latestSetByIdRef.current[set.id] ?? set;
      writeCoordinator.schedulePatch(set.id, patch);

      const optimisticSet: WorkoutSet = {
        ...currentSet,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      latestSetByIdRef.current[set.id] = optimisticSet;
      setDetail((current) => replaceSet(current, optimisticSet));
      setLocalSaveState('saving');

      const existingTimer = setSaveTimersRef.current[set.id];
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      setSaveTimersRef.current[set.id] = setTimeout(() => {
        delete setSaveTimersRef.current[set.id];
        const latestSet = latestSetByIdRef.current[set.id] ?? optimisticSet;
        void saveWorkoutSet(writeCoordinator, latestSet.id)
          .then((saved) => {
            if (!saved || !mountedRef.current) return;
            latestSetByIdRef.current[saved.id] = saved;
            setDetail((current) => replaceSet(current, saved));
            setLastSavedAt(new Date().toISOString());
            setLocalSaveState('saved');
          })
          .catch((saveError: unknown) => {
            if (!mountedRef.current) return;
            setExecutionPhase('save_failed');
            setLocalSaveState('failed');
            setError(saveError instanceof Error ? saveError.message : '本组保存失败，请重试。');
          });
      }, 450);
    },
    [writeCoordinator],
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

      timersToPersist.forEach(({ state, memberId }) => {
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
    if (finishingRef.current) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
    }

      finishingRef.current = true;
      lifecycleRef.current = 'finishing';
      setExecutionPhase('closing');
      setError(null);
      try {
        const performance = await finishWorkoutSession({
          cancelDebounceTimers,
          coordinator: writeCoordinator,
          repository: repositories.workoutRepository,
          sessionId,
        });
        const routeStartedAt = Date.now();
        lifecycleRef.current = 'finished';
        router.replace({ pathname: '/workout/summary/[sessionId]', params: { sessionId } });
        // 报告、进阶建议和同步属于后置任务，绝不阻塞用户进入总结页。
        if (__DEV__) {
          console.log('[workout-finish-performance]', {
            autosaveDrainMs: performance.autosaveDrainMs,
            completedSetCount: detail?.sets.filter((set) => set.completed).length ?? 0,
            exerciseCount: detail?.exercises.length ?? 0,
            finishTransactionMs: performance.finishTransactionMs,
            flushDebounceMs: 0,
            participantCount: members.length,
            pendingPatchCount: performance.pendingPatchCount,
            pendingWriteKeyCount: performance.pendingWriteKeyCount,
            queuedSyncCandidateCount: 0,
            routeMs: Date.now() - routeStartedAt,
            sessionId,
            setCount: detail?.sets.length ?? 0,
            totalCriticalMs: performance.totalCriticalMs,
          });
        }
        schedulePostWorkoutTasks(sessionId);
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : '完成训练失败。');
      finishingRef.current = false;
      lifecycleRef.current = 'active';
      writeCoordinator.resume();
      if (mountedRef.current) setExecutionPhase('save_failed');
    }
  }, [cancelDebounceTimers, detail, guardFeature, members.length, repositories, sessionId, writeCoordinator]);

  const finishWorkout = useCallback(async () => {
    if (!sessionId) {
      return;
    }
    if (finishingRef.current) {
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
  }, [confirmDiscardWorkout, detail, elapsedSeconds, guardFeature, saveCompletedWorkout, sessionId]);

  const activeRecord = detail?.exercises[activeExerciseIndex] ?? null;
  const activeRecordId = activeRecord?.id;
  const activeExercise = activeRecord ? exerciseMap[activeRecord.exerciseId] ?? null : null;
  const activeSets = useMemo(
    () => activeRecordId ? detail?.sets.filter((set) => set.exerciseRecordId === activeRecordId) ?? [] : [],
    [activeRecordId, detail?.sets],
  );
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
      status: getWorkoutExerciseProgressStatus(detail.sets, record.id, index === activeExerciseIndex),
    }));
  }, [detail, exerciseMap, activeExerciseIndex]);
  const workoutCompletionState = useMemo(
    () => getWorkoutCompletionState(detail?.sets ?? []),
    [detail?.sets],
  );
  const localSaveStatus = localSaveState === 'failed'
    ? '保存失败'
    : localSaveState === 'saving' || executionPhase === 'closing'
      ? '正在保存到本机'
      : localSaveState === 'saved' || lastSavedAt
        ? '已保存到本机'
        : '等待记录';
  const nextIncompleteExerciseIndex = useMemo(() => {
    if (!detail) return -1;
    return detail.exercises.findIndex((record, index) =>
      index !== activeExerciseIndex &&
      detail.sets.some((set) => set.exerciseRecordId === record.id && !set.completed && !set.skipped));
  }, [activeExerciseIndex, detail]);

  const currentProfile = currentMemberId ? profiles[currentMemberId] ?? null : null;
  // 用户偏好的重量步进优先于 member profile 的默认值
  const currentIncrement = useMemo(() => {
    const profileIncrement = getWeightIncrement(currentProfile, activeExercise);
    // 仅当用户偏好与 profile 默认值不一致时使用偏好值
    const prefIncrement = parseIncrementKg(preferences.weightIncrement);
    return prefIncrement || profileIncrement;
  }, [currentProfile, activeExercise, preferences.weightIncrement]);

  const progressionWeightAfterRecovery =
    activeRecoveryReduction === null || activeProgressionSuggestion?.suggestedWeight === undefined
      ? (activeProgressionSuggestion?.suggestedWeight ?? null)
      : calculateRecoveryAdjustedWeight(
          activeProgressionSuggestion.suggestedWeight,
          activeRecoveryReduction,
          currentIncrement,
        );

  useEffect(() => {
    let cancelled = false;
    const exerciseId = activeRecord?.exerciseId;
    const status = detail?.session.status;
    const startedAt = detail?.session.startedAt;
    const currentSessionId = detail?.session.id;
    void Promise.resolve()
      .then(() => exerciseId && currentMemberId && status === 'in_progress'
        ? repositories.progressionRepository.getLatestSuggestion(currentMemberId, exerciseId)
        : null)
      .then((suggestion) => {
        const isEarlierThanSession = !suggestion || !startedAt || suggestion.createdAt < startedAt;
        if (!cancelled) {
          setActiveProgressionSuggestion(
            suggestion && suggestion.sessionId !== currentSessionId && isEarlierThanSession && (suggestion.suggestedWeight ?? -1) >= 0
              ? suggestion
              : null,
          );
        }
      })
      .catch(() => {
        if (!cancelled) setActiveProgressionSuggestion(null);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRecord?.exerciseId, currentMemberId, detail?.session.id, detail?.session.startedAt, detail?.session.status, repositories]);

  const applyActiveProgressionSuggestion = useCallback(async () => {
    if (!activeProgressionSuggestion || !activeRecord || !detail || activeProgressionSuggestion.suggestedWeight === undefined) return;
    const pendingSets = activeSets.filter((set) => set.memberId === currentMemberId && !set.completed && !set.skipped);
    if (pendingSets.length === 0) return;
    const nextWeight = progressionWeightAfterRecovery;
    if (nextWeight === null) return;
    const apply = async () => {
      for (const set of pendingSets) {
        const actualWeightWasPrefilled = set.actualWeight === set.plannedWeight;
        writeCoordinator.schedulePatch(set.id, {
          ...(actualWeightWasPrefilled ? { actualWeight: nextWeight } : {}),
          plannedWeight: nextWeight,
        });
      }
      await flushDebouncedSetWrites();
      setActiveProgressionSuggestion(null);
    };
    const hasManualWeight = pendingSets.some(
      (set) => set.actualWeight !== undefined && set.actualWeight !== set.plannedWeight,
    );
    if (hasManualWeight) {
      Alert.alert('替换未完成组计划重量？', '你已手动调整重量。应用建议只会更新当前成员未完成组的计划重量，不会修改已完成组或训练计划。', [
        { text: '取消', style: 'cancel' },
        { text: '应用建议', onPress: () => void apply() },
      ]);
      return;
    }
    await apply();
  }, [
    activeProgressionSuggestion,
    activeRecord,
    activeSets,
    currentMemberId,
    detail,
    progressionWeightAfterRecovery,
    flushDebouncedSetWrites,
    writeCoordinator,
  ]);
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

  function resolveAdjustmentMemberIds(scope = adjustmentScope): string[] {
    if (scope === 'all') {
      return memberOrder;
    }
    if (scope === 'selected') {
      return selectedAdjustmentMemberIds.filter((memberId) => memberOrder.includes(memberId));
    }
    return currentMemberId ? [currentMemberId] : [];
  }

  function toggleAdjustmentMember(memberId: string) {
    setSelectedAdjustmentMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId],
    );
  }

  function openAdjustmentSheet(operation: WorkoutAdjustmentOperation = 'extra_set') {
    setAdjustmentOperation(operation);
    setAdjustmentScope('current');
    setSelectedAdjustmentMemberIds(currentMemberId ? [currentMemberId] : []);
    setAdjustmentSheetVisible(true);
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
    if (completingSetRef.current) return;
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

    setIsCompletingSet(true);
    const targetSessionId = targetSet.sessionId;
    const targetSetId = targetSet.id;
    const targetExerciseRecordId = targetSet.exerciseRecordId;
    const targetMemberId = targetSet.memberId;
    const targetExerciseIndex = activeExerciseIndex;
    const pendingPatch = consumePendingSetPatch(targetSet.id);
    const targetDraft = pendingPatch ? { ...targetSet, ...pendingPatch } : targetSet;
    const previousCompletedWeight = [...activeSets]
      .filter(
        (set) =>
          set.memberId === targetDraft.memberId &&
          set.completed &&
          set.setNumber < targetDraft.setNumber &&
          set.actualWeight !== undefined &&
          Number.isFinite(set.actualWeight),
      )
      .sort((left, right) => right.setNumber - left.setNumber)[0]?.actualWeight;
    const isBodyweightExercise = activeExercise?.isBodyweight === true || activeExercise?.equipment === 'bodyweight';
    const { actualReps, actualWeight } = resolveWorkoutSetCompletionInput({
      fallbackReps: activeRecord ? getWorkoutRecordInitialReps(activeRecord) : undefined,
      isBodyweightExercise,
      previousCompletedWeight,
      set: targetDraft,
    });

    if (actualWeight === undefined || !Number.isFinite(actualWeight)) {
      Alert.alert('请先填写重量', '当前组没有可用的建议重量，请填写实际重量后再保存。');
      setIsCompletingSet(false);
      return;
    }
    if (actualReps === undefined || !Number.isInteger(actualReps) || actualReps <= 0) {
      Alert.alert('请先填写次数', '当前组次数必须是非负整数。');
      setIsCompletingSet(false);
      return;
    }
    if (!(await confirmExceptionalSetInput(actualWeight, actualReps))) {
      setIsCompletingSet(false);
      return;
    }

    let savedSet: WorkoutSet | null = null;
    try {
      savedSet = await saveSetPatch(targetSet, {
        ...(pendingPatch ?? {}),
        actualReps,
        actualWeight,
        completed: true,
        skipped: false,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '本组数据保存失败。');
      setIsCompletingSet(false);
      return;
    }
    if (!savedSet) {
      Alert.alert('保存失败', '本组数据未保存，请重试。');
      setIsCompletingSet(false);
      return;
    }

    if (
      savedSet.id !== targetSetId ||
      savedSet.sessionId !== targetSessionId ||
      savedSet.exerciseRecordId !== targetExerciseRecordId ||
      savedSet.memberId !== targetMemberId
    ) {
      setError('训练组状态已变化，请刷新后重试。');
      setIsCompletingSet(false);
      return;
    }

    const nextActiveSets = activeSets.map((set) => (set.id === savedSet.id ? savedSet : set));
    const nextPendingSet = activeRecord
      ? getNextWorkoutSetForRotation(nextActiveSets, memberOrder, activeRecord.id)
      : null;
    const restSeconds = activeRecord?.plannedRestSeconds ?? 0;
    // 仅当用户偏好启用了休息计时才自动启动
    if (restSeconds > 0 && preferences.restTimerEnabled) {
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

    const cursorStillTargetsCapturedSet =
      activeExerciseIndexRef.current === targetExerciseIndex &&
      activeMemberIdRef.current === targetMemberId;
    if (!cursorStillTargetsCapturedSet) {
      setIsCompletingSet(false);
      return;
    }

    if (nextPendingSet) {
      setActiveMemberId(nextPendingSet.memberId);
      setWorkoutReadyToFinish(false);
      setIsCompletingSet(false);
      return;
    }

    if (hasNextExercise) {
      goNextExercise();
      setIsCompletingSet(false);
      return;
    }
    setWorkoutReadyToFinish(true);
    setIsCompletingSet(false);
  }

  function handleDeleteSet(setId: string) {
    writeCoordinator.discardSet(setId);
    setDetail((current) => removeSet(current, setId));
    void repositories.workoutRepository.deleteSetsBatch({
      sessionId: detail?.session.id ?? sessionId,
      setIds: [setId],
    }).catch((deleteError) => {
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

  async function saveAndExitWorkout() {
    if (finishingRef.current || completingSetRef.current || adjustmentOperationRef.current) return;
    finishingRef.current = true;
    lifecycleRef.current = 'leaving';
    setExecutionPhase('closing');
    try {
      await flushDebouncedSetWrites();
      router.replace('/(tabs)/today');
      scheduleSyncDebounced();
    } catch (saveError) {
      finishingRef.current = false;
      lifecycleRef.current = 'active';
      setExecutionPhase('save_failed');
      setError(saveError instanceof Error ? saveError.message : '保存并退出失败，请重试。');
    }
  }

  function handleBack() {
    Alert.alert('退出训练？', '请选择保留进度稍后继续，或正式结束本次训练。', [
      { text: '继续训练', style: 'cancel' },
      { text: '保存并退出', onPress: () => void saveAndExitWorkout() },
      { text: '结束训练', style: 'destructive', onPress: () => void finishWorkout() },
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
      const addedSets = await repositories.workoutRepository.addSetsToExerciseRecordsBatch({
        sessionId: detail.session.id,
        sets: uniqueTargetMemberIds.map((memberId) => {
          const defaults = getExtraSetDefaults(memberId);
          return {
            completed: false,
            exerciseRecordId: activeRecord.id,
            memberId,
            notes: WORKOUT_EXTRA_SET_NOTE,
            reps: defaults.reps,
            sessionId: detail.session.id,
            weight: defaults.weight,
          };
        }),
      });

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

    } catch (addError) {
      setError(addError instanceof Error ? addError.message : '添加加做组失败。');
      throw addError;
    }
  }

  async function removeLastSetsForMembers(targetMemberIds: string[], allowCompletedDeletion = false) {
    if (!activeRecord || !detail) {
      return;
    }
    if (!guardFeature('save_workout')) {
      return;
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
      return;
    }

    const touchesCompletedRecord = targetSets.some((set) => set.completed);
    if (touchesCompletedRecord && !allowCompletedDeletion) {
      setCompletedSetDeletionConfirm({ memberIds: uniqueTargetMemberIds, sets: targetSets });
      setAdjustmentSheetVisible(false);
      return;
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
    targetSets.forEach((set) => writeCoordinator.discardSet(set.id));

    try {
      await repositories.workoutRepository.deleteSetsBatch({
        sessionId: detail.session.id,
        setIds: targetSets.map((set) => set.id),
      });
      setCompletedSetDeletionConfirm(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除训练组失败。');
      void loadWorkout();
      throw deleteError;
    }
  }

  function confirmAddExtraSet() {
    if (!activeRecord || !detail) {
      return;
    }
    openAdjustmentSheet('extra_set');
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
      const setsToAdd: AddWorkoutSetInput[] = [];
      for (const record of detail.exercises) {
        const plannedSetCount = Math.max(
          1,
          record.plannedSets ?? 0,
          ...detail.sets
            .filter((set) => set.exerciseRecordId === record.id)
            .map((set) => set.setNumber),
        );
        for (let index = 0; index < plannedSetCount; index += 1) {
          setsToAdd.push({
            completed: false,
            exerciseRecordId: record.id,
            memberId,
            reps: getWorkoutRecordInitialReps(record),
            sessionId: detail.session.id,
          });
        }
      }
      const addedSets = await repositories.workoutRepository.addSetsToExerciseRecordsBatch({
        sessionId: detail.session.id,
        sets: setsToAdd,
      });

      const addedMember = allGroupMembers.find((member) => member.id === memberId);
      if (addedMember) {
        const profile = await repositories.memberRepository.getMemberProfile(memberId).catch(() => null);
        setMembers((current) => current.some((member) => member.id === memberId) ? current : [...current, addedMember]);
        setProfiles((current) => ({ ...current, [memberId]: profile }));
      }
      setDetail((current) =>
        current
          ? {
              ...current,
              sets: [...current.sets, ...addedSets],
            }
          : current,
      );
      setActiveMemberId(memberId);
      setWorkoutReadyToFinish(false);
      setLastSavedAt(new Date().toISOString());
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
      memberSets.forEach((set) => writeCoordinator.discardSet(set.id));
      await repositories.workoutRepository.deleteMemberSetsInSession(detail.session.id, memberId);
      const nextMemberId = members.find((member) => member.id !== memberId)?.id ?? null;
      setDetail((current) =>
        current
          ? {
              ...current,
              sets: current.sets.filter((set) => set.memberId !== memberId),
            }
          : current,
      );
      setMembers((current) => current.filter((member) => member.id !== memberId));
      setProfiles((current) => {
        const next = { ...current };
        delete next[memberId];
        return next;
      });
      setActiveMemberId(nextMemberId);
      setWorkoutReadyToFinish(false);
      setLastSavedAt(new Date().toISOString());
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
    openAdjustmentSheet('extra_set');
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
      targetSets.forEach((set) => {
        writeCoordinator.schedulePatch(set.id, {
          completed: false,
          notes: set.notes ? `${set.notes}；${WORKOUT_SKIPPED_EXERCISE_NOTE}` : WORKOUT_SKIPPED_EXERCISE_NOTE,
          skipped: true,
        });
      });
      await flushDebouncedSetWrites();
      await refreshDetailCursor();
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : '本次跳过动作失败。');
      throw skipError;
    }
  }

  async function applyWorkoutAdjustment() {
    if (!activeRecord || !detail || adjustmentOperationRef.current) {
      return;
    }

    const targetMemberIds = resolveAdjustmentMemberIds();
    if (
      ['extra_set', 'remove_set', 'skip'].includes(adjustmentOperation) &&
      targetMemberIds.length === 0
    ) {
      Alert.alert('请选择成员', '至少选择一位成员后再确认调整。');
      return;
    }

    setIsApplyingAdjustment(true);
    const adjustmentStartedAt = getNowMs();
    try {
      if (adjustmentOperation === 'extra_set') {
        await addExtraSetsForMembers(targetMemberIds);
        setAdjustmentSheetVisible(false);
        return;
      }

      if (adjustmentOperation === 'remove_set') {
        await removeLastSetsForMembers(targetMemberIds);
        if (!completedSetDeletionConfirm) {
          setAdjustmentSheetVisible(false);
        }
        return;
      }

      if (adjustmentOperation === 'skip') {
        await skipCurrentExerciseForMembers(targetMemberIds);
        setAdjustmentSheetVisible(false);
        return;
      }

      if (adjustmentOperation === 'replace') {
        setAdjustmentSheetVisible(false);
        await openReplaceSheet();
        return;
      }

      if (adjustmentOperation === 'temporary') {
        setAdjustmentSheetVisible(false);
        await openTemporaryExerciseSheet();
      }
    } catch (adjustmentError) {
      setError(adjustmentError instanceof Error ? adjustmentError.message : '训练调整失败，请重试。');
    } finally {
      setIsApplyingAdjustment(false);
      if (__DEV__) {
        console.log('[workout-adjustment-performance]', {
          memberCount: targetMemberIds.length,
          operation: adjustmentOperation,
          repositoryMs: getNowMs() - adjustmentStartedAt,
          setCount: activeSets.filter((set) => targetMemberIds.includes(set.memberId)).length,
          totalMs: getNowMs() - adjustmentStartedAt,
        });
      }
    }
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
      exercisePickerCacheRef.current
        ? Promise.resolve(exercisePickerCacheRef.current)
        : repositories.exerciseRepository.listExercises(),
      repositories.exerciseRepository.listAlternatives(activeRecord.exerciseId),
    ]);
    exercisePickerCacheRef.current = exercises;
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
    const exercises =
      exercisePickerCacheRef.current ?? (await repositories.exerciseRepository.listExercises());
    exercisePickerCacheRef.current = exercises;
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
      const ownerUserId = await getRequiredCurrentUserId();
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
      void enqueueSyncCandidatesBatch([{
        entityType: 'workoutExerciseRecords',
        localId: activeRecord.id,
        operation: 'update',
        ownerUserId,
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
      }]).catch(() => undefined);
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
        const ownerUserId = await getRequiredCurrentUserId();
        void enqueueSyncCandidatesBatch([{
          entityType: 'workoutExerciseRecords',
          localId: nextRecord.id,
          operation: 'create',
          ownerUserId,
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
        }, ...nextDetail.sets
          .filter((set) => set.exerciseRecordId === nextRecord.id)
          .map((set) => ({
                entityType: 'workoutSets' as const,
                localId: set.id,
                operation: 'create' as const,
                ownerUserId,
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
                status: 'pending_create' as const,
                updatedAt: set.updatedAt,
              })),
        ]).catch(() => undefined);
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
          <Pressable accessibilityRole="button" disabled={isFinishing} onPress={handleBack} style={styles.backButton}>
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
          <Pressable accessibilityRole="button" disabled={isFinishing} onPress={confirmFinishWorkout}>
            <AppText tone="danger" variant="body" weight="700">
              {isFinishing ? '正在保存最后修改…' : '结束训练'}
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

              {activeProgressionSuggestion?.suggestedWeight !== undefined || activeRecoveryReduction !== null ? (
                <AppCard style={styles.progressionCard} tone="soft">
                  <View style={styles.progressionIcon}>
                    <Ionicons color={colors.primary} name="trending-up-outline" size={20} />
                  </View>
                  <View style={styles.progressionCopy}>
                    {activeProgressionSuggestion?.suggestedWeight !== undefined ? (
                      <>
                        <AppText tone="muted" variant="caption">上次建议</AppText>
                        <AppText variant="bodySmall" weight="900">
                          {activeProgressionSuggestion.suggestion === 'increase' ? '加重至' : '参考重量'} {activeProgressionSuggestion.suggestedWeight} kg
                        </AppText>
                      </>
                    ) : null}
                    {activeRecoveryReduction !== null ? (
                      <>
                        <AppText tone="warning" variant="caption" weight="800">
                          今日恢复调整：临时降低 {activeRecoveryReduction}%
                        </AppText>
                        {progressionWeightAfterRecovery ?? currentDisplaySet?.plannedWeight ? (
                          <AppText variant="bodySmall" weight="900">
                            本次建议 {progressionWeightAfterRecovery ?? currentDisplaySet?.plannedWeight} kg
                          </AppText>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                  {activeProgressionSuggestion?.suggestedWeight !== undefined ? (
                    <AppButton onPress={() => void applyActiveProgressionSuggestion()} size="sm">
                      应用到本次
                    </AppButton>
                  ) : null}
                </AppCard>
              ) : null}

              {currentDisplaySet ? (
                <CurrentSetRecorder
                  key={currentDisplaySet.id}
                  exercise={activeExercise}
                  effortDisplay={preferences.effortDisplay}
                  isCompletingSet={isCompletingSet || isFinishing}
                  isResting={isCurrentMemberResting}
                  isWorkoutReadyToFinish={false}
                  memberName={membersById.get(currentDisplaySet.memberId)?.displayName ?? '成员'}
                  onCompleteSet={() => void completeCurrentRound()}
                  onNotesChange={(v) => saveSetPatchDebounced(currentDisplaySet, { notes: v })}
                  onRepsChange={(v) => saveSetPatchDebounced(currentDisplaySet, { actualReps: v })}
                  onRpeChange={(v) => saveSetPatchDebounced(currentDisplaySet, { rpe: v })}
                  onWeightChange={(v) => saveSetPatchDebounced(currentDisplaySet, { actualWeight: v })}
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
                  weightUnit={preferences.weightUnit}
                />
              ) : (
                <MemberExerciseCompleteCard
                  canFinishWorkout={workoutCompletionState.canFinishFromCompletionCard}
                  hasNextExercise={hasNextExercise}
                  hasPendingForOtherMember={hasPendingForOtherMember}
                  incompleteSetCount={workoutCompletionState.incompleteSetCount}
                  memberName={membersById.get(currentMemberId)?.displayName ?? '成员'}
                  nextMemberName={pendingRotationSet ? membersById.get(pendingRotationSet.memberId)?.displayName : undefined}
                  onAddSet={confirmAddExtraSet}
                  onNextExercise={() => {
                    if (nextIncompleteExerciseIndex >= 0) {
                      setActiveExerciseIndex(nextIncompleteExerciseIndex);
                    } else {
                      goNextExercise();
                    }
                  }}
                  onSwitchNextMember={() => {
                    if (pendingRotationSet?.memberId) {
                      setActiveMemberId(pendingRotationSet.memberId);
                    }
                  }}
                  onFinish={() => void finishWorkout()}
                />
              )}



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
                  color={localSaveState === 'failed' ? colors.danger : lastSavedAt ? colors.success : colors.darkMuted}
                  name={localSaveState === 'failed' ? 'alert-circle' : lastSavedAt ? 'checkmark-circle' : 'time-outline'}
                  size={14}
                />
                <AppText tone={localSaveState === 'failed' ? 'danger' : 'muted'} variant="caption">
                  {localSaveStatus}
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
        memberIds={resolveAdjustmentMemberIds()}
        members={members}
        onApply={() => void applyWorkoutAdjustment()}
        onClose={() => setAdjustmentSheetVisible(false)}
        onEditParticipants={openParticipantEditor}
        onOperationChange={setAdjustmentOperation}
        onScopeChange={setAdjustmentScope}
        onToggleMember={toggleAdjustmentMember}
        isApplying={isApplyingAdjustment}
        operation={adjustmentOperation}
        scope={adjustmentScope}
        selectedMemberIds={selectedAdjustmentMemberIds}
        visible={isAdjustmentSheetVisible}
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
        onClose={() => setCompletedSetDeletionConfirm(null)}
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
  canFinishWorkout,
  hasNextExercise,
  hasPendingForOtherMember,
  incompleteSetCount,
  memberName,
  nextMemberName,
  onAddSet,
  onFinish,
  onNextExercise,
  onSwitchNextMember,
}: {
  canFinishWorkout: boolean;
  hasNextExercise: boolean;
  hasPendingForOtherMember: boolean;
  incompleteSetCount: number;
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
          {canFinishWorkout
            ? '所有训练组均已记录，可以结束本次训练。'
            : `还剩 ${incompleteSetCount} 组未记录，可以继续训练或加做一组。`}
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
            onPress={canFinishWorkout ? onFinish : onNextExercise}
            style={styles.memberDonePrimary}
          >
            <AppText tone="inverse" variant="caption" weight="900">
              {canFinishWorkout ? '结束训练' : hasNextExercise ? '下个动作' : '查看未完成动作'}
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
  onApply,
  onClose,
  onEditParticipants,
  onOperationChange,
  onScopeChange,
  onToggleMember,
  isApplying,
  operation,
  scope,
  selectedMemberIds,
  visible,
}: {
  activeExerciseName: string;
  currentMemberId: string;
  memberIds: string[];
  members: GroupMember[];
  onApply: () => void;
  onClose: () => void;
  onEditParticipants: () => void;
  onOperationChange: (operation: WorkoutAdjustmentOperation) => void;
  onScopeChange: (scope: WorkoutAdjustmentScope) => void;
  onToggleMember: (memberId: string) => void;
  isApplying: boolean;
  operation: WorkoutAdjustmentOperation;
  scope: WorkoutAdjustmentScope;
  selectedMemberIds: string[];
  visible: boolean;
}) {
  const memberName = members.find((member) => member.id === currentMemberId)?.displayName ?? '当前成员';
  const needsScope = operation === 'extra_set' || operation === 'remove_set' || operation === 'skip';
  const selectedCount =
    scope === 'all' ? members.length : scope === 'current' ? (currentMemberId ? 1 : 0) : selectedMemberIds.length;

  return (
    <AppModalSheet
      onClose={onClose}
      subtitle={`只影响本次训练，不修改原计划 · ${activeExerciseName}`}
      title="调整本次动作"
      visible={visible}
    >
      <View style={styles.sheetSection}>
        <AppText tone="muted" variant="caption" weight="900">
          选择操作
        </AppText>
        <View style={styles.operationGrid}>
          <AdjustmentOption
            active={operation === 'extra_set'}
            icon="add-circle-outline"
            label="多做一组"
            meta="给成员增加当前动作下一组"
            onPress={() => onOperationChange('extra_set')}
          />
          <AdjustmentOption
            active={operation === 'remove_set'}
            danger
            icon="remove-circle-outline"
            label="少做一组"
            meta="优先删除未完成最后一组"
            onPress={() => onOperationChange('remove_set')}
          />
          <AdjustmentOption
            active={operation === 'skip'}
            icon="play-skip-forward-outline"
            label="跳过动作"
            meta="本次不继续记录这个动作"
            onPress={() => onOperationChange('skip')}
          />
          <AdjustmentOption
            active={operation === 'replace'}
            icon="swap-horizontal-outline"
            label="替换动作"
            meta="选择替代动作"
            onPress={() => onOperationChange('replace')}
          />
          <AdjustmentOption
            active={operation === 'temporary'}
            icon="add-outline"
            label="添加临时动作"
            meta="加入本次训练快照"
            onPress={() => onOperationChange('temporary')}
          />
        </View>
      </View>

      {needsScope ? (
        <View style={styles.sheetSection}>
          <AppText tone="muted" variant="caption" weight="900">
            选择范围
          </AppText>
          <View style={styles.scopeChoiceRow}>
            <ScopeChoice
              active={scope === 'current'}
              label="当前成员"
              meta={memberName}
              onPress={() => onScopeChange('current')}
            />
            <ScopeChoice
              active={scope === 'selected'}
              label="指定成员"
              meta={`${selectedMemberIds.length} 人`}
              onPress={() => onScopeChange('selected')}
            />
            <ScopeChoice
              active={scope === 'all'}
              label="全部成员"
              meta={`${members.length} 人`}
              onPress={() => onScopeChange('all')}
            />
          </View>
          {scope === 'selected' ? (
            <View style={styles.memberAvatarGrid}>
              {members.map((member) => {
                const selected = selectedMemberIds.includes(member.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: selected }}
                    key={member.id}
                    onPress={() => onToggleMember(member.id)}
                    style={[styles.memberAvatarChoice, selected && styles.memberAvatarChoiceActive]}
                  >
                    <Avatar avatarUrl={member.avatarUrl} name={member.displayName} size={38} />
                    <AppText numberOfLines={1} variant="caption" weight="900">
                      {member.displayName}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.adjustmentResponsibilityCard}>
        <Ionicons color={colors.primary} name="information-circle-outline" size={18} />
        <AppText tone="muted" variant="caption" style={styles.adjustmentResponsibilityText}>
          多做/少做一组只调整当前动作的训练组；编辑参与成员只决定谁参加本次训练。
        </AppText>
      </View>

      <View style={styles.sheetFooterRow}>
        <AppButton onPress={onClose} variant="secondary">
          取消
        </AppButton>
        <AppButton onPress={onEditParticipants} variant="secondary">
          编辑参与成员
        </AppButton>
        <AppButton disabled={isApplying || (needsScope && selectedCount <= 0)} onPress={onApply}>
          {isApplying ? '处理中…' : '确认调整'}
        </AppButton>
      </View>
    </AppModalSheet>
  );
}

function AdjustmentOption({
  active,
  danger = false,
  icon,
  label,
  meta,
  onPress,
}: {
  active: boolean;
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
      style={[styles.operationCard, active && styles.operationCardActive, danger && styles.operationCardDanger]}
    >
      <View style={[styles.operationIcon, active && styles.operationIconActive]}>
        <Ionicons color={active ? colors.surface : danger ? colors.danger : colors.primary} name={icon} size={18} />
      </View>
      <View style={styles.operationText}>
        <AppText variant="bodySmall" weight="900">
          {label}
        </AppText>
        <AppText numberOfLines={2} tone="muted" variant="caption">
          {meta}
        </AppText>
      </View>
    </Pressable>
  );
}

function ScopeChoice({
  active,
  label,
  meta,
  onPress,
}: {
  active: boolean;
  label: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={[styles.scopeChoice, active && styles.scopeChoiceActive]}>
      <AppText tone={active ? 'inverse' : 'default'} variant="caption" weight="900">
        {label}
      </AppText>
      <AppText tone={active ? 'inverse' : 'muted'} variant="caption">
        {meta}
      </AppText>
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
  confirmPreview: {
    gap: spacing.xs,
    padding: spacing.md,
  },
  memberAvatarChoice: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: 72,
    padding: spacing.sm,
  },
  memberAvatarChoiceActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  memberAvatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  operationCard: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 70,
    padding: spacing.sm,
    width: '48%',
  },
  operationCardActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  operationCardDanger: {
    borderColor: colors.dangerSoft,
  },
  operationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  operationIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  operationIconActive: {
    backgroundColor: colors.primary,
  },
  operationText: {
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
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  scopeChoice: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minHeight: 52,
    justifyContent: 'center',
    padding: spacing.sm,
  },
  scopeChoiceActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scopeChoiceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  progressionCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  progressionCopy: {
    flex: 1,
    gap: 2,
  },
  progressionIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
