import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type HomeHeaderProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  displayName: string;
  onAvatarPress: () => void;
  showStatusDot?: boolean;
  subtitle: string;
  title: string;
};

export function HomeHeader({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  displayName,
  onAvatarPress,
  showStatusDot = false,
  subtitle,
  title,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText numberOfLines={1} style={styles.title} variant="headline" weight="900">
          {title}
        </AppText>
        <AppText numberOfLines={1} tone="muted" variant="bodySmall">
          {subtitle}
        </AppText>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={onAvatarPress}
        style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}
      >
        <Avatar
          avatarLocalUri={avatarLocalUri}
          avatarThumbUrl={avatarThumbUrl}
          avatarUrl={avatarUrl}
          name={displayName}
          size={40}
        />
        {showStatusDot ? <View style={styles.statusDot} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarButton: {
    position: 'relative',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'space-between',
    minHeight: 52,
    paddingTop: spacing.xs,
  },
  headerText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  statusDot: {
    backgroundColor: colors.primary,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    height: 12,
    position: 'absolute',
    right: -1,
    top: -1,
    width: 12,
  },
  title: {
    color: colors.textStrong,
  },
});
