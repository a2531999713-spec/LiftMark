import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { CreateGroupInput, Group } from '@/domain/group/group.types';
import type { GroupRepository } from '@/data/repositories/groupRepository';

import type { DatabaseProvider } from './base';
import { requireRow } from './base';
import { type GroupRow, mapGroup } from './mappers';
import { getCurrentAccountUserId, getGroupAccountScope, getOwnerUserIdForWrite } from '../accountScope';

export class SQLiteGroupRepository implements GroupRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getDefaultGroup(): Promise<Group | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<GroupRow>(
      `SELECT * FROM groups
       WHERE ${scope.where}
         AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      ...scope.params,
    );
    return row ? mapGroup(row) : null;
  }

  async getGroupById(id: string): Promise<Group | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<GroupRow>(
      `SELECT * FROM groups
       WHERE id = ?
         AND ${scope.where}
         AND deleted_at IS NULL`,
      id,
      ...scope.params,
    );
    return row ? mapGroup(row) : null;
  }

  async listGroups(): Promise<Group[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const rows = await db.getAllAsync<GroupRow>(
      `SELECT * FROM groups
       WHERE ${scope.where}
         AND deleted_at IS NULL
       ORDER BY created_at ASC`,
      ...scope.params,
    );
    return rows.map(mapGroup);
  }

  async createGroup(input: CreateGroupInput): Promise<Group> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const ownerUserId = getOwnerUserIdForWrite(userId, input.ownerUserId);
    const now = nowIso();
    const group: Group = {
      id: input.id ?? createId('group'),
      name: input.name,
      ownerUserId: ownerUserId ?? undefined,
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
    const userId = await getCurrentAccountUserId();
    const existing = await requireRow(await this.getGroupById(id), `Group not found: ${id}`);
    const ownerUserId = existing.ownerUserId ?? getOwnerUserIdForWrite(userId, patch.ownerUserId);
    const updated: Group = {
      ...existing,
      ...patch,
      id,
      ownerUserId: ownerUserId ?? undefined,
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
