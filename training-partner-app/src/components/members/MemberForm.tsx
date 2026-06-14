import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, SectionHeader, VisualHeroCard } from '@/components/ui';
import { liftmarkImages } from '@/assets/images';
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
  onSubmit(values: MemberFormValues): void | Promise<void>;
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
  submitLabel,
  isSubmitting = false,
  onSubmit,
}: MemberFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues: {
      ...defaultMemberFormValues,
      ...initialValues,
    },
  });

  return (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', default: undefined })}>
      <View style={styles.container}>
        <VisualHeroCard
          eyebrow="训练搭子"
          icon="people-outline"
          imageSource={liftmarkImages.partnerHero}
          minHeight={176}
          subtitle="更智能的推荐，更高效的多人轮换。"
          title="创建训练搭子 保存常用训练参数"
        />

        <AppCard style={styles.section}>
          <SectionHeader subtitle="为你的搭子起个名字吧，可以随时修改。" title="基础信息" />
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
          <SectionHeader subtitle="可留空，稍后随时补充。" title="训练参数" />
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

        <AppCard style={styles.helpCard} tone="brand">
          <View style={styles.helpTitle}>
            <View style={styles.helpIcon}>
              <Ionicons color={colors.surface} name="help-outline" size={20} />
            </View>
            <AppText variant="subtitle">这些数据会用于什么？</AppText>
          </View>
          <View style={styles.helpGrid}>
            <HelpItem icon="navigate-outline" title="推荐重量" description="智能推荐合适的训练重量" />
            <HelpItem icon="people-outline" title="多人轮换" description="快速匹配与切换搭子" />
            <HelpItem icon="bar-chart-outline" title="训练建议" description="个性化训练计划与建议" />
          </View>
        </AppCard>

        <AppButton disabled={isSubmitting} icon="save-outline" onPress={handleSubmit(onSubmit)} size="lg">
          {isSubmitting ? '保存中...' : submitLabel}
        </AppButton>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert('稍后补充', '昵称需要先填写，其他训练参数可以留空后再补充。')}
          style={styles.laterButton}
        >
          <AppText tone="muted" variant="bodySmall" weight="900">
            稍后补充
          </AppText>
        </Pressable>
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

function HelpItem({ description, icon, title }: { description: string; icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return (
    <View style={styles.helpItem}>
      <Ionicons color={colors.text} name={icon} size={20} />
      <AppText variant="bodySmall" weight="900">
        {title}
      </AppText>
      <AppText tone="muted" variant="caption">
        {description}
      </AppText>
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
  helpCard: {
    gap: spacing.md,
  },
  helpTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  helpIcon: {
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  helpGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  helpItem: {
    flex: 1,
    gap: spacing.xs,
  },
  laterButton: {
    alignItems: 'center',
    paddingBottom: spacing.md,
    paddingTop: spacing.xs,
  },
});
