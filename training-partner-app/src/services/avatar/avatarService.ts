import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { getDatabase, initializeLocalDatabase } from '@/data/local';
import type { AuthUser } from '@/services/auth/authTypes';

import {
  AVATAR_LIMITS,
  type AccountProfileCache,
  type AvatarPickSource,
  type AvatarServiceResult,
} from './avatarTypes';
import { uploadAccountAvatar } from './avatarUploadService';

type AccountProfileRow = {
  avatar_local_uri: string | null;
  avatar_thumb_url: string | null;
  avatar_updated_at: string | null;
  avatar_url: string | null;
  display_name: string | null;
  liftmark_id: string | null;
  phone_masked: string | null;
  updated_at: string;
  user_id: string;
};

function maskPhone(phone?: string) {
  if (!phone) return undefined;
  if (phone.length < 7) return phone;
  return `${phone.slice(0, 3)}****${phone.slice(-4)}`;
}

function mapAccountProfile(row: AccountProfileRow): AccountProfileCache {
  return {
    avatarLocalUri: row.avatar_local_uri ?? undefined,
    avatarThumbUrl: row.avatar_thumb_url ?? undefined,
    avatarUpdatedAt: row.avatar_updated_at ?? undefined,
    avatarUrl: row.avatar_url ?? undefined,
    displayName: row.display_name ?? undefined,
    liftmarkId: row.liftmark_id ?? undefined,
    phoneMasked: row.phone_masked ?? undefined,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

function isSupportedImage(asset: ImagePicker.ImagePickerAsset) {
  const mime = asset.mimeType?.toLowerCase() ?? '';
  const fileName = asset.fileName?.toLowerCase() ?? asset.uri.toLowerCase();
  if (mime.includes('heic') || mime.includes('heif') || fileName.endsWith('.heic') || fileName.endsWith('.heif')) {
    return true;
  }
  if (mime.startsWith('image/')) {
    return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(mime);
  }
  return /\.(jpe?g|png|webp)$/i.test(fileName);
}

function createSquareCrop(asset: ImagePicker.ImagePickerAsset): Action[] {
  const width = asset.width || AVATAR_LIMITS.maxEdge;
  const height = asset.height || AVATAR_LIMITS.maxEdge;
  const side = Math.min(width, height);
  const actions: Action[] = [];

  if (side > 0 && width > 0 && height > 0 && width !== height) {
    actions.push({
      crop: {
        height: side,
        originX: Math.max(0, Math.round((width - side) / 2)),
        originY: Math.max(0, Math.round((height - side) / 2)),
        width: side,
      },
    });
  }

  actions.push({
    resize: {
      height: AVATAR_LIMITS.maxEdge,
      width: AVATAR_LIMITS.maxEdge,
    },
  });
  return actions;
}

async function getFileSize(uri: string, fallback?: number) {
  if (fallback) return fallback;
  const info = await FileSystem.getInfoAsync(uri);
  return info.exists ? info.size : 0;
}

async function processAvatar(asset: ImagePicker.ImagePickerAsset) {
  const originalSize = await getFileSize(asset.uri, asset.fileSize);
  if (originalSize > AVATAR_LIMITS.maxOriginalBytes) {
    throw new Error('图片过大，请选择小于 10 MB 的图片。');
  }
  if (!isSupportedImage(asset)) {
    throw new Error('当前图片格式暂不支持，请选择 JPG、PNG 或 WebP 图片。');
  }

  const qualities = [AVATAR_LIMITS.quality, 0.78, 0.7];
  let lastUri = asset.uri;
  let lastSize = originalSize;

  for (const quality of qualities) {
    const result = await manipulateAsync(asset.uri, createSquareCrop(asset), {
      compress: quality,
      format: SaveFormat.JPEG,
    });
    const size = await getFileSize(result.uri);
    lastUri = result.uri;
    lastSize = size;
    if (size <= AVATAR_LIMITS.maxProcessedBytes) {
      return { byteSize: size, uri: result.uri };
    }
  }

  if (lastSize > AVATAR_LIMITS.serverHardLimitBytes) {
    throw new Error('头像压缩后仍然过大，请更换图片后重试。');
  }

  return { byteSize: lastSize, uri: lastUri };
}

async function pickImage(source: AvatarPickSource) {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new Error('无法访问相机，请在系统设置中开启权限。');
    }
    return ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      base64: false,
      mediaTypes: ['images'],
      quality: 1,
      shape: 'oval',
    });
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('无法访问相册，请在系统设置中开启权限。');
  }
  return ImagePicker.launchImageLibraryAsync({
    allowsEditing: true,
    aspect: [1, 1],
    base64: false,
    mediaTypes: ['images'],
    quality: 1,
    shape: 'oval',
  });
}

