import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';

import { spacing } from '@/theme';

import { AppButton } from './AppButton';
import { AppCard } from './AppCard';
import { AppText } from './AppText';

type DangerZoneProps = {
  actionLabel: string;
  children?: ReactNode;
  onPress?: () => void;
  title: string;
};

export function DangerZone({ actionLabel, children, onPress, title }: DangerZoneProps) {
  return (
    <AppCard style={styles.card} tone="brand">
      <AppText tone="danger" variant="subtitle">
        {title}
      </AppText>
      {children ? (
        <AppText tone="muted" variant="bodySmall">
          {children}
        </AppText>
      ) : null}
      <AppButton onPress={onPress} variant="danger">
        {actionLabel}
      </AppButton>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
});
