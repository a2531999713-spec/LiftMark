import { useEffect, useState } from 'react';

import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import { defaultUserPreferences, type UserPreferences } from '@/domain/preferences/user-preferences.types';

// 读取用户训练偏好的 hook，供训练页面使用
// 偏好由 AccountPanel 的训练偏好面板写入，这里只读取
export function useUserPreferences(): { preferences: UserPreferences; isLoading: boolean } {
  const repositories = createLocalRepositories();
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        await initializeLocalDatabase();
        const prefs = await repositories.userPreferencesRepository.getPreferences();
        setPreferences(prefs);
      } catch {
        // 读取失败时使用默认值
      } finally {
        setIsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { preferences, isLoading };
}
