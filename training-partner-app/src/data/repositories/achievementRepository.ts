import type { AchievementSnapshot } from '@liftmark/shared';

export type AchievementSnapshotInput = { ownerUserId: string; todayKey?: string; excludeSessionId?: string };

export interface AchievementRepository {
  getAchievementSnapshot(input: AchievementSnapshotInput): Promise<AchievementSnapshot>;
}
