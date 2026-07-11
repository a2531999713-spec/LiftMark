import type { AppScope } from '@/application/scope/AppScope';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';

import { createLocalRepositories } from './index';

export async function createScopedRepositories(scope: Pick<AppScope, 'groupId' | 'userId'>) {
  const currentUserId = await getRequiredCurrentUserId();
  if (currentUserId !== scope.userId) {
    throw new Error('Repository scope does not match the authenticated account.');
  }

  const repositories = createLocalRepositories();
  if (scope.groupId) {
    const group = await repositories.groupRepository.getGroupById(scope.groupId);
    if (!group) throw new Error('Scoped group is not visible for the authenticated account.');
  }

  return { ...repositories, scope };
}
