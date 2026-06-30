import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { CreateGroupInput, Group } from '@/domain/group/group.types';
import type { GroupRepository } from '@/data/repositories/groupRepository';

import type { DatabaseProvider } from './base';
import { requireRow } from './base';
import { type GroupRow, mapGroup } from './mappers';

export class SQLiteGroupRepository implements GroupRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getDefaultGroup(): Promise<Group | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<GroupRow>(
      'SELECT * FROM groups ORDER BY created_at ASC LIMIT 1',
    );
    return row ? mapGroup(row) : null;
  }

  async getGroupById(id: string): Promise<Group | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<GroupRow>('SELECT * FROM groups WHERE id = ?', id);
    return row ? mapGroup(row) : null;
  }

  async listGroups(): Promise<Group[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<GroupRow>('SELECT * FROM groups ORDER BY created_at ASC');
    return rows.map(mapGroup);
  }

  async createGroup(input: CreateGroupInput): Promise<Group> {
    const db = await this.getDb();
    const now = nowIso();
    const group: Group = {
      id: input.id ?? createId('group'),
      name: input.name,
      ownerUserId: input.ownerUserId,
      activePlanId: input.activePlanId,
      currentPhaseType: input.currentPhaseType,
      currentWeek: input.currentWeek ?? 1,
      fridayEnabled: input.fridayEnabled ?? false,
      fridayStrategy: input.fridayStrategy ?? (input.fridayEnabled ? 'allow_weak' : 'default_rest'),
      createdAt: now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO groups (
        id, name, owner_user_id, active_plan_id, current_phase_type,
        current_week, friday_enabled, friday_strategy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      group.id,
      group.name,
      group.ownerUserId ?? null,
      group.activePlanId,
      group.currentPhaseType,
      group.currentWeek,
      group.fridayEnabled ? 1 : 0,
      group.fridayStrategy,
      group.createdAt,
      group.updatedAt,
    );

    return group;
  }

  async updateGroup(id: string, patch: Partial<Group>): Promise<Group> {
    const db = await this.getDb();
    const existing = await requireRow(await this.getGroupById(id), `Group not found: ${id}`);
    const updated: Group = {
      ...existing,
      ...patch,
      id,
      createdAt: existing.createdAt,
      updatedAt: nowIso(),
    };

    await db.runAsync(
      `UPDATE groups
       SET name = ?, owner_user_id = ?, active_plan_id = ?, current_phase_type = ?,
           current_week = ?, friday_enabled = ?, friday_strategy = ?, updated_at = ?
       WHERE id = ?`,
      updated.name,
      updated.ownerUserId ?? null,
      updated.activePlanId,
      updated.currentPhaseType,
      updated.currentWeek,
      updated.fridayEnabled ? 1 : 0,
      updated.fridayStrategy,
      updated.updatedAt,
      id,
    );

    return updated;
  }
}
