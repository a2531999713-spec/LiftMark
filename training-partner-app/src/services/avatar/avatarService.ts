import * as FileSystem from 'expo-file-system/legacy';
import { manipulateAsync, SaveFormat, type Action } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { createLocalRepositories, getDatabase, initializeLocalDatabase } from '@/data/local';
import type { MemberProfile } from '@/domain/member/member.types';
import type { AuthUser } from '@/services/auth/authTypes';
import { syncAvatarToServer } from '@/services/profileSyncService';
import { resolveAvatarUrl } from '@/utils/avatarUrl';

import {
  AVATAR_LIMITS,
  type AccountProfileCache,
  type AvatarPickSource,
  type AvatarServiceResult,
} from './avatarTypes';
import { uploadAccountAvatar } from './avatarUploadService';

type AccountProfileRow = {
  age: number | null;
  avatar_local_uri: string | null;
  avatar_thumb_url: string | null;
  avatar_updated_at: string | null;
  avatar_url: string | null;
  display_name: string | null;
  gender: AccountProfileCache['gender'] | null;
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
    age: row.age ?? undefined,
    avatarLocalUri: row.avatar_local_uri ?? undefined,
    avatarThumbUrl: resolveAvatarUrl(row.avatar_thumb_url),
    avatarUpdatedAt: row.avatar_updated_at ?? undefined,
    avatarUrl: resolveAvatarUrl(row.avatar_url),
    displayName: row.display_name ?? undefined,
    gender: row.gender ?? undefined,
    liftmarkId: row.liftmark_id ?? undefined,
    phoneMasked: row.phone_masked ?? undefined,
    updatedAt: row.updated_at,
    userId: row.user_id,
  };
}

