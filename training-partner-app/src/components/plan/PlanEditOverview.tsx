import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton, AppCard, AppText, SectionHeader, Tag } from '@/components/ui';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { colors, radius, spacing, typography } from '@/theme';

import { PlanDayList } from './PlanDayList';
import type { PlanEditDraft, PlanExerciseMap } from './planEditTypes';

type PlanEditOverviewProps = {
  draft: PlanEditDraft;
  exerciseMap: PlanExerciseMap;
  isSaving: boolean;
  onAddDay: () => void;
  onChange: (patch: Partial<PlanEditDraft>) => void;
  onDeleteDay: (dayId: string) => void;
  onOpenDay: (dayId: string) => void;
  onSave: () => void;
  planSource: PlanTemplate['source'];
};

const goalOptions: { label: string; value: PlanTemplate['goal'] }[] = [
  { label: '增力', value: 'strength' },
  { label: '增肌', value: 'hypertrophy' },
  { label: '减脂', value: 'fat_loss' },
  { label: '通用', value: 'general' },
  { label: '自定义', value: 'custom' },
];

export function PlanEditOverview({
  draft,
  exerciseMap,
  isSaving,
  onAddDay,
  onChange,
  onDeleteDay,
  onOpenDay,
  onSave,
  planSource,
}: PlanEditOverviewProps) {
  return (
    <>
      <AppCard style={styles.hero} tone="brand">
        <View style={styles.heroHeader}>
          <View style={styles.heroIcon}>
            <Ionicons color={colors.primary} name="create-outline" size={22} />
          </View>
          <View style={styles.heroText}>
            <AppText variant="subtitle">分层编辑计划</AppText>
            <AppText tone="muted" variant="bodySmall">
              这里只改后续训练读取，不影响历史记录。
            </AppText>
          </View>
          <Tag label={planSource === 'system' ? '只读' : '可编辑'} tone={planSource === 'system' ? 'warning' : 'success'} />
        </View>
        <View style={styles.metricRow}>
          <Metric label="训练日" value={`${draft.days.length}`} />
          <Metric label="周期" value={`${draft.durationWeeks} 周`} />
          <Metric label="频率" value={`${draft.frequencyPerWeek} 天/周`} />
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader subtitle="先保存计划摘要，具体动作进入训练日编辑。" title="计划信息" />
        <Field label="计划名称" onChangeText={(name) => onChange({ name })} value={draft.name} />
        <View style={styles.goalRow}>
          {goalOptions.map((goal) => (
            <Pressable
              accessibilityRole="button"
              key={goal.value}
              onPress={() => onChange({ goal: goal.value })}
              style={[styles.goalChip, draft.goal === goal.value && styles.goalChipActive]}
            >
              <AppText tone={draft.goal === goal.value ? 'inverse' : 'default'} variant="caption" weight="900">
                {goal.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <View style={styles.fieldGrid}>
          <NumberField
            label="周期周数"
            onChange={(durationWeeks) => onChange({ durationWeeks })}
            value={draft.durationWeeks}
          />
          <NumberField
            label="每周训练天数"
            onChange={(frequencyPerWeek) => onChange({ frequencyPerWeek })}
            value={draft.frequencyPerWeek}
          />
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <SectionHeader actionLabel="新增训练日" onActionPress={onAddDay} subtitle="点击训练日进入动作、组数和次数编辑。" title="训练日" />
        <PlanDayList days={draft.days} exerciseMap={exerciseMap} onDeleteDay={onDeleteDay} onOpenDay={onOpenDay} />
      </AppCard>

      <AppButton disabled={isSaving} icon="save-outline" loading={isSaving} onPress={onSave} size="lg">
        保存计划
      </AppButton>
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <AppText variant="bodySmall" weight="900">
        {value}
      </AppText>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
    </View>
  );
}

function Field({ label, onChangeText, value }: { label: string; onChangeText: (value: string) => void; value: string }) {
  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <TextInput onChangeText={onChangeText} style={styles.input} value={value} />
    </View>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <View style={styles.field}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.stepperControls}>
        <Pressable accessibilityRole="button" onPress={() => onChange(Math.max(1, value - 1))} style={styles.stepButton}>
          <Ionicons color={colors.text} name="remove-outline" size={18} />
        </Pressable>
        <AppText variant="bodySmall" weight="900">
          {value}
        </AppText>
        <Pressable accessibilityRole="button" onPress={() => onChange(value + 1)} style={styles.stepButton}>
          <Ionicons color={colors.text} name="add-outline" size={18} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  field: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flex: 1,
    gap: spacing.xs,
    minWidth: '46%',
    padding: spacing.md,
  },
  fieldGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  goalChip: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  goalChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  goalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  hero: {
    gap: spacing.md,
  },
  heroHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  input: {
    color: colors.text,
    fontSize: typography.sizes.bodySmall,
    fontWeight: '800',
    minHeight: 30,
    padding: 0,
  },
  metric: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    flex: 1,
    gap: 2,
    padding: spacing.md,
  },
  metricRow: {
    flexDirection: 'row',
    gap: spacing.sm,
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
  stepperControls: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
