import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, SectionHeader, Tag } from '@/components/ui';
import {
  defaultMemberFormValues,
  type MemberFormValues,
  memberFormSchema,
} from '@/domain/member/member.validation';
import { colors, radius, spacing, typography } from '@/theme';

type MemberFormProps = {
  initialValues?: Partial<MemberFormValues>;
  submitLabel: string;
  isSubmitting?: boolean;
  identityNote?: string;
  onSubmit(values: MemberFormValues): void | Promise<void>;
  statusMessage?: string | null;
};

type NumberFieldName = Exclude<keyof MemberFormValues, 'displayName'>;

const oneRmFields: { name: NumberFieldName; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { name: 'bodyweight', label: '体重', icon: 'scale-outline' },
  { name: 'bench1RM', label: '卧推 1RM', icon: 'barbell-outline' },
  { name: 'squat1RM', label: '深蹲 1RM', icon: 'body-outline' },
  { name: 'deadlift1RM', label: '硬拉 1RM', icon: 'barbell-outline' },
  { name: 'overheadPress1RM', label: '肩推 1RM', icon: 'accessibility-outline' },
  { name: 'pullupReferenceWeight', label: '引体参考重量', icon: 'fitness-outline' },
];

const incrementFields: { name: NumberFieldName; label: string }[] = [
  { name: 'barbellIncrement', label: '杠铃加重单位' },
  { name: 'dumbbellIncrement', label: '哑铃加重单位' },
];

function formatNumberInput(value: number | undefined): string {
  return value === undefined || Number.isNaN(value) ? '' : String(value);
}

function parseOptionalNumber(value: string): number | undefined {
  const trimmed = value.trim().replace(',', '.');
  if (!trimmed) {
    return undefined;
  }

  return Number(trimmed);
}

