import * as FileSystem from 'expo-file-system/legacy';

import { API_BASE_URL } from '@/services/apiClient';
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

/**
 * 上传头像到服务器（文件方式）
 */
async function uploadAvatarToServer(fileUri: string, accessToken: string): Promise<string | null> {
  try {
    // 读取文件信息
    const fileInfo = await FileSystem.getInfoAsync(fileUri);
    if (!fileInfo.exists) {
      throw new Error('头像文件不存在。');
    }

    // 创建 FormData 并上传文件
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'avatar.jpg';
    const mimeType = 'image/jpeg';

    // @ts-ignore - React Native 的 FormData 支持文件上传
    formData.append('file', {
      uri: fileUri,
      name: filename,
      type: mimeType,
    });

    const response = await fetch(`${API_BASE_URL}/auth/avatar/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'multipart/form-data',
      },
      body: formData,
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || '上传失败');
    }

    return result.avatar_url;
  } catch (error) {
    console.error('头像上传到服务器失败:', error);
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

  // 本地保存头像
  await FileSystem.copyAsync({ from: input.fileUri, to: avatarLocalUri });

  // 获取文件大小
  const fileInfo = await FileSystem.getInfoAsync(input.fileUri);
  const byteSize = fileInfo.exists ? fileInfo.size : 0;

  // 上传到服务器
  let avatarUrl = avatarLocalUri; // 默认使用本地路径
  const session = await readStoredSession();
  if (session?.accessToken) {
    const serverUrl = await uploadAvatarToServer(input.fileUri, session.accessToken);
    if (serverUrl) {
      avatarUrl = serverUrl;
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
  };
}
