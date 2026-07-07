import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar, AppCard, AppText, MiniLineChart, MultiLineTrendChart, Tag } from '@/components/ui';
import type { MultiLineTrendSeries } from '@/components/ui/MultiLineTrendChart';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type MetricItem = {
  delta?: string;
  icon?: IconName;
  label: string;
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral';
  unit?: string;
  value: string;
};

export function PageHeader({
  right,
  subtitle,
  title,
}: {
  right?: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <View style={styles.pageHeader}>
      <View style={styles.headerText}>
        <AppText variant="headline" weight="900">
          {title}
        </AppText>
        {subtitle ? (
          <AppText tone="muted" variant="bodySmall">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right}
    </View>
  );
}

export function IconButton({
  accessibilityLabel,
  icon,
  label,
  onPress,
}: {
  accessibilityLabel?: string;
  icon: IconName;
  label?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.iconButton, !label && styles.iconButtonCompact]}
    >
      <Ionicons color={colors.primary} name={icon} size={20} />
      {label ? (
        <AppText tone="brand" variant="caption" weight="900">
          {label}
        </AppText>
      ) : null}
    </Pressable>
  );
}

export function BackHeader({ right, title }: { right?: ReactNode; title: string }) {
  return (
    <View style={styles.backHeader}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
        <Ionicons color={colors.textStrong} name="chevron-back" size={23} />
      </Pressable>
      <AppText style={styles.backTitle} variant="title" weight="900">
        {title}
      </AppText>
      <View style={styles.backRight}>{right}</View>
    </View>
  );
}

export function SegmentControl<T extends string>({
  onChange,
  options,
  value,
}: {
  onChange: (value: T) => void;
  options: { icon?: IconName; label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.segment}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segmentItem, active && styles.segmentItemActive]}
          >
            {option.icon ? <Ionicons color={active ? colors.primary : colors.textMuted} name={option.icon} size={17} /> : null}
            <AppText tone={active ? 'brand' : 'muted'} variant="bodySmall" weight="900">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function MetricGrid({ items }: { items: MetricItem[] }) {
  return (
    <AppCard style={styles.metricGridCard}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.metricItem, index < items.length - 1 && styles.metricDivider]}>
          {item.icon ? <Ionicons color={colors.primary} name={item.icon} size={24} /> : null}
          <AppText tone="muted" variant="caption">
            {item.label}
          </AppText>
          <View style={styles.metricValueRow}>
            <AppText numberOfLines={1} variant="title" weight="900">
              {item.value}
            </AppText>
            {item.unit ? (
              <AppText tone="muted" variant="caption" weight="900">
                {item.unit}
              </AppText>
            ) : null}
          </View>
          {item.delta ? (
            <AppText tone={item.delta.includes('-') ? 'success' : 'brand'} variant="caption" weight="900">
              {item.delta}
            </AppText>
          ) : null}
        </View>
      ))}
    </AppCard>
  );
}

export function ChartCard({
  action,
  data,
  formatValue,
  labels,
  subtitle,
  title,
  unit = 'kg',
}: {
  action?: ReactNode;
  data: number[];
  formatValue?: (value: number) => string;
  labels: string[];
  subtitle?: string;
  title: string;
  unit?: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const activePoints = data
    .map((value, index) => ({ label: labels[index] ?? '', value }))
    .filter((point) => point.value > 0);
  const chartLabels = activePoints.map((point) => point.label);
  const chartData = activePoints.map((point) => point.value);
  const fmt = formatValue ?? ((v: number) => `${Math.round(v)}`);

  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <AppText variant="subtitle" weight="900">
            {title}
          </AppText>
          {subtitle ? (
            <AppText tone="muted" variant="caption">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action}
      </View>
      <MiniLineChart
        chartHeight={124}
        data={chartData}
        emptyMessage="当前范围还没有趋势数据"
        formatValue={fmt}
        highlightIndex={selectedIndex ?? undefined}
        includeZero
        keyPointIndexes={selectedIndex !== null ? [selectedIndex] : []}
        labels={chartLabels}
        minChartHeight={Math.max(100, ...data)}
        onPointPress={(_, index) => setSelectedIndex((prev) => (prev === index ? null : index))}
        showValues={false}
        unitLabel={unit}
        valueLabelStrategy={selectedIndex !== null ? 'keyPoints' : 'none'}
      />
    </AppCard>
  );
}

export function MultiChartCard({
  labels,
  series,
  title,
  unit = 'kg',
}: {
  labels: string[];
  series: MultiLineTrendSeries[];
  title: string;
  unit?: string;
}) {
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeader}>
        <AppText variant="subtitle" weight="900">
          {title}
        </AppText>
        <Tag label="趋势对比" tone="neutral" />
      </View>
      <MultiLineTrendChart labels={labels} series={series} unitLabel={unit} />
    </AppCard>
  );
}

