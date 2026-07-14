import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppCard, AppText } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { MemberProfile } from '@/domain/member/member.types';
import type { EffortDisplay, WeightUnit } from '@/domain/preferences/user-preferences.types';
import { addWeightStep, formatWeight, subtractWeightStep } from '@/domain/weight/weight-calculator';
import type { WorkoutExerciseRecord } from '@/domain/workout/workout.types';
import { colors, radius, spacing } from '@/theme';

import { RpeSelector } from './RpeSelector';
import { SetNotesInput } from './SetNotesInput';

function formatNumber(value: number | undefined, fallback = '0'): string {
  return formatWeight(value, fallback);
}

function formatCompactTimer(seconds: number | undefined): string {
  const safeSeconds = Math.max(0, seconds ?? 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remain = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remain).padStart(2, '0')}`;
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
  return integer ? Math.round(value) : Math.round((value + Number.EPSILON) * 1000) / 1000;
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
  const current = value !== undefined && Number.isFinite(value) ? value : min;
  const effectiveStep = Number.isFinite(step) && step > 0 ? step : 1;

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

  function handleDraftChange(text: string) {
    setDraft(text);
    const parsed = parseNumericInput(text, integer);
    if (parsed === null || !Number.isFinite(parsed)) {
      return;
    }
    if (parsed < min || (max !== undefined && parsed > max)) {
      return;
    }
    onChange(parsed);
  }

  function changeByStep(direction: 1 | -1) {
    const next = integer
      ? current + effectiveStep * direction
      : direction === 1
        ? addWeightStep(current, effectiveStep)
        : subtractWeightStep(current, effectiveStep);
    const lowerBounded = Math.max(min, next);
    const bounded = max === undefined ? lowerBounded : Math.min(max, lowerBounded);
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
          onChangeText={handleDraftChange}
          onSubmitEditing={commitDraft}
          placeholder={allowEmpty ? '未设置' : '填写'}
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
  effortDisplay?: EffortDisplay;
  isCompletingSet?: boolean;
  isResting: boolean;
  isWorkoutReadyToFinish: boolean;
  memberName: string;
  nextMemberName?: string;
  nextSetLabel?: string;
  onCompleteSet: () => void;
  onNotesChange?: (value: string | undefined) => void;
  onRpeChange?: (value: number | undefined) => void;
  onWeightChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  notes?: string;
  plannedRestSeconds?: number;
  profile: MemberProfile | null;
  record: WorkoutExerciseRecord;
  restElapsedSeconds?: number;
  restSeconds?: number;
  rpe?: number;
  setNumber: number;
  weight: number | undefined;
  reps: number | undefined;
  weightIncrement: number;
  weightUnit?: WeightUnit;
};

export function CurrentSetRecorder({
  isResting,
  isCompletingSet = false,
  isWorkoutReadyToFinish,
  memberName,
  nextMemberName,
  nextSetLabel,
  onCompleteSet,
  onNotesChange,
  onRpeChange,
  onWeightChange,
  onRepsChange,
  notes,
  plannedRestSeconds,
  record,
  restElapsedSeconds,
  setNumber,
  restSeconds,
  rpe,
  weight,
  reps,
  weightIncrement,
  effortDisplay = 'none',
  weightUnit = 'kg',
}: CurrentSetRecorderProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  // 当偏好关闭 RPE/RIR 显示时，不展示高级面板中的努力度选择器
  const effortEnabled = effortDisplay !== 'none';
  const hasAdvancedValues = (effortEnabled && rpe !== undefined) || Boolean(notes);
  const showAdvancedPanel = showAdvanced || hasAdvancedValues;

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
          key={`weight-${record.id}`}
          label="重量"
          onChange={(v) => { if (v !== undefined) onWeightChange(v); }}
          step={weightIncrement}
          unit={weightUnit}
          value={weight}
        />
        <NumberStepper
          integer
          key={`reps-${record.id}`}
          label="次数"
          onChange={(v) => { if (v !== undefined) onRepsChange(v); }}
          step={1}
          unit="次"
          value={reps}
        />
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isCompletingSet}
        onPress={() => setShowAdvanced((current) => !current)}
        style={styles.advancedToggle}
      >
        <View style={styles.advancedToggleText}>
          <Ionicons color={colors.textMuted} name="options-outline" size={16} />
          <AppText tone="muted" variant="caption" weight="800">
            {effortEnabled ? `${effortDisplay.toUpperCase()} / 备注` : '备注'}
          </AppText>
        </View>
        <Ionicons color={colors.textMuted} name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>

      {showAdvancedPanel ? (
        <View style={styles.advancedPanel}>
          {effortEnabled ? (
            <RpeSelector onChange={(value) => onRpeChange?.(value)} value={rpe} />
          ) : null}
          <SetNotesInput onChange={(value) => onNotesChange?.(value)} value={notes} />
        </View>
      ) : null}

      {isResting ? (
        <View style={styles.restHint}>
          <View style={styles.restHintIcon}>
            <Ionicons color={colors.primary} name="timer-outline" size={16} />
          </View>
          <View style={styles.restHintText}>
            <AppText variant="caption" weight="900" style={styles.restHintTitle}>
              休息 {formatCompactTimer(restSeconds)}
            </AppText>
            <AppText numberOfLines={1} tone="muted" variant="caption">
              {nextMemberName ? `下一位 ${nextMemberName}` : nextSetLabel ?? `建议 ${formatCompactTimer(plannedRestSeconds)}`}
              {restElapsedSeconds !== undefined ? ` · 已休 ${formatCompactTimer(restElapsedSeconds)}` : ''}
            </AppText>
          </View>
        </View>
      ) : null}

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
          {isCompletingSet ? '处理中…' : '完成本组'}
        </AppText>
      </Pressable>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  advancedPanel: {
    gap: spacing.sm,
  },
  advancedToggle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 38,
    paddingHorizontal: spacing.md,
  },
  advancedToggleText: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
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
  restHint: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  restHintIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  restHintText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  restHintTitle: {
    color: colors.primary,
  },
});
