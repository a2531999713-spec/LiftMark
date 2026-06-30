import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ProfileMenuItemProps = {
  danger?: boolean;
  description?: string;
  disabled?: boolean;
  icon: IconName;
  label: string;
  onPress?: () => void;
  tag?: string;
  trailing?: string;
};

export function ProfileMenuItem({
  danger = false,
  description,
  disabled = false,
  icon,
  label,
  onPress,
  tag,
  trailing,
}: ProfileMenuItemProps) {
  const iconColor = danger ? colors.danger : colors.primary;
  const iconBackground = danger ? colors.dangerSoft : colors.primarySoft;
  const pressable = Boolean(onPress);

  return (
    <Pressable
      accessibilityRole={pressable ? 'button' : undefined}
      disabled={disabled || !pressable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        disabled && styles.disabled,
        pressed && pressable && styles.pressed,
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBackground }]}>
        <Ionicons color={iconColor} name={icon} size={25} />
      </View>
      <View style={styles.textBlock}>
        <AppText tone={danger ? 'danger' : 'default'} variant="subtitle" weight="900">
          {label}
        </AppText>
        {description ? (
          <AppText numberOfLines={2} tone="muted" variant="bodySmall">
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {tag ? <Tag label={tag} tone={danger ? 'danger' : 'neutral'} /> : null}
        {trailing ? (
          <AppText numberOfLines={1} tone="muted" variant="caption" weight="700">
            {trailing}
          </AppText>
        ) : null}
        {pressable ? <Ionicons color={colors.textSubtle} name="chevron-forward" size={22} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.45,
  },
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.pill,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  pressed: {
    backgroundColor: colors.backgroundElevated,
  },
  row: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 82,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  textBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 120,
  },
});
