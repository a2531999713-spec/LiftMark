import { Pressable, StyleSheet, View } from 'react-native';

import { AppCard, AppText, Tag } from '@/components/ui';
import type { RecoveryAssessmentResult } from '@/domain/recovery/recovery.types';
import { colors, radius, spacing } from '@/theme';

import { getRecoveryCardCopy, getRecoveryTone } from './recoveryPresentation';

type RecoveryStatusCardProps = {
  assessment: RecoveryAssessmentResult | null;
  error?: boolean;
  loading?: boolean;
  onPress: () => void;
};

export function RecoveryStatusCard({ assessment, error = false, loading = false, onPress }: RecoveryStatusCardProps) {
  if (loading) {
    return (
      <AppCard style={styles.card}>
        <View style={styles.loadingTitle} />
        <View style={styles.loadingBody} />
      </AppCard>
    );
  }

  const tone = assessment ? getRecoveryTone(assessment) : 'brand';
  const copy = getRecoveryCardCopy(assessment, error);
  const toneStyle =
    tone === 'success'
      ? styles.success
      : tone === 'warning'
        ? styles.warning
        : tone === 'danger' || tone === 'dangerSoft'
          ? styles.danger
          : styles.brand;

  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      <AppCard style={[styles.card, toneStyle]}>
        <View style={styles.header}>
          <View style={styles.copy}>
            <AppText variant="subtitle" weight="900">
              {copy.title}
            </AppText>
            <AppText tone="muted" variant="bodySmall">
              {copy.summary}
            </AppText>
          </View>
          {assessment ? <Tag label={`${assessment.totalScore} 分`} tone={tone === 'success' ? 'success' : tone === 'warning' ? 'warning' : tone === 'brand' ? 'brand' : 'danger'} /> : null}
        </View>
        <View style={styles.footer}>
          <AppText tone="muted" variant="caption" weight="800">
            {copy.status}
          </AppText>
          <View style={styles.action}>
            <AppText tone="brand" variant="caption" weight="900">
              {copy.action}
            </AppText>
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  brand: { backgroundColor: colors.primarySoft },
  card: { gap: spacing.sm, padding: spacing.md },
  copy: { flex: 1, gap: 2 },
  danger: { backgroundColor: colors.dangerSoft },
  footer: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: spacing.sm },
  loadingBody: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 16, width: '76%' },
  loadingTitle: { backgroundColor: colors.surfaceMuted, borderRadius: radius.sm, height: 20, width: '42%' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  success: { backgroundColor: colors.successSoft },
  warning: { backgroundColor: colors.warningSoft },
});
