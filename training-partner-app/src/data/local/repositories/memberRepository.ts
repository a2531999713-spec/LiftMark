import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { CreateMemberInput, GroupMember, MemberProfile } from '@/domain/member/member.types';
import { DEFAULT_BARBELL_INCREMENT, DEFAULT_DUMBBELL_INCREMENT } from '@/domain/weight/weight-calculator';
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
      userId: input.userId,
      memberType: input.memberType ?? (input.userId ? 'real' : 'local'),
      localMemberId: input.localMemberId ?? (input.userId ? undefined : input.id),
      role: input.role ?? 'member',
      avatarUrl: input.avatarUrl,
      joinedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    member.localMemberId = member.localMemberId ?? (member.memberType === 'local' ? member.id : undefined);

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO group_members (
          id, group_id, display_name, user_id, member_type, local_member_id, role,
          avatar_url, joined_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        member.id,
        member.groupId,
        member.displayName,
        member.userId ?? null,
        member.memberType,
        member.localMemberId ?? null,
        member.role,
        member.avatarUrl ?? null,
        member.joinedAt ?? null,
        member.createdAt,
        member.updatedAt,
      );

      await txn.runAsync(
        `INSERT INTO member_profiles (
          id, member_id, group_id, avatar_url, avatar_thumb_url, avatar_local_uri, avatar_updated_at,
          bodyweight, bench_1rm, squat_1rm, deadlift_1rm,
          overhead_press_1rm, pullup_reference_weight, barbell_increment,
          dumbbell_increment, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createId('profile'),
        member.id,
        member.groupId,
        input.profile?.avatarUrl ?? null,
        input.profile?.avatarThumbUrl ?? null,
        input.profile?.avatarLocalUri ?? null,
        input.profile?.avatarUpdatedAt ?? null,
        input.profile?.bodyweight ?? null,
        input.profile?.bench1RM ?? null,
        input.profile?.squat1RM ?? null,
        input.profile?.deadlift1RM ?? null,
        input.profile?.overheadPress1RM ?? null,
        input.profile?.pullupReferenceWeight ?? null,
        input.profile?.barbellIncrement ?? DEFAULT_BARBELL_INCREMENT,
        input.profile?.dumbbellIncrement ?? DEFAULT_DUMBBELL_INCREMENT,
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
      userId: patch.userId ?? current.user_id ?? undefined,
      memberType: patch.memberType ?? current.member_type ?? (current.user_id ? 'real' : 'local'),
      localMemberId: patch.localMemberId ?? current.local_member_id ?? undefined,
      createdAt: current.created_at,
      joinedAt: patch.joinedAt ?? current.joined_at ?? undefined,
      updatedAt: nowIso(),
    };
    updated.localMemberId = updated.localMemberId ?? (updated.memberType === 'local' ? id : undefined);

    await db.runAsync(
      `UPDATE group_members
       SET display_name = ?, user_id = ?, member_type = ?, local_member_id = ?,
           role = ?, avatar_url = ?, joined_at = ?, updated_at = ?
       WHERE id = ?`,
      updated.displayName,
      updated.userId ?? null,
      updated.memberType,
      updated.localMemberId ?? null,
      updated.role,
      updated.avatarUrl ?? null,
      updated.joinedAt ?? null,
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
       SET avatar_url = ?, avatar_thumb_url = ?, avatar_local_uri = ?, avatar_updated_at = ?,
           bodyweight = ?, bench_1rm = ?, squat_1rm = ?, deadlift_1rm = ?,
           overhead_press_1rm = ?, pullup_reference_weight = ?,
           barbell_increment = ?, dumbbell_increment = ?, updated_at = ?
       WHERE member_id = ?`,
      updated.avatarUrl ?? null,
      updated.avatarThumbUrl ?? null,
      updated.avatarLocalUri ?? null,
      updated.avatarUpdatedAt ?? null,
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

    // 同步更新 group_members 表的 avatar_url，确保首页能正确显示头像
    if (patch.avatarUrl !== undefined) {
      await db.runAsync(
        `UPDATE group_members SET avatar_url = ?, updated_at = ? WHERE id = ?`,
        patch.avatarUrl ?? null,
        updated.updatedAt,
        memberId,
      );
    }

    return updated;
  }
}
