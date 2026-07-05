import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Tag } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type AccountPanelRowProps = {
  danger?: boolean;
  description?: string;
  icon: IconName;
  label: string;
  onPress: () => void;
  tag?: string;
  trailing?: string;
};

export function AccountPanelRow({
  danger = false,
  description,
  icon,
  label,
  onPress,
  tag,
  trailing,
}: AccountPanelRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.iconBox, danger ? styles.iconBoxDanger : styles.iconBoxDefault]}>
        <Ionicons color={danger ? colors.danger : colors.primary} name={icon} size={19} />
      </View>
      <View style={styles.text}>
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
        <Ionicons color={colors.textSubtle} name="chevron-forward" size={17} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  iconBox: {
    alignItems: 'center',
    borderRadius: radius.md,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconBoxDanger: {
    backgroundColor: colors.dangerSoft,
  },
  iconBoxDefault: {
    backgroundColor: colors.primarySoft,
  },
  pressed: {
    backgroundColor: colors.backgroundElevated,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    flex: 1,
    gap: 1,
    minWidth: 0,
  },
  trailing: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    maxWidth: 126,
  },
});
