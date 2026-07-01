import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

export type Invitation = {
  id: string;
  code: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  createdAt: string;
};

/**
 * 创建邀请码
 */
export async function createInvitation(
  groupId: string,
  options?: { maxUses?: number; expiresInDays?: number }
): Promise<Invitation | null> {
  const session = await readStoredSession();
  if (!session?.accessToken) return null;

  try {
    const result = await apiRequest<{ ok: boolean; invitation: Invitation }>(
      `/groups/${groupId}/invitations`,
      {
        method: 'POST',
        accessToken: session.accessToken,
        body: options,
      }
    );
    return result.ok ? result.invitation : null;
  } catch {
    return null;
  }
}

/**
 * 获取邀请码列表
 */
export async function getInvitations(groupId: string): Promise<Invitation[]> {
  const session = await readStoredSession();
  if (!session?.accessToken) return [];

  try {
    const result = await apiRequest<{ invitations: Invitation[] }>(
      `/groups/${groupId}/invitations`,
      { accessToken: session.accessToken }
    );
    return result.invitations ?? [];
  } catch {
    return [];
  }
}

/**
 * 禁用邀请码
 */
export async function disableInvitation(groupId: string, invitationId: string): Promise<boolean> {
  const session = await readStoredSession();
  if (!session?.accessToken) return false;

  try {
    await apiRequest(`/groups/${groupId}/invitations/${invitationId}`, {
      method: 'DELETE',
      accessToken: session.accessToken,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 通过邀请码加入小组
 */
export async function joinGroupByInvitation(
  code: string
): Promise<{ ok: boolean; group?: { id: string; name: string }; message?: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken) {
    return { ok: false, message: '请先登录。' };
  }

  try {
    const result = await apiRequest<{ ok: boolean; group?: { id: string; name: string }; message?: string }>(
      `/invitations/${code}/join`,
      {
        method: 'POST',
        accessToken: session.accessToken,
      }
    );
    return result;
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '加入小组失败，请稍后重试。',
    };
  }
}
