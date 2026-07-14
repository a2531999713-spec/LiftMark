import * as SecureStore from 'expo-secure-store';

import { createLocalRepositories, initializeLocalDatabase } from '@/data/local';

export type TrainingOnboardingStatus = 'completed' | 'not_started' | 'skipped';

export type PostLoginDestination = {
  destination: '/(tabs)/today' | '/onboarding/training-profile';
  reason: 'completed' | 'existing_plan' | 'existing_profile' | 'existing_training_data' | 'new_account' | 'skipped';
};

function storageKey(userId: string) {
  return `training_onboarding_status:${userId}`;
}

export async function getTrainingOnboardingStatus(userId: string): Promise<TrainingOnboardingStatus> {
  const value = await SecureStore.getItemAsync(storageKey(userId));
  return value === 'completed' || value === 'skipped' ? value : 'not_started';
}

export async function setTrainingOnboardingStatus(userId: string, status: Exclude<TrainingOnboardingStatus, 'not_started'>) {
  await SecureStore.setItemAsync(storageKey(userId), status);
}

/** Resolves onboarding once per login, after local recovery/pull has had a chance to restore scoped data. */
export async function resolvePostLoginDestination(userId: string): Promise<PostLoginDestination> {
  const status = await getTrainingOnboardingStatus(userId);
  if (status === 'completed' || status === 'skipped') {
    return { destination: '/(tabs)/today', reason: status };
  }

  await initializeLocalDatabase();
  const repositories = createLocalRepositories();
  const groups = await repositories.groupRepository.listGroups();
  const userPlans = await repositories.planRepository.listUserPlans();
  if (userPlans.length > 0 || groups.some((group) => Boolean(group.activePlanId))) {
    return { destination: '/(tabs)/today', reason: 'existing_plan' };
  }

  for (const group of groups) {
    const members = await repositories.memberRepository.listMembers(group.id);
    if (members.length > 0) {
      const hasProfile = await Promise.all(members.map((member) => repositories.memberRepository.getMemberProfile(member.id)))
        .then((profiles) => profiles.some(Boolean));
      return { destination: '/(tabs)/today', reason: hasProfile ? 'existing_profile' : 'existing_training_data' };
    }
  }
  return { destination: '/onboarding/training-profile', reason: 'new_account' };
}
