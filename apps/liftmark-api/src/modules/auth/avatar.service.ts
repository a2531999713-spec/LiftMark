import * as fs from 'fs/promises';
import * as path from 'path';

const AVATAR_DIR = '/home/deploy/liftmark/uploads/avatars';

/**
 * 确保头像目录存在
 */
async function ensureAvatarDir(): Promise<void> {
  try {
    await fs.access(AVATAR_DIR);
  } catch {
    await fs.mkdir(AVATAR_DIR, { recursive: true });
  }
}

/**
 * 保存头像文件到硬盘
 * @param userId 用户ID
 * @param fileBuffer 文件内容
 * @param extension 文件扩展名 (如 .jpg, .png)
 * @returns 文件的访问路径
 */
export async function saveAvatarFile(
  userId: string,
  fileBuffer: Buffer,
  extension: string
): Promise<string> {
  await ensureAvatarDir();

  // 生成唯一文件名: 用户ID + 时间戳 + 扩展名
  const timestamp = Date.now();
  const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${safeUserId}_${timestamp}${extension}`;
  const filePath = path.join(AVATAR_DIR, filename);

  // 写入文件
  await fs.writeFile(filePath, fileBuffer);

  // 返回访问路径
  return `/uploads/avatars/${filename}`;
}

/**
 * 删除头像文件
 * @param avatarUrl 头像的访问路径
 */
export async function deleteAvatarFile(avatarUrl: string | null): Promise<void> {
  if (!avatarUrl || !avatarUrl.startsWith('/uploads/avatars/')) {
    return;
  }

  const filename = path.basename(avatarUrl);
  const filePath = path.join(AVATAR_DIR, filename);

  try {
    await fs.unlink(filePath);
  } catch {
    // 文件不存在时忽略错误
  }
}

/**
 * 获取允许的文件扩展名
 */
export function getAllowedExtension(mimeType: string): string | null {
  const mimeToExt: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/jpg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
  };
  return mimeToExt[mimeType.toLowerCase()] ?? null;
}
