import { describe, expect, it, jest } from '@jest/globals';

import type { GroupRepository } from '@/data/repositories/groupRepository';
import { resolveSelectedGroup } from '@/domain/group/selected-group';
import type { Group } from '@/domain/group/group.types';

function group(id: string): Group {
  return {
    activePlanId: `plan_${id}`,
    createdAt: '2026-07-07T00:00:00.000Z',
    currentPhaseType: 'custom',
    currentWeek: 1,
    fridayEnabled: false,
    fridayStrategy: 'default_rest',
    id,
    name: id,
    updatedAt: '2026-07-07T00:00:00.000Z',
  };
}

function repository(groups: Group[]): GroupRepository {
  return {
    createGroup: jest.fn(),
    getDefaultGroup: jest.fn(),
    getGroupById: jest.fn(),
    listGroups: jest.fn(async () => groups),
    updateGroup: jest.fn(),
  } as unknown as GroupRepository;
}

describe('resolveSelectedGroup', () => {
  it('uses the selected group when it is visible', async () => {
    const selected = await resolveSelectedGroup(repository([group('group_a'), group('group_b')]), 'group_b');

    expect(selected.group?.id).toBe('group_b');
  });

  it('falls back to the first visible group when the selection is missing', async () => {
    const selected = await resolveSelectedGroup(repository([group('group_a'), group('group_b')]), 'missing');

    expect(selected.group?.id).toBe('group_a');
  });
});
