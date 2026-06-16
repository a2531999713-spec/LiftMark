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

import { AppButton, AppText, EmptyState, PriorityTag, Tag } from '@/components/ui';
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

function formatNumber(value: number | undefined, fallback = '0'): string {
  if (value === undefined) return fallback;
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function formatPrescription(record: WorkoutExerciseRecord): string {
  if (record.plannedSets && record.plannedReps) return `${record.plannedSets} x ${record.plannedReps}`;
  if (record.plannedSets && record.plannedRepMin && record.plannedRepMax) return `${record.plannedSets} x ${record.plannedRepMin}-${record.plannedRepMax}`;
  if (record.plannedSets) return `${record.plannedSets} 组`;
  return '按现场安排';
}

function formatRestLabel(seconds?: number): string {
  if (!seconds || seconds <= 0) return '无';
  if (seconds >= 60) return `${Math.round(seconds / 60)} 分钟`;
  return `${seconds} 秒`;
}

function formatTimer(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatKg(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : `${Math.round(value)}`;
}

export default function WorkoutSessionRoute() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const repositories = useMemo(() => createLocalRepositories(), []);

  const [detail, setDetail] = useState<WorkoutSessionDetail | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Record<string, MemberProfile>>({});
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({});
  const [activeExerciseIndex, setActiveExerciseIndex] = useState(0);
  const [currentMemberIndex, setCurrentMemberIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  const loadWorkout = useCallback(async () => {
    if (!sessionId) return;
    try {
      await initializeLocalDatabase();
      const sessionDetail = await repositories.workoutRepository.getSessionDetail(sessionId);
      if (!sessionDetail) {
        setError('未找到训练记录');
        setIsLoading(false);
        return;
      }
      setDetail(sessionDetail);

      const exerciseIds = sessionDetail.exercises.map((e) => e.exerciseId);
      const [exercises, groupMembers, allProfiles] = await Promise.all([
        repositories.exerciseRepository.listExercisesByIds(exerciseIds),
        repositories.memberRepository.listMembers('default'),
        repositories.memberRepository.listProfiles(),
      ]);

      const exMap: Record<string, Exercise> = {};
      exercises.forEach((e) => { exMap[e.id] = e; });
      setExerciseMap(exMap);

      const profileMap: Record<string, MemberProfile> = {};
      allProfiles.forEach((p) => { profileMap[p.memberId] = p; });
      setProfiles(profileMap);

      const sessionMembers = groupMembers.filter((m) =>
        sessionDetail.sets.some((s) => s.memberId === m.id)
      );
      setMembers(sessionMembers.length > 0 ? sessionMembers : groupMembers.slice(0, 1));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载训练数据失败');
    } finally {
      setIsLoading(false);
    }
  }, [repositories, sessionId]);

  useFocusEffect(useCallback(() => { void loadWorkout(); }, [loadWorkout]));

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isResting || restSecondsRemaining <= 0) return;
    const timer = setInterval(() => {
      setRestSecondsRemaining((prev) => {
        if (prev <= 1) {
          setIsResting(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isResting, restSecondsRemaining]);

  const saveSetPatch = useCallback(
    async (set: WorkoutSet, patch: Omit<SaveWorkoutSetInput, 'id'>) => {
      try {
        await repositories.workoutRepository.saveSet({ id: set.id, ...patch });
        setDetail((current) => {
          if (!current) return current;
          return {
            ...current,
            sets: current.sets.map((s) => (s.id === set.id ? { ...s, ...patch } : s)),
          };
        });
      } catch (patchError) {
        setError(patchError instanceof Error ? patchError.message : '保存失败');
      }
    },
    [repositories],
  );

  const finishWorkout = useCallback(async () => {
    if (!sessionId || isFinishing) return;
    Alert.alert('确认结束本次训练？', '已记录的数据会保存，未完成动作将不会计入完成组。', [
      { text: '继续训练', style: 'cancel' },
      {
        text: '保存并结束',
        style: 'destructive',
        onPress: async () => {
          setIsFinishing(true);
          try {
            await repositories.workoutRepository.finishSession(sessionId);
            router.replace({ pathname: '/workout/summary/[sessionId]', params: { sessionId } });
          } catch (finishError) {
            setError(finishError instanceof Error ? finishError.message : '结束训练失败');
            setIsFinishing(false);
          }
        },
      },
    ]);
  }, [sessionId, isFinishing, repositories]);

  const activeRecord = detail?.exercises[activeExerciseIndex] ?? null;
  const activeExercise = activeRecord ? exerciseMap[activeRecord.exerciseId] ?? null : null;
  const activeSets = activeRecord
    ? detail?.sets.filter((s) => s.exerciseRecordId === activeRecord.id && s.memberId === members[currentMemberIndex]?.id) ?? []
    : [];
  const currentSet = activeSets.find((s) => !s.completed) ?? activeSets[activeSets.length - 1];
  const completedSets = detail?.sets.filter((s) => s.completed) ?? [];
  const totalVolume = completedSets.reduce((sum, s) => sum + (s.actualWeight ?? 0) * (s.actualReps ?? 0), 0);
  const hasNextExercise = detail ? activeExerciseIndex < detail.exercises.length - 1 : false;
  const hasNextMember = currentMemberIndex < members.length - 1;

  const completeCurrentSet = useCallback(async () => {
    if (!currentSet) return;
    await saveSetPatch(currentSet, { completed: true });

    if (hasNextMember) {
      setCurrentMemberIndex((prev) => prev + 1);
    } else if (hasNextExercise) {
      setActiveExerciseIndex((prev) => prev + 1);
      setCurrentMemberIndex(0);
    }
  }, [currentSet, saveSetPatch, hasNextMember, hasNextExercise]);

  const skipRest = useCallback(() => {
    setIsResting(false);
    setRestSecondsRemaining(0);
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !detail || !activeRecord) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <EmptyState title="训练提示" description={error ?? '未找到训练记录'} />
      </SafeAreaView>
    );
  }

  const currentMember = members[currentMemberIndex];

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons color={colors.text} name="chevron-back" size={28} />
          </Pressable>
          <View style={styles.headerCenter}>
            <AppText variant="subtitle" weight="700">训练中</AppText>
            <AppText tone="muted" variant="caption">
              {detail.plan?.name ?? '自定义训练'} · 第 {detail.week ?? 1} 周 · Day {detail.day ?? 1}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" onPress={finishWorkout} style={styles.endButton}>
            <AppText variant="bodySmall" weight="600" style={{ color: colors.primary }}>结束训练</AppText>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Ionicons color={colors.textMuted} name="time-outline" size={16} />
            <View style={styles.statText}>
              <AppText tone="muted" variant="caption">训练时长</AppText>
              <AppText variant="bodySmall" weight="700">{formatTimer(elapsedSeconds)}</AppText>
            </View>
          </View>
          <View style={styles.statCard}>
            <Ionicons color={colors.primary} name="flame-outline" size={16} />
            <View style={styles.statText}>
              <AppText tone="muted" variant="caption">本次总量</AppText>
              <AppText variant="bodySmall" weight="700">{formatKg(totalVolume)} kg</AppText>
            </View>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <AppText tone="inverse" variant="caption" weight="700">{activeRecord.priority}</AppText>
          </View>
          <View style={styles.heroProgress}>
            <AppText tone="inverse" variant="caption">
              {(currentSet?.setNumber ?? 1)} / {activeRecord.plannedSets ?? '?'}
            </AppText>
          </View>
          <View style={styles.heroContent}>
            <AppText tone="inverse" variant="headline" weight="700">
              {activeExercise?.name ?? activeRecord.exerciseId}
            </AppText>
            <AppText tone="inverse" variant="bodySmall" style={{ opacity: 0.8 }}>
              {activeExercise?.targetMuscle ?? ''} · {activeExercise?.movementPattern ?? ''}
            </AppText>
            <View style={styles.heroMeta}>
              <Ionicons color={colors.primary} name="time-outline" size={14} />
              <AppText tone="inverse" variant="caption">休息建议 {formatRestLabel(activeRecord.plannedRestSeconds)}</AppText>
            </View>
          </View>
        </View>

        <View style={styles.memberRow}>
          {members.map((member, index) => {
            const isCurrent = index === currentMemberIndex;
            return (
              <Pressable
                accessibilityRole="button"
                key={member.id}
                onPress={() => setCurrentMemberIndex(index)}
                style={styles.memberItem}
              >
                <View style={[styles.memberAvatar, isCurrent && styles.memberAvatarActive]}>
                  <AppText tone="inverse" variant="caption" weight="600">
                    {member.displayName.slice(0, 1)}
                  </AppText>
                </View>
                <AppText variant="caption" weight="600">{member.displayName}</AppText>
                {isCurrent ? <Tag label="当前" tone="brand" /> : null}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.recordCard}>
          <View style={styles.recordHeader}>
            <AppText variant="subtitle" weight="700">
              当前记录：<AppText tone="brand" weight="700">{currentMember?.displayName ?? '成员'}</AppText>
            </AppText>
            <View style={styles.setBadge}>
              <AppText tone="brand" variant="caption" weight="700">第 {(currentSet?.setNumber ?? 1)} 组</AppText>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputGroup}>
              <AppText tone="muted" variant="caption">重量 (kg)</AppText>
              <AppText variant="headline" weight="700">
                {formatNumber(currentSet?.actualWeight ?? currentSet?.plannedWeight ?? 0)}
              </AppText>
              <View style={styles.stepperRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (currentSet) {
                      const newVal = (currentSet.actualWeight ?? currentSet.plannedWeight ?? 0) - 2.5;
                      void saveSetPatch(currentSet, { actualWeight: Math.max(0, newVal) });
                    }
                  }}
                  style={styles.stepperBtn}
                >
                  <Ionicons color={colors.textMuted} name="remove" size={18} />
                </Pressable>
                <AppText variant="caption" weight="600">2.5</AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (currentSet) {
                      const newVal = (currentSet.actualWeight ?? currentSet.plannedWeight ?? 0) + 2.5;
                      void saveSetPatch(currentSet, { actualWeight: newVal });
                    }
                  }}
                  style={styles.stepperBtn}
                >
                  <Ionicons color={colors.textMuted} name="add" size={18} />
                </Pressable>
              </View>
            </View>

            <View style={styles.inputDivider} />

            <View style={styles.inputGroup}>
              <AppText tone="muted" variant="caption">次数 (次)</AppText>
              <AppText variant="headline" weight="700">
                {currentSet?.actualReps ?? currentSet?.plannedReps ?? 0}
              </AppText>
              <View style={styles.stepperRow}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (currentSet) {
                      const newVal = (currentSet.actualReps ?? currentSet.plannedReps ?? 0) - 1;
                      void saveSetPatch(currentSet, { actualReps: Math.max(0, newVal) });
                    }
                  }}
                  style={styles.stepperBtn}
                >
                  <Ionicons color={colors.textMuted} name="remove" size={18} />
                </Pressable>
                <AppText variant="caption" weight="600">1</AppText>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    if (currentSet) {
                      const newVal = (currentSet.actualReps ?? currentSet.plannedReps ?? 0) + 1;
                      void saveSetPatch(currentSet, { actualReps: newVal });
                    }
                  }}
                  style={styles.stepperBtn}
                >
                  <Ionicons color={colors.textMuted} name="add" size={18} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.selectorRow}>
            <View style={styles.selectorGroup}>
              <AppText tone="muted" variant="caption" weight="600">RPE</AppText>
              <View style={styles.presetRow}>
                {rpeOptions.map((value) => {
                  const isActive = currentSet?.rpe === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      onPress={() => currentSet && void saveSetPatch(currentSet, { rpe: isActive ? undefined : value })}
                      style={[styles.presetBtn, isActive && styles.presetBtnActive]}
                    >
                      <AppText tone={isActive ? 'inverse' : 'default'} variant="caption" weight="600">
                        {value}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.selectorGroup}>
              <AppText tone="muted" variant="caption" weight="600">RIR</AppText>
              <View style={styles.presetRow}>
                {rirOptions.map((value) => {
                  const isActive = currentSet?.rir === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      onPress={() => currentSet && void saveSetPatch(currentSet, { rir: isActive ? undefined : value })}
                      style={[styles.presetBtn, isActive && styles.presetBtnActive]}
                    >
                      <AppText tone={isActive ? 'inverse' : 'default'} variant="caption" weight="600">
                        {value}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <View style={styles.actionRow}>
            <AppButton icon="checkmark-outline" onPress={completeCurrentSet} size="lg" style={{ flex: 1 }}>
              完成本组
            </AppButton>
            <Pressable
              accessibilityRole="button"
              onPress={isResting ? skipRest : undefined}
              style={[styles.secondaryBtn, !isResting && styles.secondaryBtnDisabled]}
            >
              <Ionicons color={isResting ? colors.primary : colors.textMuted} name="pause-outline" size={18} />
              <AppText variant="bodySmall" weight="600" style={{ color: isResting ? colors.primary : colors.textMuted }}>
                {isResting ? '跳过休息' : '跳过本组'}
              </AppText>
            </Pressable>
          </View>

          <View style={styles.autoHint}>
            <Ionicons color={colors.textMuted} name="information-circle-outline" size={14} />
            <AppText tone="muted" variant="caption">完成后自动切换到下一位成员</AppText>
          </View>
        </View>

        {completedSets.length > 0 && (
          <View style={styles.completedSection}>
            <AppText variant="subtitle" weight="600">已完成组</AppText>
            {completedSets.map((set) => (
              <View key={set.id} style={styles.completedRow}>
                <AppText variant="bodySmall" weight="600">{set.setNumber} 组</AppText>
                <AppText variant="bodySmall">{formatNumber(set.actualWeight)} kg × {set.actualReps ?? 0}</AppText>
                {set.rpe ? <Tag label={`RPE ${set.rpe}`} tone="neutral" /> : null}
                {set.rir !== undefined ? <Tag label={`RIR ${set.rir}`} tone="neutral" /> : null}
                <View style={styles.completedActions}>
                  <Pressable accessibilityRole="button" style={styles.editBtn}>
                    <Ionicons color={colors.primary} name="pencil" size={14} />
                  </Pressable>
                  <Pressable accessibilityRole="button" style={styles.deleteBtn}>
                    <Ionicons color={colors.textMuted} name="trash-outline" size={14} />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        <View style={styles.rotationSection}>
          <AppText variant="subtitle" weight="600">当前轮换顺序</AppText>
          <View style={styles.rotationRow}>
            {members.map((member, index) => {
              const isCurrent = index === currentMemberIndex;
              return (
                <View key={member.id} style={styles.rotationItem}>
                  <View style={[styles.rotationDot, isCurrent && styles.rotationDotActive]}>
                    <AppText tone="inverse" variant="caption" weight="600">
                      {member.displayName.slice(0, 1)}
                    </AppText>
                  </View>
                  <AppText variant="caption" weight={isCurrent ? '700' : '400'}>{member.displayName}</AppText>
                  {index < members.length - 1 && (
                    <Ionicons color={colors.textMuted} name="arrow-forward" size={12} />
                  )}
                </View>
              );
            })}
          </View>
          {hasNextMember && (
            <View style={styles.nextMemberHint}>
              <Ionicons color={colors.textMuted} name="people-outline" size={14} />
              <AppText tone="muted" variant="caption">下一位：{members[currentMemberIndex + 1]?.displayName}</AppText>
            </View>
          )}
        </View>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <AppText variant="subtitle" weight="600">本次训练进度</AppText>
            <AppText variant="bodySmall" weight="600">
              <AppText tone="brand" weight="700">{activeExerciseIndex + 1}</AppText> / {detail.exercises.length} 个动作
            </AppText>
          </View>
          <View style={styles.progressSteps}>
            {detail.exercises.map((exercise, index) => {
              const isCompleted = index < activeExerciseIndex;
              const isCurrent = index === activeExerciseIndex;
              const exerciseName = exerciseMap[exercise.exerciseId]?.name ?? exercise.exerciseId;
              return (
                <View key={exercise.id} style={styles.stepItem}>
                  <View style={[
                    styles.stepDot,
                    isCompleted && styles.stepDotCompleted,
                    isCurrent && styles.stepDotCurrent,
                  ]}>
                    <AppText tone="inverse" variant="caption" weight="600">{index + 1}</AppText>
                  </View>
                  <AppText variant="caption" numberOfLines={1}>{exerciseName.slice(0, 4)}</AppText>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backButton: {
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  endButton: {
    height: 44,
    justifyContent: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  statText: {
    gap: 2,
  },
  heroCard: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    height: 200,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    padding: spacing.xl,
  },
  heroBadge: {
    position: 'absolute',
    top: spacing.lg,
    left: spacing.lg,
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroProgress: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  heroContent: {
    gap: spacing.sm,
  },
  heroMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  memberRow: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-around',
  },
  memberItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  memberAvatar: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  memberAvatarActive: {
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    gap: spacing.lg,
    padding: spacing.xl,
  },
  recordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  setBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  inputGroup: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.sm,
  },
  inputDivider: {
    backgroundColor: colors.border,
    width: 1,
  },
  stepperRow: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  stepperBtn: {
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  selectorRow: {
    gap: spacing.md,
  },
  selectorGroup: {
    gap: spacing.sm,
  },
  presetRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  presetBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  presetBtnActive: {
    backgroundColor: colors.primary,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  secondaryBtn: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  secondaryBtnDisabled: {
    borderColor: colors.border,
    opacity: 0.6,
  },
  autoHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  completedSection: {
    gap: spacing.md,
  },
  completedRow: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  completedActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginLeft: 'auto',
  },
  editBtn: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  deleteBtn: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  rotationSection: {
    gap: spacing.md,
  },
  rotationRow: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rotationItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  rotationDot: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  rotationDotActive: {
    backgroundColor: colors.primary,
  },
  nextMemberHint: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  progressSection: {
    gap: spacing.md,
  },
  progressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressSteps: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  stepDot: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  stepDotCompleted: {
    backgroundColor: colors.textMuted,
    borderColor: colors.textMuted,
  },
  stepDotCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});