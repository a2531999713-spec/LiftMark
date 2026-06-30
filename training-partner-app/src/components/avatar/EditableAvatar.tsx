import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radius } from '@/theme';

import { Avatar } from './Avatar';

type EditableAvatarProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  name?: string;
  onPress: () => void;
  size?: number;
};

export function EditableAvatar({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  name,
  onPress,
  size = 88,
}: EditableAvatarProps) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <Avatar
        avatarLocalUri={avatarLocalUri}
        avatarThumbUrl={avatarThumbUrl}
        avatarUrl={avatarUrl}
        name={name}
        size={size}
      />
      <View style={[styles.badge, { right: Math.max(0, size * 0.02) }]}>
        <Ionicons color={colors.surface} name="camera" size={Math.max(15, Math.round(size * 0.2))} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.dark,
    borderColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 2,
    bottom: 0,
    height: 31,
    justifyContent: 'center',
    position: 'absolute',
    width: 31,
  },
  pressed: {
    opacity: 0.84,
    transform: [{ scale: 0.98 }],
  },
  wrap: {
    position: 'relative',
  },
});
