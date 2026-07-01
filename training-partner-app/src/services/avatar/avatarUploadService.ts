import * as FileSystem from 'expo-file-system/legacy';

import { apiRequest } from '@/services/apiClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

import type { AvatarUploadResult } from './avatarTypes';

const AVATAR_DIR = `${FileSystem.documentDirectory ?? ''}avatars/`;

async function ensureAvatarDir() {
  if (!FileSystem.documentDirectory) {
    throw new Error('当前设备暂不支持头像缓存。');
  }
  const info = await FileSystem.getInfoAsync(AVATAR_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(AVATAR_DIR, { intermediates: true });
  }
}

export async function uploadAccountAvatar(input: {
  fileUri: string;
  userId: string;
}): Promise<AvatarUploadResult> {
  await ensureAvatarDir();
  const avatarUpdatedAt = new Date().toISOString();
  const safeUserId = input.userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const avatarLocalUri = `${AVATAR_DIR}${safeUserId}_${Date.now()}.jpg`;

  await FileSystem.copyAsync({ from: input.fileUri, to: avatarLocalUri });

  const base64 = await FileSystem.readAsStringAsync(input.fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const avatarUrl = `data:image/jpeg;base64,${base64}`;

  const session = await readStoredSession();
  if (session?.accessToken) {
    try {
      await apiRequest<{ ok: boolean; avatar_url: string | null }>('/auth/avatar', {
        method: 'PATCH',
        accessToken: session.accessToken,
        body: { avatar_url: avatarUrl },
      });
    } catch {
      // Server upload failed, still save locally
    }
  }

  return {
    avatarFileKey: `avatars/${safeUserId}/avatar.jpg`,
    avatarLocalUri,
    avatarThumbUrl: avatarUrl,
    avatarUpdatedAt,
    avatarUrl,
    byteSize: base64.length * 0.75,
    isMock: false,
  };
}
