import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { Tag } from './Tag';

type IconName = ComponentProps<typeof Ionicons>['name'];

type SecondaryPageHeaderProps = {
  avatarUri?: string | null;
  caption?: string;
  icon?: IconName;
  meta?: string;
  right?: ReactNode;
  subtitle?: string;
  tag?: string;
  title: string;
};

export function SecondaryPageHeader({
  avatarUri,
  caption,
  icon,
  meta,
  right,
  subtitle,
  tag,
  title,
}: SecondaryPageHeaderProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.navRow}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
          <Ionicons color={colors.textStrong} name="chevron-back" size={22} />
        </Pressable>
        {right}
      </View>

      <View style={styles.summary}>
        {avatarUri ? (
          <Avatar name={title} size={46} uri={avatarUri} variant="user" />
        ) : icon ? (
          <View style={styles.iconBox}>
            <Ionicons color={colors.primary} name={icon} size={22} />
          </View>
        ) : null}
        <View style={styles.textBlock}>
          {caption ? (
            <AppText numberOfLines={1} tone="muted" variant="caption" weight="800">
              {caption}
            </AppText>
          ) : null}
          <AppText numberOfLines={1} variant="subtitle" weight="900">
            {title}
          </AppText>
          {subtitle ? (
            <AppText numberOfLines={2} tone="muted" variant="caption">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.sideBlock}>
          {tag ? <Tag label={tag} tone="neutral" /> : null}
          {meta ? (
            <AppText numberOfLines={1} tone="muted" variant="caption" weight="800">
              {meta}
            </AppText>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  iconBox: {
    alignItems: 'center',
    backgroundColor: colors.primarySoft,
    borderRadius: radius.md,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  navRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sideBlock: {
    alignItems: 'flex-end',
    gap: spacing.xs,
    maxWidth: 96,
  },
  summary: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  textBlock: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  wrap: {
    gap: spacing.sm,
  },
});
