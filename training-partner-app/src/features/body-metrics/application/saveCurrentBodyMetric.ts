import type { createLocalRepositories } from '@/data/local/repositories';
import type { UpsertBodyMetricInput } from '@/domain/body/body-metrics.types';
import { enqueueSyncCandidate } from '@/sync/syncQueue';

/** Keeps the latest valid body metric and training profile weight aligned without letting backfills overwrite newer data. */
export async function saveCurrentBodyMetric(repositories: ReturnType<typeof createLocalRepositories>, input: UpsertBodyMetricInput) {
  const previousLatest = (await repositories.bodyMetricsRepository.listMetrics(input.memberId, 1))[0];
  const saved = await repositories.bodyMetricsRepository.upsertMetric(input);
  await enqueueSyncCandidate({
    entityType: 'bodyMetrics',
    localId: saved.id,
    operation: 'update',
    payload: { ...saved },
    status: 'pending_update',
    updatedAt: saved.updatedAt,
  });

  if (saved.weightKg === undefined || (previousLatest?.date && saved.date < previousLatest.date)) return saved;

  const profile = await repositories.memberRepository.updateProfile(input.memberId, { bodyweight: saved.weightKg });
  await enqueueSyncCandidate({
    entityType: 'memberProfiles',
    localId: profile.id,
    operation: 'update',
    payload: { bodyweight: profile.bodyweight, groupId: profile.groupId, memberId: profile.memberId },
    status: 'pending_update',
    updatedAt: profile.updatedAt,
  });
  return saved;
}
