import type { ID } from '@/domain/common/ids';
import type { CreateGroupInput, Group } from '@/domain/group/group.types';

export interface GroupRepository {
  getDefaultGroup(): Promise<Group | null>;
  getGroupById(id: ID): Promise<Group | null>;
  createGroup(input: CreateGroupInput): Promise<Group>;
  updateGroup(id: ID, patch: Partial<Group>): Promise<Group>;
}