export function MemberForm({
  initialValues,
  identityNote,
  submitLabel,
  isSubmitting = false,
  onSubmit,
  statusMessage,
}: MemberFormProps) {
  const initialBarbellIncrement = initialValues?.barbellIncrement;
  const initialBench1RM = initialValues?.bench1RM;
  const initialBodyweight = initialValues?.bodyweight;
  const initialDeadlift1RM = initialValues?.deadlift1RM;
  const initialDisplayName = initialValues?.displayName;
  const initialDumbbellIncrement = initialValues?.dumbbellIncrement;
  const initialOverheadPress1RM = initialValues?.overheadPress1RM;
  const initialPullupReferenceWeight = initialValues?.pullupReferenceWeight;
  const initialSquat1RM = initialValues?.squat1RM;
  const defaultValues = useMemo(
    () => ({
      barbellIncrement: initialBarbellIncrement ?? defaultMemberFormValues.barbellIncrement,
      bench1RM: initialBench1RM,
      bodyweight: initialBodyweight,
      deadlift1RM: initialDeadlift1RM,
      displayName: initialDisplayName ?? defaultMemberFormValues.displayName,
      dumbbellIncrement: initialDumbbellIncrement ?? defaultMemberFormValues.dumbbellIncrement,
      overheadPress1RM: initialOverheadPress1RM,
      pullupReferenceWeight: initialPullupReferenceWeight,
      squat1RM: initialSquat1RM,
    }),
    [
      initialBarbellIncrement,
      initialBench1RM,
      initialBodyweight,
      initialDeadlift1RM,
      initialDisplayName,
      initialDumbbellIncrement,
      initialOverheadPress1RM,
      initialPullupReferenceWeight,
      initialSquat1RM,
    ],
  );
  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isValid },
  } = useForm<MemberFormValues>({
    mode: 'onChange',
    resolver: zodResolver(memberFormSchema),
    defaultValues,
  });
  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);
  const hasInitialValues = Boolean(initialValues?.displayName);
  const canSubmit = isDirty && isValid && !isSubmitting;
  const saveLabel = isSubmitting
    ? '保存中...'
    : isDirty
      ? submitLabel
      : hasInitialValues ? '已保存' : '填写后可保存';

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <View style={styles.container}>
        {statusMessage ? (
          <AppCard style={styles.statusCard} tone="soft">
            <Ionicons color={colors.success} name="checkmark-circle-outline" size={20} />
            <AppText variant="bodySmall" weight="900">
              {statusMessage}
            </AppText>
          </AppCard>
        ) : null}

        {identityNote ? (
          <AppCard style={styles.identityCard}>
            <View style={styles.identityIcon}>
              <Ionicons color={colors.primary} name="person-circle-outline" size={20} />
            </View>
            <View style={styles.identityText}>
              <AppText variant="bodySmall" weight="900">
                成员身份
              </AppText>
              <AppText tone="muted" variant="caption">
                {identityNote}
              </AppText>
            </View>
          </AppCard>
        ) : null}

        <AppCard style={styles.section}>
          <SectionHeader title="基础信息" />
          <Controller
            control={control}
            name="displayName"
            render={({ field: { onBlur, onChange, value } }) => (
              <InputBox
                autoCapitalize="words"
                autoCorrect={false}
                error={errors.displayName?.message}
                label="昵称"
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder="请输入昵称"
                value={value}
              />
            )}
          />
        </AppCard>

        <AppCard style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <SectionHeader title="训练参数" />
            <Tag label="可选" tone="neutral" />
          </View>
          <View style={styles.paramGrid}>
            {oneRmFields.map((field) => (
              <Controller
                control={control}
                key={field.name}
                name={field.name}
                render={({ field: { onBlur, onChange, value } }) => (
                  <ParamInput
                    error={errors[field.name]?.message}
                    icon={field.icon}
                    label={field.label}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(parseOptionalNumber(text))}
                    value={formatNumberInput(value)}
                  />
                )}
              />
            ))}
          </View>
        </AppCard>

        <AppCard style={styles.section}>
          <SectionHeader title="加重单位" />
          <View style={styles.paramGrid}>
            {incrementFields.map((field) => (
              <Controller
                control={control}
                key={field.name}
                name={field.name}
                render={({ field: { onBlur, onChange, value } }) => (
                  <InputBox
                    error={errors[field.name]?.message}
                    keyboardType="decimal-pad"
                    label={field.label}
                    onBlur={onBlur}
                    onChangeText={(text) => onChange(parseOptionalNumber(text))}
                    value={formatNumberInput(value)}
                  />
                )}
              />
            ))}
          </View>
        </AppCard>

        <AppButton disabled={!canSubmit} icon="save-outline" onPress={handleSubmit(onSubmit)} size="lg">
          {saveLabel}
        </AppButton>
      </View>
    </KeyboardAvoidingView>
  );
}

type InputBoxProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  error?: string;
  keyboardType?: 'default' | 'decimal-pad';
  label: string;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
};

function InputBox({
  autoCapitalize,
  autoCorrect,
  error,
  keyboardType = 'default',
  label,
  onBlur,
  onChangeText,
  placeholder,
  value,
}: InputBoxProps) {
  return (
    <View style={styles.inputBox}>
      <AppText variant="bodySmall" weight="900">
        {label}
      </AppText>
      <TextInput
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        keyboardType={keyboardType}
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
      {error ? (
        <AppText tone="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

function ParamInput({
  error,
  icon,
  label,
  onBlur,
  onChangeText,
  value,
}: {
  error?: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onBlur?: () => void;
  onChangeText: (value: string) => void;
  value: string;
}) {
  return (
    <View style={styles.paramBox}>
      <View style={styles.paramHeader}>
        <View style={styles.paramIcon}>
          <Ionicons color={colors.primary} name={icon} size={20} />
        </View>
        <AppText variant="bodySmall" weight="900">
          {label}
        </AppText>
        <AppText tone="muted" variant="caption">
          kg
        </AppText>
      </View>
      <TextInput
        keyboardType="decimal-pad"
        onBlur={onBlur}
        onChangeText={onChangeText}
        placeholder="请输入"
        placeholderTextColor={colors.textSubtle}
        style={styles.input}
        value={value}
      />
      {error ? (
        <AppText tone="danger" variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  section: {
    gap: spacing.md,
  },
  statusCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  identityCard: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  identityIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  sectionTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputBox: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 32,
  },
  paramGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  paramBox: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    minWidth: '47%',
    padding: spacing.md,
  },
  paramHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  paramIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.sm,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
});
