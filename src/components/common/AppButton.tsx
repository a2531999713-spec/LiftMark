import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors } from '@/theme/colors';
import { spacing } from '@/theme/spacing';

type AppButtonProps = {
  children: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
};

export function AppButton({
  children,
  onPress,
  disabled = false,
  variant = 'primary',
  style,
}: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.text, variant === 'secondary' && styles.secondaryText]}>
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 8,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
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
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
  text: {
    color: colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryText: {
    color: colors.text,
  },
});