export async function getAccountProfileCache(userId: string): Promise<AccountProfileCache | null> {
  await initializeLocalDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS account_profile_cache (
      user_id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT,
      phone_masked TEXT,
      liftmark_id TEXT,
      avatar_url TEXT,
      avatar_thumb_url TEXT,
      avatar_local_uri TEXT,
      avatar_updated_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  const row = await db.getFirstAsync<AccountProfileRow>(
    'SELECT * FROM account_profile_cache WHERE user_id = ?',
    userId,
  );
  return row ? mapAccountProfile(row) : null;
}

export async function upsertAccountProfileCache(input: {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUpdatedAt?: string;
  avatarUrl?: string;
  user: AuthUser;
}): Promise<AccountProfileCache> {
  await initializeLocalDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS account_profile_cache (
      user_id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT,
      phone_masked TEXT,
      liftmark_id TEXT,
      avatar_url TEXT,
      avatar_thumb_url TEXT,
      avatar_local_uri TEXT,
      avatar_updated_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);
  const updatedAt = new Date().toISOString();
  const profile: AccountProfileCache = {
    avatarLocalUri: input.avatarLocalUri,
    avatarThumbUrl: input.avatarThumbUrl,
    avatarUpdatedAt: input.avatarUpdatedAt,
    avatarUrl: input.avatarUrl,
    displayName: input.user.displayName,
    liftmarkId: input.user.liftmarkId,
    phoneMasked: maskPhone(input.user.phone),
    updatedAt,
    userId: input.user.id,
  };

  await db.runAsync(
    `INSERT INTO account_profile_cache (
       user_id, display_name, phone_masked, liftmark_id, avatar_url,
       avatar_thumb_url, avatar_local_uri, avatar_updated_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       phone_masked = excluded.phone_masked,
       liftmark_id = excluded.liftmark_id,
       avatar_url = excluded.avatar_url,
       avatar_thumb_url = excluded.avatar_thumb_url,
       avatar_local_uri = excluded.avatar_local_uri,
       avatar_updated_at = excluded.avatar_updated_at,
       updated_at = excluded.updated_at`,
    profile.userId,
    profile.displayName ?? null,
    profile.phoneMasked ?? null,
    profile.liftmarkId ?? null,
    profile.avatarUrl ?? null,
    profile.avatarThumbUrl ?? null,
    profile.avatarLocalUri ?? null,
    profile.avatarUpdatedAt ?? null,
    profile.updatedAt,
  );

  return profile;
}

export async function updateAccountAvatarFromPicker(
  user: AuthUser,
  source: AvatarPickSource,
): Promise<AvatarServiceResult> {
  try {
    const result = await pickImage(source);
    if (result.canceled || !result.assets?.[0]) {
      return { ok: false, message: '已取消选择头像。' };
    }

    const processed = await processAvatar(result.assets[0]);
    const upload = await uploadAccountAvatar({ fileUri: processed.uri, userId: user.id });
    const profile = await upsertAccountProfileCache({
      avatarLocalUri: upload.avatarLocalUri,
      avatarThumbUrl: upload.avatarThumbUrl,
      avatarUpdatedAt: upload.avatarUpdatedAt,
      avatarUrl: upload.avatarUrl,
      user,
    });

    return { ok: true, profile, upload: { ...upload, byteSize: processed.byteSize } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '头像上传失败，请稍后重试。',
    };
  }
}

export async function deleteAccountAvatar(user: AuthUser): Promise<AccountProfileCache> {
  return upsertAccountProfileCache({
    avatarLocalUri: undefined,
    avatarThumbUrl: undefined,
    avatarUpdatedAt: new Date().toISOString(),
    avatarUrl: undefined,
    user,
  });
}

export function getAvatarDisplay(input: {
  accountProfile?: AccountProfileCache | null;
  fallbackLocalUri?: string;
  fallbackThumbUrl?: string;
  fallbackUrl?: string;
  user?: AuthUser | null;
}) {
  return {
    avatarLocalUri: input.accountProfile?.avatarLocalUri ?? input.fallbackLocalUri,
    avatarThumbUrl: input.accountProfile?.avatarThumbUrl ?? input.user?.avatarUrl ?? input.fallbackThumbUrl,
    avatarUrl: input.accountProfile?.avatarUrl ?? input.user?.avatarUrl ?? input.fallbackUrl,
  };
}
