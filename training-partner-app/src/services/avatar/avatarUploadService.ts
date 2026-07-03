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
export async function uploadAvatarToServer(fileUri: string, accessToken: string): Promise<string> {
  const fileInfo = await FileSystem.getInfoAsync(fileUri);
  if (!fileInfo.exists) {
    throw new Error('本地头像文件不存在，无法上传服务器。');
  }

  const filename = fileUri.split('/').pop() || 'avatar.jpg';

  // 通过 XMLHttpRequest 将文件读为 Blob，兼容 React Native 0.85+
  const fileBlob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new Error('读取本地头像文件失败。'));
    xhr.open('GET', fileUri);
    xhr.responseType = 'blob';
    xhr.send();
  });

  const formData = new FormData();
  formData.append('file', fileBlob, filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${API_BASE_URL}/auth/avatar/upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
      signal: controller.signal,
    });

    const text = await response.text();
    const result = text ? JSON.parse(text) : {};

    if (!response.ok) {
      throw new Error(result.message ?? '头像上传服务器失败。');
    }

    const avatarUrl = result.avatarUrl ?? result.avatar_url;
    if (!avatarUrl) {
      throw new Error('服务器未返回头像地址。');
    }
    return avatarUrl;
  } catch (error) {
    console.warn('[avatar] uploadAvatarToServer failed', error instanceof Error ? error.message : error);
    if (error instanceof Error) throw error;
    throw new Error('头像上传服务器失败。');
  } finally {
    clearTimeout(timeout);
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
  let avatarUrl: string | undefined;
  let serverAvatarUrl: string | undefined;
  let serverUploadError: string | undefined;
  const session = await readStoredSession();
  if (session?.accessToken) {
    try {
      const serverUrl = await uploadAvatarToServer(avatarLocalUri, session.accessToken);
      serverAvatarUrl = serverUrl;
      avatarUrl = resolveAvatarUrl(serverUrl) ?? serverUrl;
    } catch (error) {
      serverUploadError = error instanceof Error ? error.message : '头像上传服务器失败。';
    }
  } else {
    serverUploadError = '请先登录后再上传头像到服务器。';
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
    serverUploaded: Boolean(serverAvatarUrl),
    serverUploadError,
  };
}
