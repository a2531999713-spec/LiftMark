import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { MemberProfile } from '@/domain/member/member.types';
import type { WorkoutExerciseRecord } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

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

type CurrentSetRecorderProps = {
  exercise: Exercise | null;
  isResting: boolean;
  isWorkoutReadyToFinish: boolean;
  memberName: string;
  onCompleteSet: () => void;
  onSkipRest: () => void;
  onWeightChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  profile: MemberProfile | null;
  record: WorkoutExerciseRecord;
  restSeconds?: number;
  setNumber: number;
  weight: number | undefined;
  reps: number | undefined;
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
  setNumber,
  restSeconds,
  weight,
  reps,
  weightIncrement,
}: CurrentSetRecorderProps) {
  function formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

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

      <View style={styles.inputRow}>
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

      <View style={styles.actionRow}>
        {isResting ? (
          <Pressable
            accessibilityRole="button"
            onPress={onSkipRest}
            style={styles.restButton}
          >
            <View style={styles.restButtonContent}>
              <Ionicons color={colors.primary} name="play-forward" size={18} />
              <AppText variant="bodySmall" weight="800" style={styles.restButtonText}>
                跳过休息
              </AppText>
            </View>
            {restSeconds !== undefined && restSeconds > 0 ? (
              <View style={styles.restTimerBadge}>
                <AppText variant="caption" weight="900" style={styles.restTimerText}>
                  {formatTimer(restSeconds)}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={onCompleteSet}
            style={[styles.primaryButton, isWorkoutReadyToFinish && styles.primaryButtonFinish]}
          >
            <Ionicons
              color={colors.surface}
              name={isWorkoutReadyToFinish ? 'flag-outline' : 'checkmark-circle-outline'}
              size={18}
            />
            <AppText tone="inverse" variant="bodySmall" weight="800">
              {isWorkoutReadyToFinish ? '完成训练' : '完成本组'}
            </AppText>
          </Pressable>
        )}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
    padding: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cardTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  setBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stepper: {
    flex: 1,
    gap: spacing.xs,
  },
  stepperLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    height: 48,
    paddingHorizontal: spacing.sm,
  },
  stepperButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  stepperInput: {
    color: colors.textStrong,
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    height: 48,
    textAlign: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  primaryButtonFinish: {
    backgroundColor: colors.brandDark,
  },
  restButton: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
    borderRadius: radius.md,
    borderWidth: 1.5,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
  restButtonContent: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  restButtonText: {
    color: colors.primary,
  },
  restTimerBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  restTimerText: {
    color: colors.surface,
  },
});
