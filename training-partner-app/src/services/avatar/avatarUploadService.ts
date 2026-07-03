import * as FileSystem from 'expo-file-system/legacy';

import { API_BASE_URL } from '@/services/apiClient';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

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

/**
 * 上传头像到服务器（文件方式）
 * 使用已复制到稳定路径的本地文件，避免临时 URI 在 fetch 中不可用
 */
async function uploadAvatarToServer(fileUri: string, accessToken: string): Promise<string | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      return null;
    }

    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'avatar.jpg';

    // @ts-ignore - React Native 的 FormData 支持文件上传
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: 'image/jpeg',
    });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${API_BASE_URL}/auth/avatar/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const result = await response.json();

    if (!response.ok) {
      return null;
    }

    return result.avatarUrl ?? result.avatar_url ?? null;
  } catch {
    return null;
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

  // 先复制到稳定路径
  await FileSystem.copyAsync({ from: input.fileUri, to: avatarLocalUri });

  const fileInfo = await FileSystem.getInfoAsync(avatarLocalUri);
  const byteSize = fileInfo.exists ? fileInfo.size : 0;

  // 用稳定路径上传（不用临时的 input.fileUri）
  let avatarUrl = avatarLocalUri;
  let serverAvatarUrl: string | undefined;
  const session = await readStoredSession();
  if (session?.accessToken) {
    const serverUrl = await uploadAvatarToServer(avatarLocalUri, session.accessToken);
    if (serverUrl) {
      serverAvatarUrl = serverUrl;
      avatarUrl = resolveAvatarUrl(serverUrl) ?? serverUrl;
    }
  }

  return {
    avatarFileKey: `avatars/${safeUserId}/avatar.jpg`,
    avatarLocalUri,
    avatarThumbUrl: avatarUrl,
    avatarUpdatedAt,
    avatarUrl,
    byteSize,
    isMock: false,
    serverAvatarUrl,
  };
}
