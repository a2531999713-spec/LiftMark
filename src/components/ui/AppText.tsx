import type { ReactNode } from 'react';
import { StyleSheet, Text, type TextProps, type TextStyle } from 'react-native';

import { colors, typography } from '@/theme';

type AppTextVariant =
  | 'display'
  | 'headline'
  | 'title'
  | 'subtitle'
  | 'body'
  | 'bodySmall'
  | 'caption';

type AppTextTone = 'default' | 'muted' | 'subtle' | 'inverse' | 'brand' | 'success' | 'warning' | 'danger';

type AppTextProps = TextProps & {
  children: ReactNode;
  tone?: AppTextTone;
  variant?: AppTextVariant;
  weight?: TextStyle['fontWeight'];
};

export function AppText({
  children,
  style,
  tone = 'default',
  variant = 'body',
  weight,
  ...props
}: AppTextProps) {
  return (
    <Text {...props} style={[styles.base, styles[variant], styles[tone], weight ? { fontWeight: weight } : null, style]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: colors.text,
  },
  display: {
    fontSize: typography.sizes.display,
    fontWeight: '900',
    lineHeight: typography.lineHeights.display,
  },
  headline: {
    fontSize: typography.sizes.headline,
    fontWeight: '900',
    lineHeight: typography.lineHeights.headline,
  },
  title: {
    fontSize: typography.sizes.title,
    fontWeight: '900',
    lineHeight: typography.lineHeights.title,
  },
  subtitle: {
    fontSize: typography.sizes.subtitle,
    fontWeight: '800',
    lineHeight: typography.lineHeights.subtitle,
  },
  body: {
    fontSize: typography.sizes.body,
    lineHeight: typography.lineHeights.body,
  },
  bodySmall: {
    fontSize: typography.sizes.bodySmall,
    lineHeight: typography.lineHeights.bodySmall,
  },
  caption: {
    fontSize: typography.sizes.caption,
    fontWeight: '800',
    lineHeight: typography.lineHeights.caption,
  },
  default: {
    color: colors.text,
  },
  muted: {
    color: colors.textMuted,
  },
  subtle: {
    color: colors.textSubtle,
  },
  inverse: {
    color: colors.surface,
  },
  brand: {
    color: colors.brand,
  },
  success: {
    color: colors.success,
  },
  warning: {
    color: colors.warning,
  },
  danger: {
    color: colors.danger,
  },
});
