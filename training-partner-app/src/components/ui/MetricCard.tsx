import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing } from '@/theme';

import { AppCard } from './AppCard';
import { AppText } from './AppText';

type MetricCardProps = {
  delta?: string;
  label: string;
  style?: StyleProp<ViewStyle>;
  value: string;
};

export function MetricCard({ delta, label, style, value }: MetricCardProps) {
  return (
    <AppCard style={[styles.card, style]}>
      <AppText tone="muted" variant="caption">
        {label}
      </AppText>
      <View style={styles.valueRow}>
        <AppText variant="title">{value}</AppText>
        {delta ? (
          <AppText tone={delta.startsWith('-') ? 'danger' : 'brand'} variant="caption">
            {delta}
          </AppText>
        ) : null}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: spacing.xs,
    minHeight: 96,
  },
  valueRow: {
    gap: 2,
  },
});
