import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { CreateMemberInput, GroupMember, MemberProfile } from '@/domain/member/member.types';
import type { MemberRepository } from '@/data/repositories/memberRepository';

import type { DatabaseProvider } from './base';
import { requireRow } from './base';
import {
  type GroupMemberRow,
  type MemberProfileRow,
  mapGroupMember,
  mapMemberProfile,
} from './mappers';

export class SQLiteMemberRepository implements MemberRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async listMembers(groupId: string): Promise<GroupMember[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<GroupMemberRow>(
      'SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC',
      groupId,
    );
    return rows.map(mapGroupMember);
  }

  async getMemberProfile(memberId: string): Promise<MemberProfile | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<MemberProfileRow>(
      'SELECT * FROM member_profiles WHERE member_id = ?',
      memberId,
    );
    return row ? mapMemberProfile(row) : null;
  }

  async createMember(input: CreateMemberInput): Promise<GroupMember> {
    const db = await this.getDb();
    const now = nowIso();
    const member: GroupMember = {
      id: input.id ?? createId('member'),
      groupId: input.groupId,
      displayName: input.displayName,
      role: input.role ?? 'member',
      avatarUrl: input.avatarUrl,
      createdAt: now,
      updatedAt: now,
    };

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO group_members (
          id, group_id, display_name, role, avatar_url, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        member.id,
        member.groupId,
        member.displayName,
        member.role,
        member.avatarUrl ?? null,
        member.createdAt,
        member.updatedAt,
      );

      await txn.runAsync(
        `INSERT INTO member_profiles (
          id, member_id, group_id, bodyweight, bench_1rm, squat_1rm, deadlift_1rm,
          overhead_press_1rm, pullup_reference_weight, barbell_increment,
          dumbbell_increment, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createId('profile'),
        member.id,
        member.groupId,
        input.profile?.bodyweight ?? null,
        input.profile?.bench1RM ?? null,
        input.profile?.squat1RM ?? null,
        input.profile?.deadlift1RM ?? null,
        input.profile?.overheadPress1RM ?? null,
        input.profile?.pullupReferenceWeight ?? null,
        input.profile?.barbellIncrement ?? 2.5,
        input.profile?.dumbbellIncrement ?? 2,
        now,
        now,
      );
    });

    return member;
  }

  async updateMember(id: string, patch: Partial<GroupMember>): Promise<GroupMember> {
    const db = await this.getDb();
    const current = await requireRow(
      await db.getFirstAsync<GroupMemberRow>('SELECT * FROM group_members WHERE id = ?', id),
      `未找到成员：${id}`,
    );
    const updated: GroupMember = {
      ...mapGroupMember(current),
      ...patch,
      id,
      groupId: current.group_id,
      createdAt: current.created_at,
      updatedAt: nowIso(),
    };

    await db.runAsync(
      `UPDATE group_members
       SET display_name = ?, role = ?, avatar_url = ?, updated_at = ?
       WHERE id = ?`,
      updated.displayName,
      updated.role,
      updated.avatarUrl ?? null,
      updated.updatedAt,
      id,
    );

    return updated;
  }

  async updateProfile(memberId: string, patch: Partial<MemberProfile>): Promise<MemberProfile> {
    const db = await this.getDb();
    const current = await requireRow(
      await db.getFirstAsync<MemberProfileRow>(
        'SELECT * FROM member_profiles WHERE member_id = ?',
        memberId,
      ),
      `未找到成员资料：${memberId}`,
    );
    const updated: MemberProfile = {
      ...mapMemberProfile(current),
      ...patch,
      id: current.id,
      memberId,
      groupId: current.group_id,
      createdAt: current.created_at,
      updatedAt: nowIso(),
    };

    await db.runAsync(
      `UPDATE member_profiles
       SET bodyweight = ?, bench_1rm = ?, squat_1rm = ?, deadlift_1rm = ?,
           overhead_press_1rm = ?, pullup_reference_weight = ?,
           barbell_increment = ?, dumbbell_increment = ?, updated_at = ?
       WHERE member_id = ?`,
      updated.bodyweight ?? null,
      updated.bench1RM ?? null,
      updated.squat1RM ?? null,
      updated.deadlift1RM ?? null,
      updated.overheadPress1RM ?? null,
      updated.pullupReferenceWeight ?? null,
      updated.barbellIncrement,
      updated.dumbbellIncrement,
      updated.updatedAt,
      memberId,
    );

    return updated;
  }
}
