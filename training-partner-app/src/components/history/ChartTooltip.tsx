import { View, StyleSheet } from 'react-native';

import { AppText, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type ChartTooltipMetric = {
  label: string;
  value: string;
};

type ChartTooltipProps = {
  metrics?: ChartTooltipMetric[];
  subtitle?: string;
  title: string;
  tone?: 'neutral' | 'success' | 'warning';
};

export function ChartTooltip({ metrics = [], subtitle, title, tone = 'neutral' }: ChartTooltipProps) {
  return (
    <View style={styles.tooltip}>
      <View style={styles.header}>
        <View style={styles.titleBlock}>
          <AppText numberOfLines={1} variant="bodySmall" weight="900">
            {title}
          </AppText>
          {subtitle ? (
            <AppText numberOfLines={2} tone="muted" variant="caption">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <Tag label="详情" tone={tone} />
      </View>
      {metrics.length > 0 ? (
        <View style={styles.metricRow}>
          {metrics.map((metric) => (
            <View key={`${metric.label}-${metric.value}`} style={styles.metric}>
              <AppText numberOfLines={1} variant="caption" weight="900">
                {metric.value}
              </AppText>
              <AppText numberOfLines={1} tone="muted" variant="caption">
                {metric.label}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  metric: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    flexGrow: 1,
    minWidth: '30%',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  tooltip: {
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
});
