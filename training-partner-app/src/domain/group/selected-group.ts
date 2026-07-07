import type { GroupRepository } from '@/data/repositories/groupRepository';

import type { Group } from './group.types';

export type SelectedGroupResolution = {
  group: Group | null;
  groups: Group[];
};

export async function resolveSelectedGroup(
  groupRepository: GroupRepository,
  selectedGroupId?: string | null,
): Promise<SelectedGroupResolution> {
  const groups = await groupRepository.listGroups();
  const selected = selectedGroupId
    ? groups.find((group) => group.id === selectedGroupId)
    : undefined;

  return {
    group: selected ?? groups[0] ?? null,
    groups,
  };
}
