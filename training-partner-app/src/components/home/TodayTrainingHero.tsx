import { Ionicons } from '@expo/vector-icons';
import { ImageBackground, StyleSheet, View } from 'react-native';
import type { ImageSourcePropType } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, shadows, spacing } from '@/theme';

type TodayTrainingHeroMetric = {
  label: string;
  value: string;
};

type TodayTrainingHeroProps = {
  estimatedMinutes?: number;
  imageSource: ImageSourcePropType;
  metrics: TodayTrainingHeroMetric[];
  subtitle: string;
  title: string;
};

export function TodayTrainingHero({
  estimatedMinutes,
  imageSource,
  metrics,
  subtitle,
  title,
}: TodayTrainingHeroProps) {
  return (
    <View style={styles.card}>
      <ImageBackground imageStyle={styles.image} resizeMode="cover" source={imageSource} style={styles.background}>
        <View style={styles.scrim} />
        <View style={styles.content}>
          <View style={styles.topRow}>
            <View style={styles.label}>
              <AppText tone="inverse" variant="caption" weight="900">
                今日训练
              </AppText>
            </View>
            <View style={styles.timeBadge}>
              <Ionicons color={colors.surface} name="time-outline" size={16} />
              <AppText tone="inverse" variant="bodySmall" weight="800">
                {estimatedMinutes ? `预计 ${estimatedMinutes} 分钟` : '预计 --'}
              </AppText>
            </View>
          </View>

          <View style={styles.titleBlock}>
            <AppText numberOfLines={2} style={styles.title} variant="headline" weight="900">
              {title}
            </AppText>
            <AppText numberOfLines={1} style={styles.subtitle} variant="subtitle" weight="800">
              {subtitle}
            </AppText>
          </View>

          <View style={styles.metrics}>
            {metrics.map((metric, index) => (
              <View key={metric.label} style={[styles.metricItem, index > 0 && styles.metricDivider]}>
                <AppText numberOfLines={1} tone="muted" variant="caption">
                  {metric.label}
                </AppText>
                <AppText numberOfLines={1} style={styles.metricValue} variant="bodySmall" weight="900">
                  {metric.value}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    minHeight: 168,
  },
  card: {
    backgroundColor: colors.dark,
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.hero,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 168,
    padding: spacing.md,
  },
  image: {
    opacity: 0.9,
  },
  label: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  metricDivider: {
    borderLeftColor: colors.borderStrong,
    borderLeftWidth: StyleSheet.hairlineWidth,
  },
  metricItem: {
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
  },
  metricValue: {
    color: colors.textStrong,
  },
  metrics: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: radius.lg,
    flexDirection: 'row',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  scrim: {
    backgroundColor: 'rgba(5,14,24,0.64)',
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
  },
  timeBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  title: {
    color: colors.surface,
  },
  titleBlock: {
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  topRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
