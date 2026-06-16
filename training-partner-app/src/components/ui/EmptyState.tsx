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
      <AppText tone="muted" variant="body">
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
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
  },
  dot: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    height: 48,
    width: 48,
  },
});
