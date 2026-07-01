import { apiRequest } from '@/services/httpClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

export type PendingTrainingItem = {
  id: string;
  groupId: string;
  groupName: string;
  uploader: {
    userId: string;
    nickname: string;
    avatarUrl: string | null;
  };
  sessionData: {
    title?: string;
    date: string;
    week?: number;
    weekday?: number;
    status?: string;
  };
  setsData: Array<{
    exerciseId: string;
    setNumber: number;
    weight?: number;
    reps?: number;
    completed?: boolean;
    rpe?: number;
    notes?: string;
  }>;
  uploadedAt: string;
};

export type UploadedItem = {
  id: string;
  targetUser: {
    userId: string;
    nickname: string;
    avatarUrl: string | null;
  };
  status: 'pending' | 'accepted' | 'rejected';
  uploadedAt: string;
  respondedAt: string | null;
};

/**
 * 获取当前用户的待确认数据
 */
export async function getPendingTrainingItems(): Promise<PendingTrainingItem[]> {
  const session = await readStoredSession();
  if (!session?.accessToken) return [];

  try {
    const result = await apiRequest<{ pendingItems: PendingTrainingItem[] }>(
      '/pending-training',
      { accessToken: session.accessToken }
    );
    return result.pendingItems ?? [];
  } catch {
    return [];
  }
}

/**
 * 上传训练数据给其他成员
 */
export async function uploadPendingTraining(data: {
  groupId: string;
  targetUserId: string;
  sessionData: {
    title?: string;
    date: string;
    week?: number;
    weekday?: number;
    status?: string;
  };
  setsData: Array<{
    exerciseId: string;
    exerciseClientId?: string;
    setNumber: number;
    weight?: number;
    reps?: number;
    completed?: boolean;
    skipped?: boolean;
    rpe?: number;
    notes?: string;
  }>;
}): Promise<{ ok: boolean; pendingId?: string; message?: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken) {
    return { ok: false, message: '请先登录。' };
  }

  try {
    const result = await apiRequest<{ ok: boolean; pendingId: string }>(
      '/pending-training/upload',
      {
        method: 'POST',
        accessToken: session.accessToken,
        body: data,
      }
    );
    return { ok: result.ok, pendingId: result.pendingId };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '上传失败，请稍后重试。',
    };
  }
}

/**
 * 确认接受数据
 */
export async function acceptPendingTraining(
  pendingId: string
): Promise<{ ok: boolean; sessionId?: string; message?: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken) {
    return { ok: false, message: '请先登录。' };
  }

  try {
    const result = await apiRequest<{ ok: boolean; sessionId: string }>(
      `/pending-training/${pendingId}/accept`,
      {
        method: 'POST',
        accessToken: session.accessToken,
      }
    );
    return { ok: result.ok, sessionId: result.sessionId };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '确认失败，请稍后重试。',
    };
  }
}

/**
 * 拒绝数据
 */
export async function rejectPendingTraining(
  pendingId: string
): Promise<{ ok: boolean; message?: string }> {
  const session = await readStoredSession();
  if (!session?.accessToken) {
    return { ok: false, message: '请先登录。' };
  }

  try {
    await apiRequest(`/pending-training/${pendingId}`, {
      method: 'DELETE',
      accessToken: session.accessToken,
    });
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '操作失败，请稍后重试。',
    };
  }
}

/**
 * 获取上传者的数据状态
 */
export async function getUploadedItems(): Promise<UploadedItem[]> {
  const session = await readStoredSession();
  if (!session?.accessToken) return [];

  try {
    const result = await apiRequest<{ uploadedItems: UploadedItem[] }>(
      '/pending-training/uploaded',
      { accessToken: session.accessToken }
    );
    return result.uploadedItems ?? [];
  } catch {
    return [];
  }
}
