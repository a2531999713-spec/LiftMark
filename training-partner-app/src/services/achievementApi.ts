import type { AchievementSnapshot } from '@liftmark/shared';

import { apiRequest } from '@/services/apiClient';
import { readStoredSession } from '@/services/auth/tokenStorage';

type AchievementApiResponse = Omit<AchievementSnapshot, 'activityWeeks'> & {
  activityWeeks?: AchievementSnapshot['activityWeeks'];
};

export async function getMyAchievements(): Promise<AchievementSnapshot> {
  const session = await readStoredSession();
  if (!session?.accessToken) {
    throw new Error('登录后才能刷新云端成就。');
  }
  const response = await apiRequest<AchievementApiResponse>('/achievements/me', {
    accessToken: session.accessToken,
  });
  return {
    ...response,
    activityWeeks: response.activityWeeks ?? [],
  };
}

