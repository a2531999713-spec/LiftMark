import { InteractionManager } from 'react-native';

import { createLocalRepositories } from '@/data/local';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';
import { queueNewAchievementUnlocks } from '@/services/achievementUnlockService';
import { reconcileDirtyWorkoutSyncQueue } from '@/sync/syncQueue';
import { requestImmediateSync } from '@/sync/syncService';

const scheduledSessions = new Set<string>();

async function runTask(sessionId: string, name: string, task: () => Promise<unknown>): Promise<void> {
  const startedAt = Date.now();
  try {
    await task();
  } catch (error) {
    if (__DEV__) {
      console.warn('[post-workout-task]', { error, name, sessionId });
    }
  } finally {
    if (__DEV__) {
      console.log('[post-workout-task-performance]', {
        durationMs: Date.now() - startedAt,
        name,
        sessionId,
      });
    }
  }
}

export function schedulePostWorkoutTasks(sessionId: string): void {
  if (scheduledSessions.has(sessionId)) return;
  scheduledSessions.add(sessionId);

  InteractionManager.runAfterInteractions(() => {
    setTimeout(() => {
      const repositories = createLocalRepositories();
      void Promise.allSettled([
        runTask(sessionId, 'sync_queue_reconciliation', async () => {
          await reconcileDirtyWorkoutSyncQueue({ sessionId });
        }),
        runTask(sessionId, 'training_report', async () => {
          await repositories.workoutRepository.generateTrainingReport(sessionId);
        }),
        runTask(sessionId, 'progression', async () => {
          await repositories.progressionRepository.createSuggestionsForSession(sessionId);
        }),
        runTask(sessionId, 'achievement', async () => {
          const ownerUserId = await getRequiredCurrentUserId();
          const [before, after] = await Promise.all([
            repositories.achievementRepository.getAchievementSnapshot({ ownerUserId, excludeSessionId: sessionId }),
            repositories.achievementRepository.getAchievementSnapshot({ ownerUserId }),
          ]);
          await queueNewAchievementUnlocks({ userId: ownerUserId, before, after });
        }),
      ]).then(() => runTask(sessionId, 'network_sync', requestImmediateSync));
    }, 80);
  });
}

export function resetPostWorkoutTaskSchedulerForTests(): void {
  scheduledSessions.clear();
}
