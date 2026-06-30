import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme';

import { AppText } from './AppText';

type IconName = ComponentProps<typeof Ionicons>['name'];
type AppButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'dark';
type AppButtonSize = 'sm' | 'md' | 'lg';

type AppButtonProps = {
  children: ReactNode;
  disabled?: boolean;
  icon?: IconName;
  loading?: boolean;
  onPress?: () => void;
  size?: AppButtonSize;
  style?: StyleProp<ViewStyle>;
  variant?: AppButtonVariant;
};

export function AppButton({
  children,
  disabled = false,
  icon,
  loading = false,
  onPress,
  size = 'md',
  style,
  variant = 'primary',
}: AppButtonProps) {
  const isSecondary = variant === 'secondary' || variant === 'ghost';
  const iconColor = isSecondary ? colors.text : colors.surface;
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        styles[size],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? <ActivityIndicator color={iconColor} size="small" /> : null}
        {!loading && icon ? <Ionicons color={iconColor} name={icon} size={size === 'lg' ? 19 : 17} /> : null}
        <AppText
          style={[styles.text, isSecondary && styles.secondaryText, variant === 'danger' && styles.dangerText]}
          variant="bodySmall"
          weight={typography.weights.semibold}
        >
          {children}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  inner: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  sm: {
    minHeight: 38,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: spacing.xs,
  },
  md: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
  },
  lg: {
    minHeight: 52,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  ghost: {
    backgroundColor: colors.surfaceMuted,
  },
  dark: {
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  text: {
    color: colors.surface,
    textAlign: 'center',
  },
  secondaryText: {
    color: colors.text,
  },
  dangerText: {
    color: colors.surface,
  },
});
