import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { AppText } from './AppText';

export type AvatarProps = {
  avatarLocalUri?: string | null;
  avatarThumbUrl?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  uri?: string | null;
  variant?: 'group' | 'member' | 'user';
};

function getInitial(name?: string | null) {
  const trimmed = name?.trim();
  if (!trimmed) return '练';
  return trimmed.slice(0, 1).toUpperCase();
}

export function Avatar({
  avatarLocalUri,
  avatarThumbUrl,
  avatarUrl,
  name,
  size = 48,
  uri,
  variant = 'member',
}: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const imageUri = useMemo(
    () => uri ?? avatarLocalUri ?? avatarThumbUrl ?? avatarUrl ?? null,
    [avatarLocalUri, avatarThumbUrl, avatarUrl, uri],
  );

  const fontSize = Math.max(13, Math.round(size * 0.34));
  const showImage = Boolean(imageUri && failedUri !== imageUri);
  const fallbackStyle =
    variant === 'user' ? styles.userFallback : variant === 'group' ? styles.groupFallback : styles.memberFallback;

  return (
    <View style={[styles.avatar, fallbackStyle, { borderRadius: size / 2, height: size, width: size }]}>
      {showImage ? (
        <Image
          contentFit="cover"
          onError={() => setFailedUri(imageUri)}
          source={{ uri: imageUri ?? undefined }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <AppText style={{ fontSize, lineHeight: Math.round(fontSize * 1.24) }} tone="inverse" weight="900">
          {getInitial(name)}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderColor: 'rgba(255,255,255,0.88)',
    borderWidth: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  groupFallback: {
    backgroundColor: colors.brandDark,
  },
  memberFallback: {
    backgroundColor: colors.darkCard,
  },
  userFallback: {
    backgroundColor: colors.dark,
  },
});
