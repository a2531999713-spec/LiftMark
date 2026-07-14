import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppModalSheet, AppText, Tag } from '@/components/ui';
import type { Exercise } from '@/domain/exercise/exercise.types';
import type { ExercisePriority, IntensityType, ReferenceLift } from '@/domain/plan/plan.types';
import type { PlanExerciseDraft } from '@/components/plan/planEditTypes';
import { kgToLb, lbToKg } from '@/domain/preferences/user-preferences.types';
import { colors, radius, spacing, typography } from '@/theme';

type PlanExerciseSettingsSheetProps = {
  exercise?: Exercise;
  draft?: PlanExerciseDraft;
  onChange: (patch: Partial<PlanExerciseDraft>) => void;
  onClose: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReplace: () => void;
  onSave: () => void;
  visible: boolean;
  weightUnit?: 'kg' | 'lb';
};

const priorityOptions: { label: string; sublabel: string; value: ExercisePriority }[] = [
  { label: 'A', sublabel: '必做', value: 'A' },
  { label: 'B', sublabel: '建议', value: 'B' },
  { label: 'C', sublabel: '可选', value: 'C' },
];

const intensityOptions: { icon: keyof typeof Ionicons.glyphMap; label: string; value: IntensityType }[] = [
  { icon: 'hand-left-outline', label: '手动', value: 'manual' },
  { icon: 'stats-chart-outline', label: '百分比 1RM', value: 'percent_1rm' },
  { icon: 'disc-outline', label: '固定重量', value: 'fixed' },
];

const referenceLiftOptions: { label: string; value: ReferenceLift }[] = [
  { label: '卧推 1RM', value: 'bench' },
  { label: '深蹲 1RM', value: 'squat' },
  { label: '硬拉 1RM', value: 'deadlift' },
  { label: '推举 1RM', value: 'overhead_press' },
  { label: '不指定', value: 'none' },
];

