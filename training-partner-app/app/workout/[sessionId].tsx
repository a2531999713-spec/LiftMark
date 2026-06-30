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
import { AppButton, AppText } from '@/components/ui';
import { CompletedSetList } from '@/components/workout/CompletedSetList';
import { CurrentSetRecorder } from '@/components/workout/CurrentSetRecorder';
import { ExerciseHeroCard } from '@/components/workout/ExerciseHeroCard';
import { GroupMemberStrip } from '@/components/workout/GroupMemberStrip';
import { RotationOrderCard } from '@/components/workout/RotationOrderCard';
import { WorkoutProgressStrip } from '@/components/workout/WorkoutProgressStrip';
import { WorkoutStatsBar } from '@/components/workout/WorkoutStatsBar';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import { getWorkoutRecordInitialReps } from '@/domain/workout/workout.service';
import type {
  SaveWorkoutSetInput,
  WorkoutSessionDetail,
  WorkoutSet,
} from '@/domain/workout/workout.types';
import { useAuthGate } from '@/hooks/useAuthGate';
import { colors, radius, spacing } from '@/theme';

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

export default function WorkoutRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);
  const { authMode, guardFeature, sheets } = useAuthGate();
  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile | null>>({});
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [memberRestState, setMemberRestState] = useState<Record<string, { remaining: number; endTime: number; isResting: boolean }>>({});
  const [isWorkoutReadyToFinish, setWorkoutReadyToFinish] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFinishing, setIsFinishing] = useState(false);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const startedAt = detail?.session.startedAt ? new Date(detail.session.startedAt).getTime() : Date.now();
    const timer = setInterval(() => {
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [detail?.session.startedAt]);

  useEffect(() => {
    const activeRestMembers = Object.entries(memberRestState).filter(([, state]) => state.isResting && state.remaining > 0);
    if (activeRestMembers.length === 0) {
      return;
    }
    const timer = setInterval(() => {
      setMemberRestState((prev) => {
        const next = { ...prev };
        let hasActive = false;
        Object.entries(next).forEach(([memberId, state]) => {
          if (state.isResting && state.remaining > 0) {
            const remaining = Math.max(0, Math.ceil((state.endTime - Date.now()) / 1000));
            if (remaining <= 0) {
              next[memberId] = { ...state, remaining: 0, isResting: false };
            } else {
              next[memberId] = { ...state, remaining };
              hasActive = true;
            }
          }
        });
        return hasActive ? next : prev;
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
        return saved;
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : '本组保存失败。');
        setDetail((current) => replaceSet(current, set));
        return null;
      }
    },
    [guardFeature, repositories],
  );

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
  }, [guardFeature, isFinishing, repositories, sessionId]);

  const activeRecord = detail?.exercises[activeExerciseIndex] ?? null;
  const activeExercise = activeRecord ? exerciseMap[activeRecord.exerciseId] ?? null : null;
  const activeSets = activeRecord
    ? detail?.sets.filter((set) => set.exerciseRecordId === activeRecord.id) ?? []
    : [];
  const completedSets = activeSets.filter((set) => set.completed).length;
  const roundSets = members
    .map((member) => activeSets.filter((set) => set.memberId === member.id).sort((a, b) => a.setNumber - b.setNumber))
    .map(selectDisplaySet)
    .filter((set): set is WorkoutSet => Boolean(set));
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

  const exerciseProgressItems = useMemo(() => {
    if (!detail) return [];
    return detail.exercises.map((record, index) => ({
      id: record.id,
      name: exerciseMap[record.exerciseId]?.name ?? record.exerciseId,
      status: index < activeExerciseIndex ? 'completed' as const : index === activeExerciseIndex ? 'current' as const : 'upcoming' as const,
    }));
  }, [detail, exerciseMap, activeExerciseIndex]);

  const currentDisplaySet = activeMemberId
    ? (roundSets.find((set) => set.memberId === activeMemberId) ?? roundSets[0] ?? null)
    : (roundSets[0] ?? null);
  const currentProfile = currentDisplaySet ? profiles[currentDisplaySet.memberId] ?? null : null;
  const currentIncrement = getWeightIncrement(currentProfile, activeExercise);
  const currentMemberId = currentDisplaySet?.memberId ?? members[0]?.id ?? '';
  const completedActiveSets = [...activeSets]
    .filter((set) => set.completed && set.memberId === currentMemberId)
    .sort((left, right) => left.setNumber - right.setNumber);
  const nextMemberIndex = (members.findIndex((m) => m.id === currentMemberId) + 1) % members.length;
  const nextMemberName = members.length > 1 ? members[nextMemberIndex]?.displayName : undefined;
  function goNextExercise() {
    if (!detail) return;
    setMemberRestState({});
    setWorkoutReadyToFinish(false);
    setActiveExerciseIndex((index) => Math.min(detail.exercises.length - 1, index + 1));
  }

  function skipMemberRest(memberId: string) {
    setMemberRestState((prev) => ({
      ...prev,
      [memberId]: { remaining: 0, endTime: 0, isResting: false },
    }));
  }

  const currentMemberRest = memberRestState[currentMemberId];
  const isCurrentMemberResting = currentMemberRest?.isResting ?? false;
  const currentMemberRestSeconds = currentMemberRest?.remaining ?? 0;

  async function completeCurrentRound() {
    if (isWorkoutReadyToFinish) {
      await finishWorkout();
      return;
    }
    const currentRestState = memberRestState[currentMemberId];
    if (currentRestState?.isResting) {
      skipMemberRest(currentMemberId);
      return;
    }
    const targetSets = roundSets.filter((set) => !set.completed && !set.skipped && set.memberId === currentMemberId);
    if (targetSets.length === 0) {
      if (hasNextExercise) {
        goNextExercise();
      } else {
        setWorkoutReadyToFinish(true);
      }
      return;
    }
    const currentSetNumber = Math.min(...targetSets.map((set) => set.setNumber));
    const hasNextSet = activeSets.some((set) => set.setNumber > currentSetNumber && !set.skipped && set.memberId === currentMemberId);
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
        setMemberRestState((prev) => ({
          ...prev,
          [currentMemberId]: {
            remaining: restSeconds,
            endTime: Date.now() + restSeconds * 1000,
            isResting: true,
          },
        }));
      }
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

  function handleMoreOptions() {
    Alert.alert('训练选项', '', [
      { text: '取消', style: 'cancel' },
      { text: '跳过当前动作', onPress: () => {
        if (activeExerciseIndex < (detail?.exercises.length ?? 1) - 1) {
          setActiveExerciseIndex((prev) => prev + 1);
        }
      }},
      { text: '结束训练', style: 'destructive', onPress: () => void finishWorkout() },
    ]);
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
                <WorkoutStatsBar
                  elapsedLabel={formatTimer(elapsedSeconds)}
                  totalVolumeKg={totalVolumeKg}
                />
              </View>

              <ExerciseHeroCard
                currentSetIndex={completedSets + 1}
                exercise={activeExercise}
                record={activeRecord}
                totalSets={activeSets.length}
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
                  exercise={activeExercise}
                  isResting={isCurrentMemberResting}
                  isWorkoutReadyToFinish={isWorkoutReadyToFinish}
                  memberName={membersById.get(currentDisplaySet.memberId)?.displayName ?? '成员'}
                  onCompleteSet={() => void completeCurrentRound()}
                  onRepsChange={(v) => void saveSetPatch(currentDisplaySet, { actualReps: v })}
                  onSkipRest={() => skipMemberRest(currentMemberId)}
                  onWeightChange={(v) => void saveSetPatch(currentDisplaySet, { actualWeight: v })}
                  profile={currentProfile}
                  record={activeRecord}
                  restSeconds={currentMemberRestSeconds}
                  reps={currentDisplaySet.actualReps ?? currentDisplaySet.plannedReps}
                  setNumber={currentDisplaySet.setNumber}
                  weight={currentDisplaySet.actualWeight ?? currentDisplaySet.plannedWeight}
                  weightIncrement={currentIncrement}
                />
              ) : null}

              {members.length > 1 && Object.entries(memberRestState).some(([, s]) => s.isResting) ? (
                <View style={styles.otherMembersRestSection}>
                  <AppText variant="caption" weight="700" style={styles.otherMembersTitle}>其他成员休息中</AppText>
                  <View style={styles.otherMembersGrid}>
                    {members.filter((m) => m.id !== currentMemberId && memberRestState[m.id]?.isResting).map((member) => (
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
                disabled
                style={[styles.auxButton, styles.auxButtonDisabled]}
              >
                <Ionicons color={colors.textSubtle} name="swap-horizontal-outline" size={16} />
                <AppText tone="subtle" variant="caption">
                  替换待开放
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
