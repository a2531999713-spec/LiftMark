import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type AccountMenuRowProps = {
  danger?: boolean;
  description?: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  tag?: string;
  trailing?: string;
};

export function AccountMenuRow({
  danger = false,
  description,
  icon,
  label,
  onPress,
  tag,
  trailing,
}: AccountMenuRowProps) {
  const iconColor = danger ? colors.danger : colors.primary;
  const iconBackground = danger ? colors.dangerSoft : colors.primarySoft;

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, { backgroundColor: iconBackground }]}>
        <Ionicons color={iconColor} name={icon} size={21} />
      </View>
      <View style={styles.textBlock}>
        <AppText numberOfLines={1} tone={danger ? 'danger' : 'default'} variant="bodySmall" weight="900">
          {label}
        </AppText>
        {description ? (
          <AppText numberOfLines={1} tone="muted" variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {tag ? <Tag label={tag} tone={danger ? 'danger' : 'neutral'} /> : null}
        {trailing ? (
          <AppText numberOfLines={1} tone={danger ? 'danger' : 'muted'} variant="caption" weight="800">
            {trailing}
          </AppText>
        ) : null}
        <Ionicons color={colors.textSubtle} name="chevron-forward" size={18} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
    minHeight: 62,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
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
    maxWidth: 128,
  },
});
