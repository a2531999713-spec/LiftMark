import type {
  ListMemberRecoveryLogsInput,
  RecoveryLogDateScope,
  RecoveryLogScope,
  RecoveryRepository,
} from '@/data/repositories/recoveryRepository';
import { nowIso } from '@/domain/common/time';
import type {
  RecoveryLog,
  RecoveryRecommendation,
  RecoveryTrendSummary,
  UpsertRecoveryLogInput,
} from '@/domain/recovery/recovery.types';
import { enqueueSyncCandidate } from '@/sync/syncQueue';

import { getGroupAccountScope, getRequiredCurrentUserId } from '../accountScope';
import type { DatabaseProvider } from './base';

type RecoveryLogRow = {
  appetite_score: number;
  created_at: string;
  date: string;
  deleted_at: string | null;
  fatigue_score: number;
  id: string;
  joint_pain_score: number;
  member_id: string;
  motivation_score: number;
  owner_user_id: string | null;
  recommendation: RecoveryRecommendation;
  remote_id: string | null;
  sleep_score: number;
  soreness_score: number;
  total_score: number;
  updated_at: string;
};

function mapRecoveryLog(row: RecoveryLogRow): RecoveryLog {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id ?? undefined,
    memberId: row.member_id,
    date: row.date,
    sleepScore: row.sleep_score,
    appetiteScore: row.appetite_score,
    motivationScore: row.motivation_score,
    sorenessScore: row.soreness_score,
    jointPainScore: row.joint_pain_score,
    fatigueScore: row.fatigue_score,
    totalScore: row.total_score,
    recommendation: row.recommendation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function buildDeterministicRecoveryId(ownerUserId: string, memberId: string, date: string): string {
  return `recovery_${ownerUserId}_${memberId}_${date}`;
}

const visibleRecoverySelect = `
  SELECT rl.*
  FROM recovery_logs rl
  INNER JOIN group_members gm ON gm.id = rl.member_id AND gm.deleted_at IS NULL
  INNER JOIN groups ON groups.id = gm.group_id AND groups.deleted_at IS NULL
`;

export class SQLiteRecoveryRepository implements RecoveryRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  private async assertScope(scope: RecoveryLogScope): Promise<void> {
    const currentUserId = await getRequiredCurrentUserId();
    if (currentUserId !== scope.ownerUserId) {
      throw new Error('Recovery scope does not match the authenticated account.');
    }
    const db = await this.getDb();
    const accountScope = getGroupAccountScope(currentUserId, 'groups');
    const visibleMember = await db.getFirstAsync<{ id: string }>(
      `SELECT gm.id
       FROM group_members gm
       INNER JOIN groups ON groups.id = gm.group_id
       WHERE gm.id = ?
         AND gm.deleted_at IS NULL
         AND groups.deleted_at IS NULL
         AND ${accountScope.where}
       LIMIT 1`,
      scope.memberId,
      ...accountScope.params,
    );
    if (!visibleMember) {
      throw new Error(`Member not visible for current account: ${scope.memberId}`);
    }
  }

  async getDailyLog(input: RecoveryLogDateScope): Promise<RecoveryLog | null> {
    await this.assertScope(input);
    const db = await this.getDb();
    const accountScope = getGroupAccountScope(input.ownerUserId, 'groups');
    const row = await db.getFirstAsync<RecoveryLogRow>(
      `${visibleRecoverySelect}
       WHERE rl.owner_user_id = ?
         AND rl.member_id = ?
         AND rl.date = ?
         AND rl.deleted_at IS NULL
         AND ${accountScope.where}
       ORDER BY rl.updated_at DESC
       LIMIT 1`,
      input.ownerUserId,
      input.memberId,
      input.date,
      ...accountScope.params,
    );
    return row ? mapRecoveryLog(row) : null;
  }

  async upsertDailyLog(input: UpsertRecoveryLogInput): Promise<RecoveryLog> {
    await this.assertScope(input);
    const db = await this.getDb();
    const now = nowIso();
    let previous: RecoveryLogRow | null = null;
    let saved: RecoveryLog = null!;

    await db.withExclusiveTransactionAsync(async (txn) => {
      previous = await txn.getFirstAsync<RecoveryLogRow>(
        `SELECT * FROM recovery_logs
         WHERE owner_user_id = ? AND member_id = ? AND date = ?
         ORDER BY updated_at DESC LIMIT 1`,
        input.ownerUserId,
        input.memberId,
        input.date,
      );
      const id = previous?.id ?? buildDeterministicRecoveryId(input.ownerUserId, input.memberId, input.date);
      const createdAt = previous?.created_at ?? now;
      await txn.runAsync(
        `INSERT INTO recovery_logs (
          id, owner_user_id, member_id, date, sleep_score, appetite_score,
          motivation_score, soreness_score, joint_pain_score, fatigue_score,
          total_score, recommendation, sync_status, sync_error, deleted_at,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'local_only', NULL, NULL, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          member_id = excluded.member_id,
          date = excluded.date,
          sleep_score = excluded.sleep_score,
          appetite_score = excluded.appetite_score,
          motivation_score = excluded.motivation_score,
          soreness_score = excluded.soreness_score,
          joint_pain_score = excluded.joint_pain_score,
          fatigue_score = excluded.fatigue_score,
          total_score = excluded.total_score,
          recommendation = excluded.recommendation,
          sync_status = CASE WHEN recovery_logs.remote_id IS NULL THEN 'local_only' ELSE 'pending_update' END,
          sync_error = NULL,
          deleted_at = NULL,
          updated_at = excluded.updated_at`,
        id,
        input.ownerUserId,
        input.memberId,
        input.date,
        input.sleepScore,
        input.appetiteScore,
        input.motivationScore,
        input.sorenessScore,
        input.jointPainScore,
        input.fatigueScore,
        input.totalScore,
        input.recommendation,
        createdAt,
        now,
      );
      saved = {
        id,
        ownerUserId: input.ownerUserId,
        memberId: input.memberId,
        date: input.date,
        sleepScore: input.sleepScore,
        appetiteScore: input.appetiteScore,
        motivationScore: input.motivationScore,
        sorenessScore: input.sorenessScore,
        jointPainScore: input.jointPainScore,
        fatigueScore: input.fatigueScore,
        totalScore: input.totalScore,
        recommendation: input.recommendation,
        createdAt,
        updatedAt: now,
      };
    });

    await enqueueSyncCandidate({
      entityType: 'recoveryLogs',
      localId: saved.id,
      operation: previous ? 'update' : 'create',
      ownerUserId: input.ownerUserId,
      payload: saved,
      status: previous ? 'pending_update' : 'pending_create',
      updatedAt: now,
    });
    return saved;
  }

  async listMemberLogs(input: ListMemberRecoveryLogsInput): Promise<RecoveryLog[]> {
    await this.assertScope(input);
    const db = await this.getDb();
    const accountScope = getGroupAccountScope(input.ownerUserId, 'groups');
    const clauses = [
      'rl.owner_user_id = ?',
      'rl.member_id = ?',
      'rl.deleted_at IS NULL',
      accountScope.where,
    ];
    const params: (string | number)[] = [input.ownerUserId, input.memberId, ...accountScope.params];
    if (input.fromDate) {
      clauses.push('rl.date >= ?');
      params.push(input.fromDate);
    }
    if (input.toDate) {
      clauses.push('rl.date <= ?');
      params.push(input.toDate);
    }
    const limit = Math.max(1, Math.min(100, Math.trunc(input.limit ?? 10)));
    params.push(limit);
    const rows = await db.getAllAsync<RecoveryLogRow>(
      `${visibleRecoverySelect}
       WHERE ${clauses.join(' AND ')}
       ORDER BY rl.date DESC, rl.updated_at DESC
       LIMIT ?`,
      ...params,
    );
    return rows.map(mapRecoveryLog);
  }

  async getLatestLog(input: RecoveryLogScope): Promise<RecoveryLog | null> {
    const logs = await this.listMemberLogs({ ...input, limit: 1 });
    return logs[0] ?? null;
  }

  async getRecentAssessmentTrend(
    input: RecoveryLogScope & { limit?: number },
  ): Promise<RecoveryTrendSummary> {
    const logs = await this.listMemberLogs({ ...input, limit: input.limit ?? 10 });
    const lowRecommendations = new Set<RecoveryRecommendation>([
      'reduce_weight',
      'only_a',
      'deload',
      'rest',
    ]);
    const averageScore = logs.length > 0
      ? Math.round((logs.reduce((sum, log) => sum + log.totalScore, 0) / logs.length) * 10) / 10
      : null;
    return {
      logs,
      averageScore,
      goodCount: logs.filter((log) => log.recommendation === 'normal').length,
      lowCount: logs.filter((log) => lowRecommendations.has(log.recommendation)).length,
      hasConsecutiveLowStatus:
        logs.length >= 3 && logs.slice(0, 3).every((log) => lowRecommendations.has(log.recommendation)),
    };
  }

  async softDeleteLog(input: RecoveryLogScope & { id: string }): Promise<void> {
    await this.assertScope(input);
    const db = await this.getDb();
    const accountScope = getGroupAccountScope(input.ownerUserId, 'groups');
    const existing = await db.getFirstAsync<RecoveryLogRow>(
      `${visibleRecoverySelect}
       WHERE rl.id = ? AND rl.owner_user_id = ? AND rl.member_id = ?
         AND rl.deleted_at IS NULL AND ${accountScope.where}
       LIMIT 1`,
      input.id,
      input.ownerUserId,
      input.memberId,
      ...accountScope.params,
    );
    if (!existing) return;
    const now = nowIso();
    await db.runAsync(
      `UPDATE recovery_logs
       SET deleted_at = ?, updated_at = ?, sync_status = 'pending_delete', sync_error = NULL
       WHERE id = ? AND owner_user_id = ?`,
      now,
      now,
      input.id,
      input.ownerUserId,
    );
    await enqueueSyncCandidate({
      entityType: 'recoveryLogs',
      localId: input.id,
      operation: 'delete',
      ownerUserId: input.ownerUserId,
      payload: { id: input.id, memberId: input.memberId, deletedAt: now },
      status: 'pending_delete',
      updatedAt: now,
    });
  }
}
