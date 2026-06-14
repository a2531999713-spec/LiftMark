import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, EmptyState, Screen, SectionHeader, Tag, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import { colors, radius, spacing, typography } from '@/theme';

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
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedExerciseId, setSelectedExerciseId] = useState('');
  const [date, setDate] = useState(params.date ?? getLocalDateString());
  const [title, setTitle] = useState('补录训练');
  const [setCount, setSetCount] = useState('3');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('8');
  const [rpe, setRpe] = useState('');
  const [rir, setRir] = useState('');
  const [restSeconds, setRestSeconds] = useState('');
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
          setSelectedExerciseId(nextExercises[0]?.id ?? '');
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

  const saveManualSession = async () => {
    if (!group || !selectedMemberId || !selectedExerciseId) {
      Alert.alert('信息不完整', '请选择成员和动作后再保存。');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const parsedSetCount = parseOptionalInteger(setCount);
      const parsedReps = parseOptionalInteger(reps);
      const parsedWeight = parseOptionalNumber(weight);
      const parsedRpe = parseOptionalNumber(rpe);
      const parsedRir = parseOptionalNumber(rir);
      const parsedRestSeconds = parseOptionalInteger(restSeconds);

      assertOptionalRange('组数', parsedSetCount, 1);
      assertOptionalRange('次数', parsedReps, 0);
      assertOptionalRange('重量', parsedWeight, 0);
      assertOptionalRange('RPE', parsedRpe, 6, 10);
      assertOptionalRange('RIR', parsedRir, 0, 5);
      assertOptionalRange('间歇时间', parsedRestSeconds, 0);

      const session = await repositories.workoutRepository.createManualSession({
        completed: true,
        date,
        exerciseId: selectedExerciseId,
        groupId: group.id,
        memberId: selectedMemberId,
        planId: group.activePlanId,
        reps: parsedReps,
        restSeconds: parsedRestSeconds ?? null,
        rir: parsedRir,
        rpe: parsedRpe,
        setCount: parsedSetCount ?? 1,
        title,
        weight: parsedWeight,
      });

      Alert.alert('已保存', '历史训练已保存到本地 SQLite。', [
        {
          text: '查看详情',
          onPress: () => router.replace({ pathname: '/history/[sessionId]', params: { sessionId: session.id } } as never),
        },
      ]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : '保存补录训练失败。');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Screen title="补录训练" subtitle="把过去完成的训练保存到本地记录。">
      {isLoading ? <ActivityIndicator color={colors.primary} /> : null}
      {error ? <EmptyState title="补录训练暂时不可用" description={error} /> : null}

      {!isLoading && !error ? (
        <>
          <VisualHeroCard
            eyebrow="历史补录"
            icon="create-outline"
            imageSource={liftmarkImages.historyHero}
            minHeight={154}
            subtitle="补录只修改训练记录，不会改动原训练计划。休息时间可以留空。"
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
            <SectionHeader title="动作" />
            <View style={styles.exerciseList}>
              {exercises.slice(0, 12).map((exercise) => (
                <Pressable
                  accessibilityRole="button"
                  key={exercise.id}
                  onPress={() => setSelectedExerciseId(exercise.id)}
                  style={[styles.exerciseRow, selectedExerciseId === exercise.id && styles.exerciseRowActive]}
                >
                  <Ionicons color={selectedExerciseId === exercise.id ? colors.primary : colors.textMuted} name="barbell-outline" size={20} />
                  <View style={styles.exerciseText}>
                    <AppText variant="bodySmall" weight="900">
                      {exercise.name}
                    </AppText>
                    <AppText tone="muted" variant="caption">
                      {exercise.targetMuscle} · {exercise.equipment}
                    </AppText>
                  </View>
                  {selectedExerciseId === exercise.id ? <Tag label="已选择" tone="brand" /> : null}
                </Pressable>
              ))}
            </View>
          </AppCard>

          <AppCard style={styles.card}>
            <SectionHeader title="组数据" />
            <View style={styles.fieldGrid}>
              <Field label="组数" onChangeText={setSetCount} value={setCount} />
              <Field label="重量 kg" onChangeText={setWeight} placeholder="可留空" value={weight} />
              <Field label="次数" onChangeText={setReps} value={reps} />
              <Field label="RPE" onChangeText={setRpe} placeholder="可留空" value={rpe} />
              <Field label="RIR" onChangeText={setRir} placeholder="可留空" value={rir} />
              <Field label="间歇秒" onChangeText={setRestSeconds} placeholder="可留空" value={restSeconds} />
            </View>
            <AppText tone="muted" variant="caption">
              间歇时间留空不影响训练量、PR 和估算 1RM。
            </AppText>
          </AppCard>

          <AppButton disabled={isSaving} icon="save-outline" onPress={() => void saveManualSession()} size="lg">
            {isSaving ? '保存中...' : '保存记录'}
          </AppButton>
        </>
      ) : null}
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
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
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
  exerciseList: {
    gap: spacing.sm,
  },
  exerciseRow: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  exerciseRowActive: {
    borderColor: colors.primary,
  },
  exerciseText: {
    flex: 1,
    gap: 2,
  },
});
