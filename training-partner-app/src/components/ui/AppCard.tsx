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
    borderColor: colors.border,
    borderRadius: radius.md,
    borderWidth: 1,
    ...shadows.card,
  },
  padded: {
    padding: spacing.lg,
  },
  default: {
    backgroundColor: colors.surface,
  },
  soft: {
    backgroundColor: colors.backgroundElevated,
  },
  brand: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primarySoft,
  },
  dark: {
    backgroundColor: colors.darkCard,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
