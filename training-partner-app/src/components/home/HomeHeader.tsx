import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';

const ROLL_INTERVAL_MS = 8000;

type HomeHeaderProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  displayName: string;
  onAvatarPress: () => void;
  subtitle: string;
  title: string;
  titlePool?: string[];
};

export function HomeHeader({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  displayName,
  onAvatarPress,
  subtitle,
  title,
  titlePool,
}: HomeHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <RollingTitle baseTitle={title} pool={titlePool} />
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
          size={38}
        />
      </Pressable>
    </View>
  );
}

function RollingTitle({ baseTitle, pool }: { baseTitle: string; pool?: string[] }) {
  const titles = pool && pool.length > 1 ? pool : [baseTitle];
  const [index, setIndex] = useState(() => {
    if (titles.length <= 1) return 0;
    const key = new Date().toDateString();
    const score = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return score % titles.length;
  });
  const [opacity] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (titles.length <= 1) return;

    const timer = setInterval(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => {
        setIndex((prev) => (prev + 1) % titles.length);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }).start();
      });
    }, ROLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [opacity, titles.length]);

  return (
    <Animated.View style={{ opacity }}>
      <AppText numberOfLines={1} style={styles.title} variant="title" weight="900">
        {titles[index] ?? baseTitle}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  avatarButton: {
    position: 'relative',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
    justifyContent: 'space-between',
    minHeight: 56,
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
  title: {
    color: colors.textStrong,
  },
});
