import type { createLocalRepositories } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import type { SystemTrainingScheme } from '@/domain/plan/systemSchemes';
import { activateTrainingPlanForGroup } from '@/services/trainingMainlineService';

type LocalRepositories = ReturnType<typeof createLocalRepositories>;

export type SystemSchemeCopyResult = {
  group: Group;
  plan: PlanTemplate;
  reusedExisting: boolean;
};

export function createSystemSchemeCopyActionLock() {
  let pending = false;
  return {
    isPending: () => pending,
    run: async <T>(task: () => Promise<T>): Promise<T | undefined> => {
      if (pending) return undefined;
      pending = true;
      try {
        return await task();
      } finally {
        pending = false;
      }
    },
  };
}

export function findExistingSystemSchemeCopy(
  userPlans: PlanTemplate[],
  schemeId: string,
): PlanTemplate | undefined {
  return userPlans.find((plan) => plan.originSchemeId === schemeId);
}

export async function copyAndActivateSystemScheme(
  repositories: LocalRepositories,
  input: {
    allowDuplicate?: boolean;
    group: Group;
    scheme: SystemTrainingScheme;
    userPlans: PlanTemplate[];
  },
): Promise<SystemSchemeCopyResult> {
  const existing = findExistingSystemSchemeCopy(input.userPlans, input.scheme.id);
  const plan = existing && !input.allowDuplicate
    ? existing
    : await repositories.planRepository.copySystemSchemeToUserPlan({
      name: input.scheme.title.replace('方案', '计划'),
      scheme: input.scheme,
    });
  const { group } = await activateTrainingPlanForGroup(repositories, { group: input.group, plan });
  return { group, plan, reusedExisting: plan.id === existing?.id };
}