export function PlanExerciseSettingsSheet({
  draft,
  exercise,
  onChange,
  onClose,
  onDelete,
  onDuplicate,
  onReplace,
  onSave,
  visible,
  weightUnit = 'kg',
}: PlanExerciseSettingsSheetProps) {
  if (!draft) {
    return null;
  }

  const isRangeMode = draft.repMin !== null && draft.repMin !== undefined;
  const percentValue = draft.percent1RM !== null && draft.percent1RM !== undefined ? `${Math.round(draft.percent1RM * 100)}` : '';
  const fixedWeight =
    draft.fixedWeight !== null && draft.fixedWeight !== undefined
      ? `${weightUnit === 'lb' ? Math.round(kgToLb(draft.fixedWeight) * 10) / 10 : draft.fixedWeight}`
      : '';

  return (
    <AppModalSheet
      footer={
        <View style={styles.footer}>
          <AppButton icon="trash-outline" onPress={onDelete} variant="danger">
            删除动作
          </AppButton>
          <AppButton icon="copy-outline" onPress={onDuplicate} variant="secondary">
            复制动作
          </AppButton>
          <AppButton icon="save-outline" onPress={onSave}>
            保存
          </AppButton>
        </View>
      }
      onClose={onClose}
      subtitle={`${exercise?.name ?? '训练动作'} · 每个动作独立配置，避免整天共用组次`}
      title="动作设置"
      visible={visible}
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <AppCard style={styles.rowCard} padded={false}>
            <View style={styles.exerciseSelectRow}>
              <View>
                <AppText tone="muted" variant="caption">
                  动作
                </AppText>
                <AppText variant="bodySmall" weight="900">
                  {exercise?.name ?? '训练动作'}
                </AppText>
              </View>
              <Pressable accessibilityRole="button" onPress={onReplace} style={styles.linkButton}>
                <AppText tone="brand" variant="bodySmall" weight="900">
                  更换
                </AppText>
                <Ionicons color={colors.brand} name="chevron-forward" size={16} />
              </Pressable>
            </View>
          </AppCard>

          <FieldGroup title="优先级">
            <View style={styles.optionGrid}>
              {priorityOptions.map((option) => {
                const active = draft.priority === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() => onChange({ priority: option.value })}
                    style={[styles.optionCard, active && styles.optionCardActive]}
                  >
                    <Tag label={option.label} tone={active ? 'brand' : 'neutral'} />
                    <AppText tone={active ? 'brand' : 'muted'} variant="bodySmall" weight="900">
                      {option.sublabel}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>
          </FieldGroup>

          <FieldGroup title="计划组次">
            <View style={styles.fieldGrid}>
              <Stepper label="组数" maximum={20} minimum={1} suffix="组" onChange={(sets) => onChange({ sets })} value={draft.sets} />
              <ToggleField
                label="次数模式"
                options={[
                  { label: '固定', value: 'fixed' },
                  { label: '范围', value: 'range' },
                ]}
                onChange={(value) => {
                  if (value === 'range') {
                    onChange({ reps: null, repMin: draft.repMin ?? draft.reps ?? 8, repMax: draft.repMax ?? 12 });
                  } else {
                    onChange({ reps: draft.reps ?? draft.repMin ?? 8, repMin: null, repMax: null });
                  }
                }}
                value={isRangeMode ? 'range' : 'fixed'}
              />
              {isRangeMode ? (
                <>
                  <Stepper label="最小次数" maximum={100} minimum={1} suffix="次" onChange={(repMin) => onChange({ repMin })} value={draft.repMin ?? 8} />
                  <Stepper label="最大次数" maximum={100} minimum={1} suffix="次" onChange={(repMax) => onChange({ repMax })} value={draft.repMax ?? 12} />
                </>
              ) : (
                <Stepper label="次数" maximum={100} minimum={1} suffix="次" onChange={(reps) => onChange({ reps })} value={draft.reps ?? 8} />
              )}
            </View>
          </FieldGroup>

          <FieldGroup title="强度模式">
            <View style={styles.optionGrid}>
              {intensityOptions.map((option) => {
                const active = draft.intensityType === option.value;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={option.value}
                    onPress={() => onChange({ intensityType: option.value })}
                    style={[styles.optionCard, active && styles.optionCardActive]}
                  >
                    <Ionicons color={active ? colors.brand : colors.textMuted} name={option.icon} size={18} />
                    <AppText tone={active ? 'brand' : 'muted'} variant="bodySmall" weight="900">
                      {option.label}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            {draft.intensityType === 'manual' ? (
              <AppCard style={styles.hintCard} tone="soft">
                <AppText tone="muted" variant="caption">
                  手动模式不预设重量，训练时按现场状态填写。
                </AppText>
              </AppCard>
            ) : null}

            {draft.intensityType === 'percent_1rm' ? (
              <View style={styles.fieldGrid}>
                <InputField
                  keyboardType="decimal-pad"
                  label="百分比"
                  onChangeText={(value) => {
                    const parsed = Number(value);
                    onChange({ percent1RM: Number.isFinite(parsed) ? parsed / 100 : null });
                  }}
                  suffix="%"
                  value={percentValue}
                />
                <ToggleField
                  label="参考主项"
                  options={referenceLiftOptions}
                  onChange={(referenceLift) => onChange({ referenceLift: referenceLift as ReferenceLift })}
                  value={draft.referenceLift}
                />
              </View>
            ) : null}

            {draft.intensityType === 'fixed' ? (
              <InputField
                keyboardType="decimal-pad"
                label="重量"
                onChangeText={(value) => {
                  const parsed = Number(value);
                  onChange({ fixedWeight: Number.isFinite(parsed) ? (weightUnit === 'lb' ? lbToKg(parsed) : parsed) : null });
                }}
                suffix={weightUnit}
                value={fixedWeight}
              />
            ) : null}
          </FieldGroup>

          <FieldGroup title="休息与备注">
            <View style={styles.fieldGrid}>
              <Stepper
                label="休息时间"
                maximum={600}
                minimum={0}
                step={30}
                suffix="秒"
                onChange={(restSeconds) => onChange({ restSeconds })}
                value={draft.restSeconds ?? 90}
              />
              <InputField
                label="备注"
                onChangeText={(notes) => onChange({ notes })}
                value={draft.notes ?? ''}
              />
            </View>
          </FieldGroup>
        </View>
      </ScrollView>
    </AppModalSheet>
  );
}

function FieldGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <View style={styles.group}>
      <AppText variant="subtitle">{title}</AppText>
      {children}
    </View>
  );
}

function Stepper({
  label,
  maximum,
  minimum = 1,
  onChange,
  step = 1,
  suffix,
  value,
}: {
  label: string;
  maximum?: number;
  minimum?: number;
  onChange: (value: number) => void;
  step?: number;
  suffix: string;
  value: number;
}) {
  return (
    <View style={styles.inputCard}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.stepperRow}>
        <Pressable accessibilityRole="button" onPress={() => onChange(Math.max(minimum, value - step))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="remove-outline" size={17} />
        </Pressable>
        <AppText variant="bodySmall" weight="900">
          {value} {suffix}
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => onChange(maximum === undefined ? value + step : Math.min(maximum, value + step))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="add-outline" size={17} />
        </Pressable>
      </View>
    </View>
  );
}

function InputField({
  keyboardType = 'default',
  label,
  onChangeText,
  suffix,
  value,
}: {
  keyboardType?: 'default' | 'decimal-pad';
  label: string;
  onChangeText: (value: string) => void;
  suffix?: string;
  value: string;
}) {
  return (
    <View style={styles.inputCard}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.inputRow}>
        <TextInput
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder="-"
          placeholderTextColor={colors.textSubtle}
          style={styles.input}
          value={value}
        />
        {suffix ? (
          <AppText tone="muted" variant="bodySmall">
            {suffix}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function ToggleField<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.inputCard}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.toggleWrap}>
        {options.map((option) => {
          const active = value === option.value;
          return (
            <Pressable
              accessibilityRole="button"
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.toggleChip, active && styles.toggleChipActive]}
            >
              <AppText tone={active ? 'brand' : 'muted'} variant="caption" weight="900">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing.lg,
    paddingBottom: spacing.md,
  },
  exerciseSelectRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 56,
    padding: spacing.md,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  group: {
    gap: spacing.md,
  },
  hintCard: {
    padding: spacing.md,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 28,
    padding: 0,
  },
  inputCard: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: '46%',
    padding: spacing.md,
  },
  inputRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  linkButton: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    minHeight: 40,
  },
  optionCard: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 50,
    minWidth: '30%',
    padding: spacing.sm,
  },
  optionCardActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  rowCard: {
    overflow: 'hidden',
  },
  scroll: {
    maxHeight: 560,
  },
  stepButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  stepperRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  toggleChipActive: {
    backgroundColor: colors.brandSoft,
    borderColor: colors.brand,
  },
  toggleWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});
