import { ScrollView, StyleSheet, View } from 'react-native';

import { AppCard, AppText, EmptyState, Tag } from '@/components/ui';
import { describeSchemeGoal, describeSchemeLevel } from '@/domain/plan/systemSchemes';
import { colors, radius, spacing } from '@/theme';

import {
  formatPlanExerciseIntensity,
  formatPlanExercisePrescription,
  type SystemSchemePreview,
} from './systemSchemePreview';

type Props = {
  onSelectWeek: (week: number) => void;
  preview: SystemSchemePreview;
  selectedWeek: number;
};

export function SystemSchemeDetailContent({ onSelectWeek, preview, selectedWeek }: Props) {
  const week = preview.weeks.find((item) => item.week === selectedWeek) ?? preview.weeks[0];
  return (
    <View style={styles.container}>
      <AppCard style={styles.hero} tone="dark">
        <View style={styles.heroTopline}>
          <AppText tone="inverse" variant="caption">系统训练方案</AppText>
          <Tag
            label={preview.availability === 'ready' ? '完整可用' : preview.availability === 'metadata_only' ? '仅元数据' : '暂不可用'}
            tone={preview.availability === 'ready' ? 'success' : 'neutral'}
          />
        </View>
        <AppText tone="inverse" variant="headline">{preview.scheme.title}</AppText>
        <AppText style={styles.heroSubtitle} variant="bodySmall">{preview.scheme.subtitle}</AppText>
        <View style={styles.tags}>
          <Tag label={describeSchemeGoal(preview.scheme.goal)} tone="brand" />
          <Tag label={describeSchemeLevel(preview.scheme.level)} tone="accent" />
          <Tag label={`每周 ${preview.scheme.frequencyPerWeek} 天`} tone="neutral" />
          <Tag label={`${preview.scheme.durationWeeks} 周`} tone="neutral" />
        </View>
      </AppCard>

      <View style={styles.summary}>
        <AppText variant="subtitle">适合谁</AppText>
        <AppText tone="muted" variant="bodySmall">{preview.scheme.audience}</AppText>
        <View style={styles.factGrid}>
          <Fact label="训练结构" value={preview.scheme.dayStructure} />
          <Fact label="器械条件" value={preview.scheme.equipmentRequirement} />
          <Fact label="经验要求" value={preview.scheme.experienceRequirement} />
        </View>
        <AppText tone="muted" variant="bodySmall">{preview.scheme.description}</AppText>
      </View>

      {preview.fallbackMessage ? (
        <EmptyState title="完整结构暂时不可预览" description={preview.fallbackMessage} />
      ) : null}

      {preview.weeks.length > 0 ? (
        <>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitle}>
              <AppText variant="title">完整训练结构</AppText>
              <AppText tone="muted" variant="caption">
                {preview.hasRepeatedWeeklyStructure
                  ? '各周沿用相同训练结构，处方可在复制后编辑。'
                  : '按周查看阶段、训练日和动作处方。'}
              </AppText>
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekTabs}>
            {preview.weeks.map((item) => {
              const selected = item.week === week?.week;
              return (
                <AppText
                  accessibilityRole="button"
                  key={item.week}
                  onPress={() => onSelectWeek(item.week)}
                  style={[styles.weekTab, selected && styles.weekTabSelected]}
                  tone={selected ? 'inverse' : 'muted'}
                  variant="caption"
                >
                  第 {item.week} 周
                </AppText>
              );
            })}
          </ScrollView>
          {week ? (
            <View style={styles.weekContent}>
              <View style={styles.phaseLine}>
                <AppText variant="subtitle">第 {week.week} 周</AppText>
                <Tag label={week.phaseName} tone="accent" />
              </View>
              {week.days.map((item, index) => (
                <AppCard key={item.day.id} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <View style={styles.dayTitle}>
                      <AppText tone="brand" variant="caption">训练日 {index + 1}</AppText>
                      <AppText variant="subtitle">{item.day.title}</AppText>
                      <AppText tone="muted" variant="caption">{item.day.focus}</AppText>
                    </View>
                    <View style={styles.dayStats}>
                      <AppText variant="caption" weight="800">{item.exercises.length} 个动作 · {item.totalSets} 组</AppText>
                      <AppText tone="muted" variant="caption">约 {item.estimatedMinutes.min}-{item.estimatedMinutes.max} 分钟</AppText>
                    </View>
                  </View>
                  <View style={styles.exerciseList}>
                    {item.exercises.map(({ name, prescription, unresolved }) => (
                      <View key={prescription.id} style={styles.exerciseRow}>
                        <Tag label={prescription.priority} tone={prescription.priority === 'A' ? 'brand' : 'neutral'} />
                        <View style={styles.exerciseBody}>
                          <View style={styles.exerciseHeading}>
                            <AppText variant="bodySmall" weight="800">{name}</AppText>
                            {unresolved ? <Tag label="待补齐" tone="neutral" /> : null}
                          </View>
                          <AppText tone="muted" variant="caption">
                            {formatPlanExercisePrescription(prescription)} · {formatPlanExerciseIntensity(prescription)}
                            {prescription.restSeconds ? ` · 休息 ${prescription.restSeconds} 秒` : ''}
                          </AppText>
                          {prescription.notes ? (
                            <AppText numberOfLines={3} tone="subtle" variant="caption">{prescription.notes}</AppText>
                          ) : null}
                        </View>
                      </View>
                    ))}
                    {item.exercises.length === 0 ? (
                      <AppText tone="muted" variant="caption">该训练日尚未配置动作。</AppText>
                    ) : null}
                  </View>
                </AppCard>
              ))}
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fact}>
      <AppText tone="subtle" variant="caption">{label}</AppText>
      <AppText variant="bodySmall" weight="800">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xl },
  dayCard: { gap: spacing.lg },
  dayHeader: { flexDirection: 'row', gap: spacing.md, justifyContent: 'space-between' },
  dayStats: { alignItems: 'flex-end', gap: spacing.xs },
  dayTitle: { flex: 1, gap: spacing.xs },
  exerciseBody: { flex: 1, gap: spacing.xs },
  exerciseHeading: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  exerciseList: { gap: spacing.md },
  exerciseRow: { alignItems: 'flex-start', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  fact: { backgroundColor: colors.surfaceMuted, borderRadius: radius.md, flexBasis: '47%', flexGrow: 1, gap: spacing.xs, padding: spacing.md },
  factGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hero: { gap: spacing.md },
  heroSubtitle: { color: colors.darkMuted },
  heroTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  phaseLine: { alignItems: 'center', flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  sectionHeader: { flexDirection: 'row' },
  sectionTitle: { flex: 1, gap: spacing.xs },
  summary: { gap: spacing.md },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  weekContent: { gap: spacing.md },
  weekTab: { backgroundColor: colors.surfaceMuted, borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  weekTabSelected: { backgroundColor: colors.dark },
  weekTabs: { gap: spacing.sm, paddingRight: spacing.lg },
});