export function SectionCard({
  action,
  children,
  subtitle,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  subtitle?: string;
  title: string;
}) {
  return (
    <AppCard style={styles.cardGap}>
      <View style={styles.cardHeader}>
        <View style={styles.headerText}>
          <AppText variant="subtitle" weight="900">
            {title}
          </AppText>
          {subtitle ? (
            <AppText tone="muted" variant="caption">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action}
      </View>
      {children}
    </AppCard>
  );
}

export function InsightList({ insights }: { insights: string[] }) {
  return (
    <View style={styles.insightList}>
      {insights.map((insight, index) => (
        <View key={`${insight}-${index}`} style={styles.insightRow}>
          <View style={styles.insightIcon}>
            <Ionicons color={colors.primary} name={index === 0 ? 'pulse-outline' : index === 1 ? 'trending-up-outline' : 'sparkles-outline'} size={18} />
          </View>
          <AppText style={styles.insightText} variant="bodySmall" weight="800">
            {insight}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function HorizontalBarRow({
  label,
  meta,
  ratio,
  right,
}: {
  label: string;
  meta?: string;
  ratio: number;
  right?: ReactNode;
}) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barLabel}>
        <AppText numberOfLines={1} variant="bodySmall" weight="900">
          {label}
        </AppText>
        {meta ? (
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {meta}
          </AppText>
        ) : null}
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(4, Math.min(100, ratio * 100))}%` }]} />
      </View>
      {right}
    </View>
  );
}

export function VerticalBars({
  bars,
  formatValue = (value) => `${Math.round(value)}`,
}: {
  bars: { label: string; value: number }[];
  formatValue?: (value: number) => string;
}) {
  if (bars.length === 0) {
    return (
      <View style={styles.verticalBarsEmpty}>
        <AppText tone="muted" variant="caption">
          暂无训练数据
        </AppText>
      </View>
    );
  }
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  return (
    <View style={styles.verticalBars}>
      {bars.map((bar) => (
        <View key={bar.label} style={styles.verticalBarItem}>
          <AppText numberOfLines={1} tone={bar.value > 0 ? 'brand' : 'muted'} variant="caption" weight="900">
            {bar.value > 0 ? formatValue(bar.value) : '-'}
          </AppText>
          <View style={styles.verticalBarTrack}>
            <View style={[styles.verticalBarFill, { height: `${Math.max(5, (bar.value / max) * 100)}%` }]} />
          </View>
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {bar.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function AvatarName({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  name,
  size = 38,
}: {
  avatarLocalUri?: string | null;
  avatarThumbUrl?: string | null;
  avatarUrl?: string | null;
  name: string;
  size?: number;
}) {
  return (
    <View style={styles.avatarName}>
      <Avatar avatarLocalUri={avatarLocalUri} avatarThumbUrl={avatarThumbUrl} avatarUrl={avatarUrl} name={name} size={size} />
      <AppText numberOfLines={1} variant="bodySmall" weight="900">
        {name}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarName: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minWidth: 0,
  },
  backButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  backHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backRight: {
    alignItems: 'flex-end',
    minWidth: 40,
  },
  backTitle: {
    flex: 1,
    textAlign: 'center',
  },
  barFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 10,
  },
  barLabel: {
    flex: 0.9,
    gap: 2,
    minWidth: 76,
  },
  barRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  barTrack: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    flex: 1,
    height: 10,
    overflow: 'hidden',
  },
  cardGap: {
    gap: spacing.md,
  },
  cardHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  iconButtonCompact: {
    height: 44,
    paddingHorizontal: 0,
    paddingVertical: 0,
    width: 44,
  },
  insightIcon: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  insightList: {
    gap: spacing.sm,
  },
  insightRow: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    paddingBottom: spacing.sm,
  },
  insightText: {
    flex: 1,
  },
  metricDivider: {
    borderRightColor: colors.border,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  metricGridCard: {
    flexDirection: 'row',
    paddingHorizontal: 0,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
    paddingHorizontal: spacing.xs,
  },
  metricValueRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 2,
  },
  pageHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
  },
  segment: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    padding: spacing.xs,
  },
  segmentItem: {
    alignItems: 'center',
    borderRadius: radius.md,
    flex: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
    minHeight: 42,
    paddingHorizontal: spacing.sm,
  },
  segmentItemActive: {
    backgroundColor: colors.surface,
  },
  verticalBarFill: {
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    width: '100%',
  },
  verticalBarItem: {
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  verticalBarTrack: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    height: 112,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    width: 30,
  },
  verticalBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 160,
  },
  verticalBarsEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
});
