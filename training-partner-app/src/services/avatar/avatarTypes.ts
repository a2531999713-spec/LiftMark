export type AvatarOwnerType = 'account' | 'member';

export type AccountProfileCache = {
  avatarLocalUri?: string;
  avatarThumbUrl?: string;
  avatarUpdatedAt?: string;
  avatarUrl?: string;
  displayName?: string;
  liftmarkId?: string;
  phoneMasked?: string;
  updatedAt: string;
  userId: string;
};

export type AvatarUploadResult = {
  avatarFileKey: string;
  avatarLocalUri: string;
  avatarThumbUrl: string;
  avatarUpdatedAt: string;
  avatarUrl: string;
  byteSize: number;
  isMock: boolean;
};

export type AvatarPickSource = 'camera' | 'library';

export type AvatarServiceResult =
  | { ok: true; profile: AccountProfileCache; upload: AvatarUploadResult }
  | { ok: false; message: string };

export const AVATAR_LIMITS = {
  maxOriginalBytes: 10 * 1024 * 1024,
  maxProcessedBytes: 1 * 1024 * 1024,
  serverHardLimitBytes: 2 * 1024 * 1024,
  maxEdge: 1024,
  thumbnailEdge: 256,
  quality: 0.86,
} as const;
