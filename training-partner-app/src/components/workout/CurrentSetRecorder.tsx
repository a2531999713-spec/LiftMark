import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { MemberProfile } from '@/domain/member/member.types';
import type { WorkoutExerciseRecord } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

const rpeOptions = [6, 7, 8, 9, 10];
const rirOptions = [0, 1, 2, 3, 4, 5];

function formatNumber(value: number | undefined, fallback = '0'): string {
  if (value === undefined) {
    return fallback;
  }
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
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

function getWeightIncrement(profile: MemberProfile | null, exercise: Exercise | null): number {
  if (exercise?.equipment === 'dumbbell') {
    return profile?.dumbbellIncrement ?? 2;
  }
  return profile?.barbellIncrement ?? 2.5;
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
          <Ionicons color={colors.textStrong} name="remove" size={20} />
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
          <Ionicons color={colors.textStrong} name="add" size={20} />
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
              onPress={() => onChange(isActive ? undefined : option)}
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
      </View>
    </View>
  );
}

type CurrentSetRecorderProps = {
  exercise: Exercise | null;
  isResting: boolean;
  isWorkoutReadyToFinish: boolean;
  memberName: string;
  onClearRpe: () => void;
  onClearRir: () => void;
  onCompleteSet: () => void;
  onRpeChange: (value: number) => void;
  onRirChange: (value: number) => void;
  onSkipRest: () => void;
  onWeightChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  profile: MemberProfile | null;
  record: WorkoutExerciseRecord;
  setNumber: number;
  weight: number | undefined;
  reps: number | undefined;
  rpe: number | undefined;
  rir: number | undefined;
  weightIncrement: number;
};

export function CurrentSetRecorder({
  isResting,
  isWorkoutReadyToFinish,
  memberName,
  onCompleteSet,
  onSkipRest,
  onWeightChange,
  onRepsChange,
  onRpeChange,
  onRirChange,
  onClearRpe,
  onClearRir,
  setNumber,
  weight,
  reps,
  rpe,
  rir,
  weightIncrement,
}: CurrentSetRecorderProps) {
  const primaryLabel = isWorkoutReadyToFinish
    ? '完成训练并查看总结'
    : isResting
      ? '跳过休息，进入下一组'
      : '完成本组';

  const secondaryLabel = isResting ? '跳过休息' : '跳过';

  return (
    <AppCard padded={false} style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <AppText variant="body" weight="700">
            当前记录：
          </AppText>
          <AppText tone="brand" variant="body" weight="900">
            {memberName}
          </AppText>
        </View>
        <View style={styles.setBadge}>
          <AppText tone="brand" variant="caption" weight="700">
            第 {setNumber} 组
          </AppText>
        </View>
      </View>

      <View style={styles.inputGrid}>
        <View style={styles.inputLeft}>
          <NumberStepper
            label="重量"
            onChange={(v) => { if (v !== undefined) onWeightChange(v); }}
            step={weightIncrement}
            unit="kg"
            value={weight}
          />
          <NumberStepper
            integer
            label="次数"
            onChange={(v) => { if (v !== undefined) onRepsChange(v); }}
            step={1}
            unit="次"
            value={reps}
          />
        </View>
        <View style={styles.inputRight}>
          <OptionButtons
            label="RPE"
            onChange={(v) => v !== undefined ? onRpeChange(v) : onClearRpe()}
            options={rpeOptions}
            value={rpe}
          />
          <OptionButtons
            label="RIR"
            onChange={(v) => v !== undefined ? onRirChange(v) : onClearRir()}
            options={rirOptions}
            value={rir}
          />
        </View>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          accessibilityRole="button"
          onPress={onCompleteSet}
          style={[styles.primaryButton, isWorkoutReadyToFinish && styles.primaryButtonFinish]}
        >
          <Ionicons
            color={colors.surface}
            name={isWorkoutReadyToFinish ? 'flag-outline' : 'checkmark-circle-outline'}
            size={20}
          />
          <AppText tone="inverse" variant="body" weight="800">
            {primaryLabel}
          </AppText>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onSkipRest} style={styles.secondaryButton}>
          <Ionicons color={colors.brand} name="timer-outline" size={16} />
          <AppText tone="brand" variant="caption" weight="600">
            {secondaryLabel}
          </AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    padding: spacing.sm + 2,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  setBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  inputGrid: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  inputLeft: {
    flex: 1,
    gap: spacing.xxs,
    minWidth: 116,
  },
  inputRight: {
    flex: 1.55,
    gap: spacing.xxs,
    minWidth: 0,
  },
  stepper: {
    flex: 1,
    gap: spacing.xxs,
  },
  stepperLabelRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xxs,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 34,
    justifyContent: 'center',
    width: 30,
  },
  stepperInput: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    color: colors.textStrong,
    flex: 1,
    fontSize: 17,
    fontWeight: '900',
    height: 34,
    paddingHorizontal: spacing.xs,
    textAlign: 'center',
  },
  optionGroup: {
    gap: spacing.xxs,
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: spacing.xxs,
  },
  optionPill: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 26,
    justifyContent: 'center',
    minWidth: 28,
    paddingHorizontal: spacing.xxs,
  },
  optionPillActive: {
    backgroundColor: colors.brand,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingTop: spacing.xxs,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderColor: colors.brand,
    borderRadius: radius.sm,
    borderWidth: 1,
    flex: 2,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  primaryButtonFinish: {
    backgroundColor: colors.brandDark,
  },
  secondaryButton: {
    alignItems: 'center',
    borderColor: colors.brand,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    flex: 0.95,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.xs,
  },
});
