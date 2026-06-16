import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

type AppCardProps = {
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'soft' | 'brand' | 'dark';
};

export function AppCard({ children, padded = true, style, tone = 'default' }: AppCardProps) {
  return <View style={[styles.card, styles[tone], padded && styles.padded, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    ...shadows.card,
  },
  padded: {
    padding: spacing.xl,
  },
  default: {
    backgroundColor: colors.surface,
  },
  soft: {
    backgroundColor: colors.surfaceMuted,
  },
  brand: {
    backgroundColor: colors.primarySoft,
  },
  dark: {
    backgroundColor: colors.darkCard,
  },
});
