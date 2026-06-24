import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type HeaderAction = {
  dot?: boolean;
  icon: IconName;
  label: string;
  onPress: () => void;
};

type ProfileHeaderProps = {
  actions: HeaderAction[];
  subtitle: string;
  title: string;
};

export function ProfileHeader({ actions, subtitle, title }: ProfileHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.titleBlock}>
        <AppText style={styles.title} variant="headline" weight="900">
          {title}
        </AppText>
        <AppText tone="muted" variant="bodySmall" weight="600">
          {subtitle}
        </AppText>
      </View>
      <View style={styles.actions}>
        {actions.map((action) => (
          <Pressable
            accessibilityLabel={action.label}
            accessibilityRole="button"
            key={action.label}
            onPress={action.onPress}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
          >
            <Ionicons color={colors.textStrong} name={action.icon} size={24} />
            {action.dot ? <View style={styles.dot} /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    alignItems: 'center',
    backgroundColor: colors.backgroundElevated,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  dot: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: 7,
    top: 6,
    width: 12,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.lg,
    justifyContent: 'space-between',
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.98 }],
  },
  title: {
    color: colors.textStrong,
  },
  titleBlock: {
    flex: 1,
    gap: spacing.xs,
  },
});
