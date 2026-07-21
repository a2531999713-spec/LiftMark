import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { AchievementSnapshot } from '@liftmark/shared';

import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';
import { mergeAchievementSnapshots } from '@/domain/achievement/achievement-engine';
import type { AchievementSnapshotSource } from '@/domain/achievement/achievement.types';
import { getMyAchievements } from '@/services/achievementApi';
import { useAuthStore } from '@/store/authStore';

export function useAchievementSnapshot() {
  const repositories = useMemo(() => createLocalRepositories(), []);
  const authStatus = useAuthStore((state) => state.authStatus);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const [snapshot, setSnapshot] = useState<AchievementSnapshot | null>(null);
  const [snapshotUserId, setSnapshotUserId] = useState<string | null>(null);
  const [source, setSource] = useState<AchievementSnapshotSource>('local');
  const [isLoading, setLoading] = useState(true);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const refreshSequence = useRef(0);

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const isCurrentRequest = () => refreshSequence.current === sequence;
    if (!userId) {
      setSnapshot(null);
      setSnapshotUserId(null);
      setLoading(false);
      setRemoteFailed(false);
      return;
    }
    setLoading(true);
    setRemoteFailed(false);
    try {
      await initializeLocalDatabase();
      const local = await repositories.achievementRepository.getAchievementSnapshot({ ownerUserId: userId });
      if (!isCurrentRequest()) return;
      setSnapshot(local);
      setSnapshotUserId(userId);
      setSource('local');
      setLoading(false);
      if (authStatus !== 'authenticated') return;
      try {
        const remote = await getMyAchievements();
        if (!isCurrentRequest()) return;
        setSnapshot(mergeAchievementSnapshots(local, remote));
        setSource('merged');
      } catch {
        if (isCurrentRequest()) setRemoteFailed(true);
      }
    } catch {
      if (isCurrentRequest()) {
        setSnapshot(null);
        setLoading(false);
      }
    }
  }, [authStatus, repositories, userId]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void refresh().catch(() => {
        if (active) setLoading(false);
      });
      return () => {
        active = false;
        refreshSequence.current += 1;
      };
    }, [refresh]),
  );

  return {
    isLoading,
    refresh,
    remoteFailed,
    snapshot: snapshotUserId === userId ? snapshot : null,
    source,
  };
}
