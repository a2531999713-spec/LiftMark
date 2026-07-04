import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type HomeHeaderProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  dateLabel: string;
  displayName: string;
  greeting: string;
  onAvatarPress: () => void;
  showStatusDot?: boolean;
};

export function HomeHeader({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  dateLabel,
  displayName,
  greeting,
  onAvatarPress,
  showStatusDot = false,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText numberOfLines={1} style={styles.title} variant="display" weight="900">
          {greeting}，{displayName} 👋
        </AppText>
        <AppText tone="muted" variant="body">
          {dateLabel}
        </AppText>
      </View>
      <Pressable accessibilityRole="button" onPress={onAvatarPress} style={({ pressed }) => [styles.avatarButton, pressed && styles.pressed]}>
        <Avatar
          avatarLocalUri={avatarLocalUri}
          avatarThumbUrl={avatarThumbUrl}
          avatarUrl={avatarUrl}
          name={displayName}
          size={58}
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
    gap: spacing.lg,
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
  },
  headerText: {
    flex: 1,
    gap: spacing.xs,
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
    borderWidth: 3,
    height: 17,
    position: 'absolute',
    right: -1,
    top: -2,
    width: 17,
  },
  title: {
    color: colors.textStrong,
  },
});
