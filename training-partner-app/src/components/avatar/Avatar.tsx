import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors } from '@/theme';

type AvatarProps = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUrl?: string;
  name?: string;
  size?: number;
};

function getInitial(name?: string) {
  const trimmed = name?.trim();
  if (!trimmed) return '练';
  return trimmed.slice(0, 1).toUpperCase();
}

export function Avatar({ avatarLocalUri, avatarThumbUrl, avatarUrl, name, size = 48 }: AvatarProps) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const uri = useMemo(
    () => avatarLocalUri ?? avatarThumbUrl ?? avatarUrl,
    [avatarLocalUri, avatarThumbUrl, avatarUrl],
  );

  const fontSize = Math.max(13, Math.round(size * 0.34));
  const showImage = Boolean(uri && failedUri !== uri);

  return (
    <View style={[styles.avatar, { borderRadius: size / 2, height: size, width: size }]}>
      {showImage ? (
        <Image
          contentFit="cover"
          onError={() => setFailedUri(uri ?? null)}
          source={{ uri }}
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
    backgroundColor: colors.darkCard,
    borderColor: 'rgba(255,255,255,0.88)',
    borderWidth: 2,
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
