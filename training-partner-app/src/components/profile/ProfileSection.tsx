import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radius, shadows, spacing } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type ProfileSectionProps = {
  children: ReactNode;
  icon?: IconName;
  title: string;
};

export function ProfileSection({ children, icon, title }: ProfileSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        {icon ? <Ionicons color={colors.textStrong} name={icon} size={22} /> : null}
        <AppText style={styles.title} variant="subtitle" weight="900">
          {title}
        </AppText>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadows.card,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  section: {
    gap: spacing.md,
  },
  title: {
    color: colors.textStrong,
  },
});
