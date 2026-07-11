import { createLocalRepositories } from '@/data/local/repositories';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import { resolveDefaultTrainingMember } from '@/domain/member/member-selection';

import { createEmptyAppScope, type AppScope } from './AppScope';

export async function resolveAppScope(input: {
  selectedGroupId?: string | null;
  userId: string;
}): Promise<AppScope> {
  const repositories = createLocalRepositories();
  const { group } = await resolveSelectedGroup(repositories.groupRepository, input.selectedGroupId);
  if (!group) return createEmptyAppScope(input.userId);

  const members = await repositories.memberRepository.listMembers(group.id);
  const member = resolveDefaultTrainingMember(members, input.userId);
  const activePlan = group.activePlanId
    ? await repositories.planRepository.getPlanById(group.activePlanId)
    : null;
  const activePlanCycle = activePlan
    ? await repositories.planRepository.getActivePlanCycle({ groupId: group.id, planId: activePlan.id })
    : null;

  return {
    userId: input.userId,
    groupId: group.id,
    memberId: member?.id ?? null,
    activePlanId: activePlan?.id ?? null,
    activePlanCycleId: activePlanCycle?.id ?? null,
  };
}