async function ensureAccountProfileCacheTable() {
  await initializeLocalDatabase();
  const db = await getDatabase();
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS account_profile_cache (
      user_id TEXT PRIMARY KEY NOT NULL,
      display_name TEXT,
      phone_masked TEXT,
      liftmark_id TEXT,
      age INTEGER,
      gender TEXT,
      avatar_url TEXT,
      avatar_thumb_url TEXT,
      avatar_local_uri TEXT,
      avatar_updated_at TEXT,
      updated_at TEXT NOT NULL
    );
  `);

  const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(account_profile_cache)');
  const names = new Set(columns.map((column) => column.name));
  if (!names.has('age')) {
    await db.execAsync('ALTER TABLE account_profile_cache ADD COLUMN age INTEGER;');
  }
  if (!names.has('gender')) {
    await db.execAsync('ALTER TABLE account_profile_cache ADD COLUMN gender TEXT;');
  }

  return db;
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
  const db = await ensureAccountProfileCacheTable();
  const row = await db.getFirstAsync<AccountProfileRow>(
    'SELECT * FROM account_profile_cache WHERE user_id = ?',
    userId,
  );
  return row ? mapAccountProfile(row) : null;
}

export async function upsertAccountProfileCache(input: {
  age?: number;
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUpdatedAt?: string;
  avatarUrl?: string;
  gender?: AccountProfileCache['gender'];
  user: AuthUser;
}): Promise<AccountProfileCache> {
  const db = await ensureAccountProfileCacheTable();
  const existing = await getAccountProfileCache(input.user.id);
  const updatedAt = new Date().toISOString();
  const profile: AccountProfileCache = {
    age: input.age ?? existing?.age,
    avatarLocalUri: input.avatarLocalUri,
    avatarThumbUrl: input.avatarThumbUrl,
    avatarUpdatedAt: input.avatarUpdatedAt,
    avatarUrl: input.avatarUrl,
    displayName: input.user.displayName,
    gender: input.gender ?? existing?.gender,
    liftmarkId: input.user.liftmarkId,
    phoneMasked: maskPhone(input.user.phone),
    updatedAt,
    userId: input.user.id,
  };

  await db.runAsync(
    `INSERT INTO account_profile_cache (
     user_id, display_name, phone_masked, liftmark_id, avatar_url,
       avatar_thumb_url, avatar_local_uri, avatar_updated_at, age, gender, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       phone_masked = excluded.phone_masked,
       liftmark_id = excluded.liftmark_id,
       avatar_url = excluded.avatar_url,
       avatar_thumb_url = excluded.avatar_thumb_url,
       avatar_local_uri = excluded.avatar_local_uri,
       avatar_updated_at = excluded.avatar_updated_at,
       age = COALESCE(excluded.age, account_profile_cache.age),
       gender = COALESCE(excluded.gender, account_profile_cache.gender),
       updated_at = excluded.updated_at`,
    profile.userId,
    profile.displayName ?? null,
    profile.phoneMasked ?? null,
    profile.liftmarkId ?? null,
    profile.avatarUrl ?? null,
    profile.avatarThumbUrl ?? null,
    profile.avatarLocalUri ?? null,
    profile.avatarUpdatedAt ?? null,
    profile.age ?? null,
    profile.gender ?? null,
    profile.updatedAt,
  );

  return profile;
}

export async function updateAccountProfileDetails(input: {
  age?: number;
  displayName: string;
  gender?: AccountProfileCache['gender'];
  user: AuthUser;
}): Promise<AccountProfileCache> {
  const db = await ensureAccountProfileCacheTable();
  const existing = await getAccountProfileCache(input.user.id);
  const updatedAt = new Date().toISOString();
  const profile: AccountProfileCache = {
    age: input.age,
    avatarLocalUri: existing?.avatarLocalUri,
    avatarThumbUrl: existing?.avatarThumbUrl,
    avatarUpdatedAt: existing?.avatarUpdatedAt,
    avatarUrl: existing?.avatarUrl ?? input.user.avatarUrl,
    displayName: input.displayName,
    gender: input.gender,
    liftmarkId: existing?.liftmarkId ?? input.user.liftmarkId,
    phoneMasked: existing?.phoneMasked ?? maskPhone(input.user.phone),
    updatedAt,
    userId: input.user.id,
  };

  await db.runAsync(
    `INSERT INTO account_profile_cache (
       user_id, display_name, phone_masked, liftmark_id, age, gender, avatar_url,
       avatar_thumb_url, avatar_local_uri, avatar_updated_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       display_name = excluded.display_name,
       phone_masked = excluded.phone_masked,
       liftmark_id = excluded.liftmark_id,
       age = excluded.age,
       gender = excluded.gender,
       avatar_url = excluded.avatar_url,
       avatar_thumb_url = excluded.avatar_thumb_url,
       avatar_local_uri = excluded.avatar_local_uri,
       avatar_updated_at = excluded.avatar_updated_at,
       updated_at = excluded.updated_at`,
    profile.userId,
    profile.displayName ?? null,
    profile.phoneMasked ?? null,
    profile.liftmarkId ?? null,
    profile.age ?? null,
    profile.gender ?? null,
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
    const syncResult = upload.serverAvatarUrl
      ? await syncAvatarToServer(upload.serverAvatarUrl)
      : { ok: false as const, message: upload.serverUploadError ?? '头像只保存在本机，上传服务器失败。' };
    const profile = await upsertAccountProfileCache({
      avatarLocalUri: upload.avatarLocalUri,
      avatarThumbUrl: upload.avatarThumbUrl,
      avatarUpdatedAt: upload.avatarUpdatedAt,
      avatarUrl: upload.avatarUrl,
      user,
    });

    const warning =
      upload.serverUploadError
        ? `头像只保存在本机，上传服务器失败。${upload.serverUploadError}`
        : !syncResult.ok
          ? `头像文件已上传，但资料同步失败：${syncResult.message}`
          : undefined;

    return { ok: true, message: warning, profile, upload: { ...upload, byteSize: processed.byteSize } };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '头像上传失败，请稍后重试。',
    };
  }
}

export async function deleteAccountAvatar(user: AuthUser): Promise<AccountProfileCache> {
  const result = await syncAvatarToServer(null);
  if (!result.ok) {
    console.warn('[avatar] deleteAccountAvatar server sync failed', result.message);
  }
  return upsertAccountProfileCache({
    avatarLocalUri: undefined,
    avatarThumbUrl: undefined,
    avatarUpdatedAt: new Date().toISOString(),
    avatarUrl: undefined,
    user,
  });
}

export async function syncAccountAvatarToLocalMemberProfiles(input: {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUpdatedAt?: string;
  avatarUrl?: string;
  fallbackMemberId?: string;
  userId: string;
}): Promise<{ profilesByMemberId: Record<string, MemberProfile>; updatedMemberIds: string[] }> {
  await initializeLocalDatabase();
  const repositories = createLocalRepositories();
  const groups = await repositories.groupRepository.listGroups();
  const profilesByMemberId: Record<string, MemberProfile> = {};
  const updatedMemberIds: string[] = [];

  for (const group of groups) {
    const members = await repositories.memberRepository.listMembers(group.id);
    let targetMembers = members.filter((member) => member.userId === input.userId);

    if (targetMembers.length === 0 && input.fallbackMemberId) {
      const fallback = members.find((member) => member.id === input.fallbackMemberId);
      if (fallback) {
        targetMembers = [fallback];
      }
    }

    for (const member of targetMembers) {
      const updatedProfile = await repositories.memberRepository.updateProfile(member.id, {
        avatarLocalUri: input.avatarLocalUri,
        avatarThumbUrl: input.avatarThumbUrl,
        avatarUpdatedAt: input.avatarUpdatedAt,
        avatarUrl: input.avatarUrl,
      });
      profilesByMemberId[member.id] = updatedProfile;
      updatedMemberIds.push(member.id);
    }
  }

  return { profilesByMemberId, updatedMemberIds };
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
    avatarThumbUrl: resolveAvatarUrl(input.accountProfile?.avatarThumbUrl ?? input.user?.avatarUrl ?? input.fallbackThumbUrl),
    avatarUrl: resolveAvatarUrl(input.accountProfile?.avatarUrl ?? input.user?.avatarUrl ?? input.fallbackUrl),
  };
}
