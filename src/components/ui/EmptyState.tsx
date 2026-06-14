import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppButton } from './AppButton';
import { AppCard } from './AppCard';
import { AppText } from './AppText';

type EmptyStateProps = {
  actionLabel?: string;
  description: string;
  onActionPress?: () => void;
  title: string;
};

export function EmptyState({ actionLabel, description, onActionPress, title }: EmptyStateProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.dot} />
      <AppText variant="subtitle">{title}</AppText>
      <AppText tone="muted" variant="bodySmall">
        {description}
      </AppText>
      {actionLabel ? (
        <AppButton onPress={onActionPress} variant="secondary">
          {actionLabel}
        </AppButton>
      ) : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  dot: {
    backgroundColor: colors.primary,
    borderRadius: 5,
    height: 10,
    width: 10,
  },
});
