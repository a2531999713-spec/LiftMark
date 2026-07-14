import type {
  CopySystemSchemeToUserPlanInput,
  CreateUserPlanInput,
  DuplicatePlanInput,
  ImportUserPlanInput,
  PlanRepository,
  UpdateUserPlanInput,
} from '@/data/repositories/planRepository';
import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import { createUserPlanCopyDraft } from '@/domain/plan/planCopy';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
import type {
  GetTodayPlanInput,
  PlanCycle,
  PlanCycleOverview,
  PlanCycleSessionStats,
  PlanCycleSummary,
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  TodayPlanResult,
} from '@/domain/plan/plan.types';
import { filterExercisesByRecovery } from '@/domain/plan/plan.service';
import {
  calculatePlanCycleOverview,
  canArchivePlanCycle,
  canCompletePlanCycle,
} from '@/domain/plan/planCycle.service';

import { requireRow, type DatabaseProvider } from './base';
import { getCurrentAccountUserId, getGroupAccountScope, getPlanAccountScope, getRequiredCurrentUserId } from '../accountScope';
import {
  mapPlanDay,
  mapPlanExercise,
  mapPlanPhase,
  mapPlanCycle,
  mapPlanCycleSummary,
  mapPlanTemplate,
  type PlanCycleRow,
  type PlanCycleSummaryRow,
  type PlanDayRow,
  type PlanExerciseRow,
  type PlanPhaseRow,
  type PlanTemplateRow,
} from './mappers';

const LEGACY_FOUR_DAY_DEFAULT_USER_PLAN_ID = 'plan_user_four_day_strength_hypertrophy_default';
const LEGACY_FOUR_DAY_SCHEME_ID = 'scheme_four_day_strength_hypertrophy';

type UserPlanExerciseInput = CreateUserPlanInput['days'][number]['exercises'][number];

type ImportPlanTransaction = {
  getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null>;
  runAsync(sql: string, ...params: unknown[]): Promise<unknown>;
};

function normalizePlanExerciseInput(exercise: UserPlanExerciseInput, index: number) {
  const hasRepRange =
    (exercise.repMin !== null && exercise.repMin !== undefined) ||
    (exercise.repMax !== null && exercise.repMax !== undefined);
  const repMin = hasRepRange ? Math.max(1, Math.round(exercise.repMin ?? exercise.reps ?? 8)) : null;
  const repMax = hasRepRange ? Math.max(repMin ?? 1, Math.round(exercise.repMax ?? exercise.repMin ?? exercise.reps ?? 12)) : null;
  const reps = hasRepRange ? null : Math.max(1, Math.round(exercise.reps ?? 8));
  const intensityType = exercise.intensityType ?? (exercise.percent1RM ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual');

  return {
    fixedWeight: intensityType === 'fixed' ? exercise.fixedWeight ?? null : null,
    intensityType,
    notes: exercise.notes ?? null,
    percent1RM: intensityType === 'percent_1rm' ? exercise.percent1RM ?? null : null,
    priority: exercise.priority ?? (index === 0 ? 'A' : index <= 2 ? 'B' : 'C'),
    referenceLift: exercise.referenceLift ?? 'none',
    rpeTarget: exercise.rpeTarget ?? null,
    rirTarget: exercise.rirTarget ?? null,
    repMax,
    repMin,
    reps,
    restSeconds: exercise.restSeconds ?? 90,
    sets: Math.max(1, Math.round(exercise.sets ?? 3)),
  };
}

async function resolveImportedEntityId(
  txn: ImportPlanTransaction,
  tableName: 'plan_templates' | 'plan_phases' | 'plan_days' | 'plan_exercises',
  id: string,
  prefix: string,
): Promise<string> {
  const existing = await txn.getFirstAsync<{ id: string }>(
    `SELECT id FROM ${tableName} WHERE id = ?`,
    id,
  );
  return existing ? createId(prefix) : id;
}

export class SQLitePlanRepository implements PlanRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getPlanById(planId: string): Promise<PlanTemplate | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getPlanAccountScope(userId, 'plan_templates');
    const row = await db.getFirstAsync<PlanTemplateRow>(
      `SELECT * FROM plan_templates
       WHERE id = ?
         AND ${scope.where}
       LIMIT 1`,
      planId,
      ...scope.params,
    );
    return row ? mapPlanTemplate(row) : null;
  }

  async listUserPlans(): Promise<PlanTemplate[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    if (!userId) return [];
    const scope = getPlanAccountScope(userId, 'plan_templates');
    const rows = await db.getAllAsync<PlanTemplateRow>(
      `SELECT * FROM plan_templates
       WHERE source != 'system'
         AND ${scope.where}
         AND deleted_at IS NULL
         AND id != ?
         AND COALESCE(origin_scheme_id, '') != ?
       ORDER BY updated_at DESC, created_at DESC`,
      ...scope.params,
      LEGACY_FOUR_DAY_DEFAULT_USER_PLAN_ID,
      LEGACY_FOUR_DAY_SCHEME_ID,
    );
    return rows.map(mapPlanTemplate);
  }

  async getActivePlanCycle(input: { groupId: string; planId: string }): Promise<PlanCycle | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<PlanCycleRow>(
      `SELECT pc.* FROM plan_cycles pc
       INNER JOIN groups ON groups.id = pc.group_id
       WHERE pc.group_id = ?
         AND pc.plan_id = ?
         AND pc.status = 'active'
         AND pc.deleted_at IS NULL
         AND ${scope.where}
       ORDER BY pc.cycle_index DESC, pc.created_at DESC
       LIMIT 1`,
      input.groupId,
      input.planId,
      ...scope.params,
    );
    return row ? mapPlanCycle(row) : null;
  }

  async ensureActivePlanCycle(input: { groupId: string; plan: PlanTemplate; startDate?: string }): Promise<PlanCycle> {
    const existing = await this.getActivePlanCycle({ groupId: input.groupId, planId: input.plan.id });
    if (existing) return existing;

    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const now = nowIso();
    const startDate = input.startDate ?? now.slice(0, 10);
    const nextIndexRow = await db.getFirstAsync<{ max_index: number | null }>(
      `SELECT MAX(cycle_index) AS max_index FROM plan_cycles
       WHERE owner_user_id = ? AND group_id = ? AND plan_id = ?`,
      ownerUserId,
      input.groupId,
      input.plan.id,
    );
    const cycleIndex = (nextIndexRow?.max_index ?? 0) + 1;
    const cycleId = createId('cycle');
    const endDate = new Date(`${startDate}T00:00:00`);
    endDate.setDate(endDate.getDate() + input.plan.durationWeeks * 7 - 1);
    const cycle: PlanCycle = {
      id: cycleId,
      ownerUserId,
      groupId: input.groupId,
      planId: input.plan.id,
      cycleIndex,
      name: `${input.plan.name} 周期 ${cycleIndex}`,
      startDate,
      endDate: endDate.toISOString().slice(0, 10),
      plannedWeeks: input.plan.durationWeeks,
      actualStartDate: startDate,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO plan_cycles (
        id, owner_user_id, group_id, plan_id, cycle_index, name, start_date, end_date,
        planned_weeks, actual_start_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
      cycle.id,
      ownerUserId,
      cycle.groupId,
      cycle.planId,
      cycle.cycleIndex,
      cycle.name,
      cycle.startDate,
      cycle.endDate ?? null,
      cycle.plannedWeeks,
      cycle.actualStartDate ?? null,
      cycle.createdAt,
      cycle.updatedAt,
    );
    await enqueueSyncCandidate({
      entityType: 'planCycles',
      localId: cycle.id,
      operation: 'create',
      ownerUserId,
      payload: cycle,
      status: 'pending_create',
      updatedAt: now,
    });
    return cycle;
  }

  async listPlanCycles(input: { groupId?: string; planId?: string; status?: PlanCycle['status'] }): Promise<PlanCycle[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const clauses = [`pc.deleted_at IS NULL`, scope.where];
    const params: (number | string)[] = [...scope.params];
    if (input.groupId) {
      clauses.push('pc.group_id = ?');
      params.push(input.groupId);
    }
    if (input.planId) {
      clauses.push('pc.plan_id = ?');
      params.push(input.planId);
    }
    if (input.status) {
      clauses.push('pc.status = ?');
      params.push(input.status);
    }
    const rows = await db.getAllAsync<PlanCycleRow>(
      `SELECT pc.* FROM plan_cycles pc
       INNER JOIN groups ON groups.id = pc.group_id
       WHERE ${clauses.join(' AND ')}
       ORDER BY pc.start_date DESC, pc.cycle_index DESC`,
      ...params,
    );
    return rows.map(mapPlanCycle);
  }

  async getPlanCycleSummary(planCycleId: string): Promise<PlanCycleSummary | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<PlanCycleSummaryRow>(
      `SELECT pcs.* FROM plan_cycle_summaries pcs
       INNER JOIN groups ON groups.id = pcs.group_id
       WHERE pcs.plan_cycle_id = ?
         AND pcs.deleted_at IS NULL
         AND ${scope.where}
       ORDER BY pcs.created_at DESC
       LIMIT 1`,
      planCycleId,
      ...scope.params,
    );
    return row ? mapPlanCycleSummary(row) : null;
  }

  private async getVisiblePlanCycle(planCycleId: string): Promise<PlanCycle> {
    const db = await this.getDb();
    const userId = await getRequiredCurrentUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<PlanCycleRow>(
      `SELECT pc.* FROM plan_cycles pc
       INNER JOIN groups ON groups.id = pc.group_id
       WHERE pc.id = ? AND pc.owner_user_id = ? AND pc.deleted_at IS NULL
         AND ${scope.where}
       LIMIT 1`,
      planCycleId,
      userId,
      ...scope.params,
    );
    if (!row) throw new Error(`Plan cycle not visible for current account: ${planCycleId}`);
    return mapPlanCycle(row);
  }

  private async listPlanCycleSessionStats(cycle: PlanCycle): Promise<PlanCycleSessionStats[]> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const [sessionRows, participantRows] = await Promise.all([
      db.getAllAsync<{
        completed_sets: number;
        duration_seconds: number;
        has_report: number;
        report_estimated_calories: number | null;
        report_total_reps: number | null;
        report_total_sets: number | null;
        report_total_volume: number | null;
        session_id: string;
        total_reps: number;
        total_volume: number;
      }>(
        `SELECT ws.id AS session_id,
           COALESCE((SELECT latest.duration_seconds FROM training_reports latest
             WHERE latest.workout_session_id = ws.id AND latest.owner_user_id = ?
               AND latest.deleted_at IS NULL ORDER BY latest.updated_at DESC LIMIT 1),
             CASE WHEN ws.started_at IS NOT NULL AND ws.finished_at IS NOT NULL
               THEN MAX(0, CAST((julianday(ws.finished_at) - julianday(ws.started_at)) * 86400 AS INTEGER)) ELSE 0 END
           ) AS duration_seconds,
           COALESCE((SELECT COUNT(*) FROM workout_sets completed
             WHERE completed.session_id = ws.id AND completed.owner_user_id = ?
               AND completed.completed = 1 AND completed.skipped = 0 AND completed.deleted_at IS NULL), 0) AS completed_sets,
           COALESCE((SELECT SUM(COALESCE(reps.actual_reps, reps.planned_reps, 0)) FROM workout_sets reps
             WHERE reps.session_id = ws.id AND reps.owner_user_id = ?
               AND reps.completed = 1 AND reps.skipped = 0 AND reps.deleted_at IS NULL), 0) AS total_reps,
           COALESCE((SELECT SUM(COALESCE(volume.actual_weight, volume.planned_weight, 0)
               * COALESCE(volume.actual_reps, volume.planned_reps, 0)) FROM workout_sets volume
             WHERE volume.session_id = ws.id AND volume.owner_user_id = ?
               AND volume.completed = 1 AND volume.skipped = 0 AND volume.deleted_at IS NULL), 0) AS total_volume,
           CASE WHEN report.id IS NULL THEN 0 ELSE 1 END AS has_report,
           report.total_sets AS report_total_sets, report.total_reps AS report_total_reps,
           report.total_volume AS report_total_volume,
           report.estimated_calories AS report_estimated_calories
         FROM workout_sessions ws
         LEFT JOIN training_reports report ON report.id = (
           SELECT latest.id FROM training_reports latest
           WHERE latest.workout_session_id = ws.id AND latest.owner_user_id = ? AND latest.deleted_at IS NULL
           ORDER BY latest.updated_at DESC LIMIT 1
         )
         WHERE ws.owner_user_id = ? AND ws.group_id = ? AND ws.plan_cycle_id = ?
           AND ws.status = 'completed' AND ws.deleted_at IS NULL
         ORDER BY ws.date ASC, ws.id ASC`,
        ownerUserId,
        ownerUserId,
        ownerUserId,
        ownerUserId,
        ownerUserId,
        ownerUserId,
        cycle.groupId,
        cycle.id,
      ),
      db.getAllAsync<{ bodyweight: number | null; member_id: string; session_id: string }>(
        `SELECT DISTINCT workout_set.session_id, workout_set.member_id, mp.bodyweight
         FROM workout_sets workout_set
         INNER JOIN workout_sessions session_scope ON session_scope.id = workout_set.session_id
         LEFT JOIN member_profiles mp ON mp.member_id = workout_set.member_id AND mp.deleted_at IS NULL
         WHERE session_scope.owner_user_id = ? AND session_scope.group_id = ?
           AND session_scope.plan_cycle_id = ? AND session_scope.status = 'completed'
           AND session_scope.deleted_at IS NULL AND workout_set.owner_user_id = ?
           AND workout_set.deleted_at IS NULL`,
        ownerUserId,
        cycle.groupId,
        cycle.id,
        ownerUserId,
      ),
    ]);
    const bodyweightsBySession = new Map<string, (number | undefined)[]>();
    for (const participant of participantRows) {
      const weights = bodyweightsBySession.get(participant.session_id) ?? [];
      weights.push(participant.bodyweight && participant.bodyweight > 0 ? participant.bodyweight : undefined);
      bodyweightsBySession.set(participant.session_id, weights);
    }
    return sessionRows.map((session) => ({
      bodyweightsKg: bodyweightsBySession.get(session.session_id) ?? [undefined],
      completedSets: session.completed_sets,
      durationSeconds: session.duration_seconds,
      hasReport: session.has_report === 1,
      reportEstimatedCalories: session.report_estimated_calories ?? undefined,
      reportTotalReps: session.report_total_reps ?? undefined,
      reportTotalSets: session.report_total_sets ?? undefined,
      reportTotalVolume: session.report_total_volume ?? undefined,
      sessionId: session.session_id,
      totalReps: session.total_reps,
      totalVolume: session.total_volume,
    }));
  }

  async getPlanCycleOverview(planCycleId: string): Promise<PlanCycleOverview> {
    const db = await this.getDb();
    const cycle = await this.getVisiblePlanCycle(planCycleId);
    const ownerUserId = await getRequiredCurrentUserId();
    const plan = await db.getFirstAsync<{ frequency_per_week: number; name: string }>(
      `SELECT name, frequency_per_week FROM plan_templates
       WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL LIMIT 1`,
      cycle.planId,
      ownerUserId,
    );
    return calculatePlanCycleOverview({
      cycle,
      frequencyPerWeek: plan?.frequency_per_week ?? 0,
      planName: plan?.name ?? '训练计划',
      sessions: await this.listPlanCycleSessionStats(cycle),
    });
  }

  async recalculatePlanCycleSummary(planCycleId: string): Promise<PlanCycleSummary> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const overview = await this.getPlanCycleOverview(planCycleId);
    const now = nowIso();
    let operation: 'create' | 'update' = 'create';
    let createdAt = now;
    let summaryId = createId('cycle_summary');
    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await txn.getFirstAsync<{ created_at: string; id: string }>(
        `SELECT id, created_at FROM plan_cycle_summaries
         WHERE owner_user_id = ? AND plan_cycle_id = ? AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
        ownerUserId,
        planCycleId,
      );
      if (existing) {
        operation = 'update';
        createdAt = existing.created_at;
        summaryId = existing.id;
        await txn.runAsync(
          `UPDATE plan_cycle_summaries SET
             group_id = ?, plan_id = ?, planned_workout_count = ?, completed_workout_count = ?,
             skipped_workout_count = ?, completion_rate = ?, total_volume = ?, total_sets = ?,
             total_reps = ?, total_duration_seconds = ?, estimated_calories = ?, summary_text = ?,
             sync_status = 'pending_update', updated_at = ?
           WHERE id = ? AND owner_user_id = ?`,
          overview.cycle.groupId,
          overview.cycle.planId,
          overview.plannedWorkoutCount,
          overview.completedWorkoutCount,
          overview.skippedWorkoutCount,
          overview.completionRate,
          overview.totalVolume,
          overview.totalSets,
          overview.totalReps,
          overview.totalDurationSeconds,
          overview.estimatedCalories,
          '周期统计已按当前训练记录重新计算。',
          now,
          summaryId,
          ownerUserId,
        );
      } else {
        await txn.runAsync(
          `INSERT INTO plan_cycle_summaries (
             id, owner_user_id, group_id, plan_id, plan_cycle_id, planned_workout_count,
             completed_workout_count, skipped_workout_count, completion_rate, total_volume,
             total_sets, total_reps, total_duration_seconds, estimated_calories, summary_text,
             sync_status, created_at, updated_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_create', ?, ?)`,
          summaryId,
          ownerUserId,
          overview.cycle.groupId,
          overview.cycle.planId,
          overview.cycle.id,
          overview.plannedWorkoutCount,
          overview.completedWorkoutCount,
          overview.skippedWorkoutCount,
          overview.completionRate,
          overview.totalVolume,
          overview.totalSets,
          overview.totalReps,
          overview.totalDurationSeconds,
          overview.estimatedCalories,
          '周期统计已按当前训练记录重新计算。',
          now,
          now,
        );
      }
    });
    const summary: PlanCycleSummary = {
      completedWorkoutCount: overview.completedWorkoutCount,
      completionRate: overview.completionRate,
      createdAt,
      estimatedCalories: overview.estimatedCalories,
      groupId: overview.cycle.groupId,
      id: summaryId,
      ownerUserId,
      planCycleId: overview.cycle.id,
      planId: overview.cycle.planId,
      plannedWorkoutCount: overview.plannedWorkoutCount,
      skippedWorkoutCount: overview.skippedWorkoutCount,
      summaryText: '周期统计已按当前训练记录重新计算。',
      totalDurationSeconds: overview.totalDurationSeconds,
      totalReps: overview.totalReps,
      totalSets: overview.totalSets,
      totalVolume: overview.totalVolume,
      updatedAt: now,
    };
    await enqueueSyncCandidate({
      entityType: 'planCycleSummaries',
      localId: summary.id,
      operation,
      ownerUserId,
      payload: summary,
      status: operation === 'create' ? 'pending_create' : 'pending_update',
      updatedAt: now,
    });
    return summary;
  }

  async completePlanCycle(input: { planCycleId: string }): Promise<PlanCycleSummary> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const cycle = await this.getVisiblePlanCycle(input.planCycleId);
    if (cycle.status === 'abandoned') throw new Error('已放弃的周期不能标记为完成。');
    if (canCompletePlanCycle(cycle.status)) {
      const now = nowIso();
      await db.runAsync(
        `UPDATE plan_cycles SET status = 'completed', completed_at = ?,
           actual_end_date = COALESCE(actual_end_date, ?), sync_status = 'pending_update', updated_at = ?
         WHERE id = ? AND owner_user_id = ?`,
        now,
        now.slice(0, 10),
        now,
        cycle.id,
        ownerUserId,
      );
      await enqueueSyncCandidate({
        entityType: 'planCycles',
        localId: cycle.id,
        operation: 'update',
        ownerUserId,
        payload: { completedAt: now, id: cycle.id, status: 'completed' },
        status: 'pending_update',
        updatedAt: now,
      });
    }
    return this.recalculatePlanCycleSummary(cycle.id);
  }

  async archivePlanCycle(input: { planCycleId: string }): Promise<PlanCycleSummary> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const cycle = await this.getVisiblePlanCycle(input.planCycleId);
    if (!canArchivePlanCycle(cycle.status)) throw new Error('请先结束当前周期，再进行归档。');
    const summary = await this.recalculatePlanCycleSummary(cycle.id);
    if (cycle.status === 'archived') return summary;
    const now = nowIso();
    await db.runAsync(
      `UPDATE plan_cycles SET status = 'archived', archived_at = ?,
         actual_end_date = COALESCE(actual_end_date, ?), sync_status = 'pending_update', updated_at = ?
       WHERE id = ? AND owner_user_id = ?`,
      now,
      now.slice(0, 10),
      now,
      cycle.id,
      ownerUserId,
    );
    await enqueueSyncCandidate({
      entityType: 'planCycles',
      localId: cycle.id,
      operation: 'update',
      ownerUserId,
      payload: { archivedAt: now, id: cycle.id, status: 'archived' },
      status: 'pending_update',
      updatedAt: now,
    });
    return summary;
  }

  async listPlanPhases(planId: string): Promise<PlanPhase[]> {
    const plan = await this.getPlanById(planId);
    if (!plan) return [];
    const db = await this.getDb();
    const rows = await db.getAllAsync<PlanPhaseRow>(
      'SELECT * FROM plan_phases WHERE plan_id = ? ORDER BY order_index ASC',
      planId,
    );
    return rows.map(mapPlanPhase);
  }

  async listPlanDays(planId: string): Promise<PlanDay[]> {
    const plan = await this.getPlanById(planId);
    if (!plan) return [];
    const db = await this.getDb();
    const rows = await db.getAllAsync<PlanDayRow>(
      'SELECT * FROM plan_days WHERE plan_id = ? ORDER BY week ASC, weekday ASC',
      planId,
    );
    return rows.map(mapPlanDay);
  }

  async listPlanExercises(planDayId: string): Promise<PlanExercise[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getPlanAccountScope(userId, 'pt');
    const rows = await db.getAllAsync<PlanExerciseRow>(
      `SELECT pe.* FROM plan_exercises pe
       INNER JOIN plan_days pd ON pd.id = pe.plan_day_id
       INNER JOIN plan_templates pt ON pt.id = pd.plan_id
       WHERE pe.plan_day_id = ?
         AND ${scope.where}
       ORDER BY pe.order_index ASC`,
      planDayId,
      ...scope.params,
    );
    return rows.map(mapPlanExercise);
  }

  async listPlanExercisesForDays(planDayIds: string[]): Promise<PlanExercise[]> {
    if (planDayIds.length === 0) return [];

    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getPlanAccountScope(userId, 'pt');
    const placeholders = planDayIds.map(() => '?').join(', ');
    const rows = await db.getAllAsync<PlanExerciseRow>(
      `SELECT pe.* FROM plan_exercises pe
       INNER JOIN plan_days pd ON pd.id = pe.plan_day_id
       INNER JOIN plan_templates pt ON pt.id = pd.plan_id
       WHERE pe.plan_day_id IN (${placeholders})
         AND ${scope.where}
       ORDER BY pd.week ASC, pd.weekday ASC, pe.order_index ASC`,
      ...planDayIds,
      ...scope.params,
    );
    return rows.map(mapPlanExercise);
  }

  async createUserPlan(input: CreateUserPlanInput): Promise<PlanTemplate> {
    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const now = nowIso();
    const plan: PlanTemplate = {
      id: createId('plan'),
      creatorId: ownerUserId ?? undefined,
      name: input.name.trim() || '我的训练计划',
      visibility: 'private',
      goal: input.goal,
      durationWeeks: Math.max(1, Math.round(input.durationWeeks)),
      frequencyPerWeek: Math.max(1, Math.round(input.frequencyPerWeek)),
      description: '用户创建的训练计划',
      source: 'blank_created',
      status: 'draft',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const phaseId = createId('phase');

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        plan.id,
        ownerUserId,
        plan.name,
        plan.creatorId ?? null,
        plan.visibility,
        plan.goal,
        plan.durationWeeks,
        plan.frequencyPerWeek,
        plan.description ?? null,
        plan.source,
        plan.originSchemeId ?? null,
        plan.version,
        plan.status ?? 'draft',
        plan.createdAt,
        plan.updatedAt,
      );

      await txn.runAsync(
        `INSERT INTO plan_phases (
          id, owner_user_id, plan_id, name, type, start_week, end_week, order_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        phaseId,
        ownerUserId,
        plan.id,
        '基础周期',
        plan.goal === 'hypertrophy' ? 'hypertrophy' : plan.goal === 'strength' ? 'strength' : 'custom',
        1,
        plan.durationWeeks,
        1,
        plan.createdAt,
        plan.updatedAt,
      );

      for (const [dayIndex, day] of input.days.entries()) {
        const planDayId = createId('day');
        await txn.runAsync(
          `INSERT INTO plan_days (
            id, owner_user_id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          planDayId,
          ownerUserId,
          plan.id,
          phaseId,
          Math.max(1, Math.round(day.week ?? 1)),
          day.weekday,
          day.title.trim() || `Day ${dayIndex + 1}`,
          day.focus.trim() || '自定义训练',
          '用户创建的训练日',
        );

        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          const normalizedExercise = normalizePlanExerciseInput(exercise, exerciseIndex);
          await txn.runAsync(
            `INSERT INTO plan_exercises (
              id, owner_user_id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
              intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
              rest_seconds, progression_rule_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            createId('plan_exercise'),
            ownerUserId,
            planDayId,
            exercise.exerciseId,
            normalizedExercise.priority,
            exerciseIndex + 1,
            normalizedExercise.sets,
            normalizedExercise.reps,
            normalizedExercise.repMin,
            normalizedExercise.repMax,
            normalizedExercise.intensityType,
            normalizedExercise.percent1RM,
            normalizedExercise.rpeTarget,
            normalizedExercise.rirTarget,
            normalizedExercise.fixedWeight,
            normalizedExercise.referenceLift,
            normalizedExercise.restSeconds,
            null,
            normalizedExercise.notes,
          );
        }
      }
    });

    await this.enqueuePlanSync(plan.id, ownerUserId, 'create');
    return plan;
  }

  async updateUserPlan(input: UpdateUserPlanInput): Promise<PlanTemplate> {
    const current = await requireRow(await this.getPlanById(input.planId), `未找到计划：${input.planId}`);

    if (current.source === 'system' || current.visibility === 'system') {
      throw new Error('系统方案是只读模板，不能直接编辑。');
    }

    const db = await this.getDb();
    const ownerUserId = current.creatorId ?? await getRequiredCurrentUserId();
    const now = nowIso();
    const updated: PlanTemplate = {
      ...current,
      name: input.name.trim() || current.name,
      goal: input.goal,
      durationWeeks: Math.max(1, Math.round(input.durationWeeks)),
      frequencyPerWeek: Math.max(1, Math.round(input.frequencyPerWeek)),
      updatedAt: now,
    };
    const phaseId = createId('phase');

    await db.withExclusiveTransactionAsync(async (txn) => {
      const existingDays = await txn.getAllAsync<{ id: string }>(
        'SELECT id FROM plan_days WHERE plan_id = ?',
        input.planId,
      );

      for (const day of existingDays) {
        await txn.runAsync('DELETE FROM plan_exercises WHERE plan_day_id = ?', day.id);
      }

      await txn.runAsync('DELETE FROM plan_days WHERE plan_id = ?', input.planId);
      await txn.runAsync('DELETE FROM plan_phases WHERE plan_id = ?', input.planId);

      await txn.runAsync(
        `UPDATE plan_templates
         SET name = ?, goal = ?, duration_weeks = ?, frequency_per_week = ?, updated_at = ?
         WHERE id = ?`,
        updated.name,
        updated.goal,
        updated.durationWeeks,
        updated.frequencyPerWeek,
        updated.updatedAt,
        updated.id,
      );

      await txn.runAsync(
        `INSERT INTO plan_phases (
          id, owner_user_id, plan_id, name, type, start_week, end_week, order_index, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        phaseId,
        ownerUserId,
        updated.id,
        '基础周期',
        updated.goal === 'hypertrophy' ? 'hypertrophy' : updated.goal === 'strength' ? 'strength' : 'custom',
        1,
        updated.durationWeeks,
        1,
        updated.createdAt,
        updated.updatedAt,
      );

      for (const [dayIndex, day] of input.days.entries()) {
        const planDayId = createId('day');
        await txn.runAsync(
          `INSERT INTO plan_days (
            id, owner_user_id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          planDayId,
          ownerUserId,
          updated.id,
          phaseId,
          Math.max(1, Math.round(day.week ?? 1)),
          day.weekday,
          day.title.trim() || `Day ${dayIndex + 1}`,
          day.focus.trim() || '自定义训练',
          '用户编辑的训练日',
        );

        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          const normalizedExercise = normalizePlanExerciseInput(exercise, exerciseIndex);
          await txn.runAsync(
            `INSERT INTO plan_exercises (
              id, owner_user_id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
              intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
              rest_seconds, progression_rule_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            createId('plan_exercise'),
            ownerUserId,
            planDayId,
            exercise.exerciseId,
            normalizedExercise.priority,
            exerciseIndex + 1,
            normalizedExercise.sets,
            normalizedExercise.reps,
            normalizedExercise.repMin,
            normalizedExercise.repMax,
            normalizedExercise.intensityType,
            normalizedExercise.percent1RM,
            normalizedExercise.rpeTarget,
            normalizedExercise.rirTarget,
            normalizedExercise.fixedWeight,
            normalizedExercise.referenceLift,
            normalizedExercise.restSeconds,
            null,
            normalizedExercise.notes,
          );
        }
      }
    });

    await this.enqueuePlanSync(updated.id, ownerUserId, 'update');
    return updated;
  }

  async copySystemSchemeToUserPlan(input: CopySystemSchemeToUserPlanInput): Promise<PlanTemplate> {
    const templatePlanId = input.scheme.templatePlanId;

    if (!templatePlanId || !input.scheme.isAvailable) {
      throw new Error('该系统方案暂未开放复制。');
    }

    const sourceTemplate = await requireRow(
      await this.getPlanById(templatePlanId),
      `未找到系统方案模板：${templatePlanId}`,
    );
    const phases = await this.listPlanPhases(templatePlanId);
    const days = await this.listPlanDays(templatePlanId);
    const exercises = await this.listPlanExercisesForDays(days.map((day) => day.id));
    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases,
      days,
      exercises,
      name: input.name,
      originSchemeId: input.scheme.id,
    });
    const ownerUserId = await getRequiredCurrentUserId();
    const template = {
      ...draft.template,
      creatorId: ownerUserId ?? draft.template.creatorId,
      status: 'active' as const,
    };

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        template.id,
        ownerUserId,
        template.name,
        template.creatorId ?? null,
        template.visibility,
        template.goal,
        template.durationWeeks,
        template.frequencyPerWeek,
        template.description ?? null,
        template.source,
        template.originSchemeId ?? null,
        template.version,
        template.status ?? 'active',
        template.createdAt,
        template.updatedAt,
      );

      for (const phase of draft.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, owner_user_id, plan_id, name, type, start_week, end_week, order_index, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
          ownerUserId,
          phase.planId,
          phase.name,
          phase.type,
          phase.startWeek,
          phase.endWeek,
          phase.orderIndex,
          template.createdAt,
          template.updatedAt,
        );
      }

      for (const day of draft.days) {
        await txn.runAsync(
          `INSERT INTO plan_days (
            id, owner_user_id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          day.id,
          ownerUserId,
          day.planId,
          day.phaseId,
          day.week,
          day.weekday,
          day.title,
          day.focus,
          day.notes ?? null,
        );
      }

      for (const exercise of draft.exercises) {
        await txn.runAsync(
          `INSERT INTO plan_exercises (
            id, owner_user_id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
            intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
            rest_seconds, progression_rule_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          ownerUserId,
          exercise.planDayId,
          exercise.exerciseId,
          exercise.priority,
          exercise.orderIndex,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.repMin ?? null,
          exercise.repMax ?? null,
          exercise.percent1RM ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
          exercise.percent1RM ?? null,
          null,
          null,
          exercise.fixedWeight ?? null,
          exercise.referenceLift,
          exercise.restSeconds ?? null,
          exercise.progressionRuleId ?? null,
          exercise.notes ?? null,
        );
      }
    });

    await this.enqueuePlanSync(template.id, ownerUserId, 'create');
    return template;
  }

  // 复制任意计划（系统方案或用户自建）为当前用户的私有副本
  // 用于「编辑系统计划」入口：先复制再进入编辑
  async duplicatePlan(input: DuplicatePlanInput): Promise<PlanTemplate> {
    const sourceTemplate = await requireRow(
      await this.getPlanById(input.sourcePlanId),
      `未找到源计划：${input.sourcePlanId}`,
    );
    const phases = await this.listPlanPhases(input.sourcePlanId);
    const days = await this.listPlanDays(input.sourcePlanId);
    const exercises = await this.listPlanExercisesForDays(days.map((day) => day.id));
    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases,
      days,
      exercises,
      name: input.name ?? `${sourceTemplate.name}（我的）`,
      originSchemeId: sourceTemplate.originSchemeId ?? sourceTemplate.id,
    });
    const ownerUserId = await getRequiredCurrentUserId();
    const template = {
      ...draft.template,
      creatorId: ownerUserId ?? draft.template.creatorId,
      source: 'duplicated' as const,
      status: 'draft' as const,
    };

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        template.id,
        ownerUserId,
        template.name,
        template.creatorId ?? null,
        template.visibility,
        template.goal,
        template.durationWeeks,
        template.frequencyPerWeek,
        template.description ?? null,
        template.source,
        template.originSchemeId ?? null,
        template.version,
        template.status ?? 'draft',
        template.createdAt,
        template.updatedAt,
      );

      for (const phase of draft.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, owner_user_id, plan_id, name, type, start_week, end_week, order_index, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
          ownerUserId,
          phase.planId,
          phase.name,
          phase.type,
          phase.startWeek,
          phase.endWeek,
          phase.orderIndex,
          template.createdAt,
          template.updatedAt,
        );
      }

      for (const day of draft.days) {
        await txn.runAsync(
          `INSERT INTO plan_days (
            id, owner_user_id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          day.id,
          ownerUserId,
          day.planId,
          day.phaseId,
          day.week,
          day.weekday,
          day.title,
          day.focus,
          day.notes ?? null,
        );
      }

      for (const exercise of draft.exercises) {
        await txn.runAsync(
          `INSERT INTO plan_exercises (
            id, owner_user_id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
            intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
            rest_seconds, progression_rule_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          ownerUserId,
          exercise.planDayId,
          exercise.exerciseId,
          exercise.priority,
          exercise.orderIndex,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.repMin ?? null,
          exercise.repMax ?? null,
          exercise.percent1RM ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
          exercise.percent1RM ?? null,
          null,
          null,
          exercise.fixedWeight ?? null,
          exercise.referenceLift,
          exercise.restSeconds ?? null,
          exercise.progressionRuleId ?? null,
          exercise.notes ?? null,
        );
      }
    });

    await this.enqueuePlanSync(template.id, ownerUserId, 'create');
    return template;
  }

  async importUserPlan(input: ImportUserPlanInput): Promise<PlanTemplate> {
    if (input.template.source === 'system') {
      throw new Error('系统方案不能直接导入为当前训练计划。');
    }

    const db = await this.getDb();
    const ownerUserId = await getRequiredCurrentUserId();
    const exerciseIdByImportedId = new Map<string, string>();
    const phaseIdByImportedId = new Map<string, string>();
    const dayIdByImportedId = new Map<string, string>();
    const planExerciseIdByImportedId = new Map<string, string>();
    let finalPlanId = input.template.id;

    await db.withExclusiveTransactionAsync(async (txn) => {
      // 检查 plan ID 是否已存在：存在则生成新 ID 避免覆盖已有计划，
      // 不存在则保留原 ID（用于重装后重新导入时与旧训练记录 plan_id 重新关联）
      const planId = await resolveImportedEntityId(txn, 'plan_templates', input.template.id, 'plan_imported');
      finalPlanId = planId;

      for (const phase of input.phases) {
        phaseIdByImportedId.set(
          phase.id,
          await resolveImportedEntityId(txn, 'plan_phases', phase.id, 'phase_imported'),
        );
      }

      for (const day of input.days) {
        dayIdByImportedId.set(
          day.id,
          await resolveImportedEntityId(txn, 'plan_days', day.id, 'day_imported'),
        );
      }

      for (const exercise of input.planExercises) {
        planExerciseIdByImportedId.set(
          exercise.id,
          await resolveImportedEntityId(txn, 'plan_exercises', exercise.id, 'plan_exercise_imported'),
        );
      }

      for (const exercise of input.exercises) {
        const existingByName = await txn.getFirstAsync<{ id: string }>(
          'SELECT id FROM exercises WHERE lower(name) = lower(?) ORDER BY source ASC LIMIT 1',
          exercise.name.trim(),
        );

        if (existingByName) {
          exerciseIdByImportedId.set(exercise.id, existingByName.id);
          continue;
        }

        await txn.runAsync(
          `INSERT INTO exercises (
            id, name, source, category, movement_pattern, target_muscle, secondary_muscle,
            equipment, difficulty, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          exercise.name,
          exercise.source === 'system' ? 'system' : 'custom',
          exercise.category,
          exercise.movementPattern,
          exercise.targetMuscle,
          exercise.secondaryMuscle ?? null,
          exercise.equipment,
          exercise.difficulty ?? null,
          exercise.notes ?? null,
          exercise.createdAt,
          exercise.updatedAt,
        );
        exerciseIdByImportedId.set(exercise.id, exercise.id);
      }

      for (const alternative of input.alternatives) {
        const exerciseId = exerciseIdByImportedId.get(alternative.exerciseId) ?? alternative.exerciseId;
        const alternativeExerciseId =
          exerciseIdByImportedId.get(alternative.alternativeExerciseId) ?? alternative.alternativeExerciseId;

        await txn.runAsync(
          `INSERT OR IGNORE INTO exercise_alternatives (
            id, exercise_id, alternative_exercise_id, reason
          ) VALUES (?, ?, ?, ?)`,
          alternative.id,
          exerciseId,
          alternativeExerciseId,
          alternative.reason ?? null,
        );
      }

      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        planId,
        ownerUserId,
        input.template.name,
        ownerUserId ?? input.template.creatorId ?? null,
        'private',
        input.template.goal,
        input.template.durationWeeks,
        input.template.frequencyPerWeek,
        input.template.description ?? null,
        'imported',
        input.template.originSchemeId ?? null,
        input.template.version,
        'active',
        input.template.createdAt,
        input.template.updatedAt,
      );

      for (const phase of input.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, owner_user_id, plan_id, name, type, start_week, end_week, order_index, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          phaseIdByImportedId.get(phase.id) ?? phase.id,
          ownerUserId,
          planId,
          phase.name,
          phase.type,
          phase.startWeek,
          phase.endWeek,
          phase.orderIndex,
          input.template.createdAt,
          input.template.updatedAt,
        );
      }

      for (const day of input.days) {
        await txn.runAsync(
          `INSERT INTO plan_days (
            id, owner_user_id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          dayIdByImportedId.get(day.id) ?? day.id,
          ownerUserId,
          planId,
          phaseIdByImportedId.get(day.phaseId) ?? day.phaseId,
          day.week,
          day.weekday,
          day.title,
          day.focus,
          day.notes ?? null,
        );
      }

      for (const exercise of input.planExercises) {
        await txn.runAsync(
          `INSERT INTO plan_exercises (
            id, owner_user_id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
            intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
            rest_seconds, progression_rule_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          planExerciseIdByImportedId.get(exercise.id) ?? exercise.id,
          ownerUserId,
          dayIdByImportedId.get(exercise.planDayId) ?? exercise.planDayId,
          exerciseIdByImportedId.get(exercise.exerciseId) ?? exercise.exerciseId,
          exercise.priority,
          exercise.orderIndex,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.repMin ?? null,
          exercise.repMax ?? null,
          exercise.percent1RM ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
          exercise.percent1RM ?? null,
          null,
          null,
          exercise.fixedWeight ?? null,
          exercise.referenceLift,
          exercise.restSeconds ?? null,
          exercise.progressionRuleId ?? null,
          exercise.notes ?? null,
        );
      }
    });

    const importedTemplate = {
      ...input.template,
      id: finalPlanId,
      creatorId: ownerUserId ?? input.template.creatorId,
      source: 'imported',
      status: 'active',
      visibility: 'private',
    } as const;

    await this.enqueuePlanSync(importedTemplate.id, ownerUserId, 'create');
    return importedTemplate;
  }

  // 将计划及其子节点（阶段/训练日/动作）入队同步
  private async enqueuePlanSync(planId: string, ownerUserId: string | null, operation: 'create' | 'update'): Promise<void> {
    const now = nowIso();
    const db = await this.getDb();

    // 计划本身
    await enqueueSyncCandidate({
      entityType: 'trainingPlans',
      localId: planId,
      operation,
      ownerUserId,
      status: operation === 'create' ? 'pending_create' : 'pending_update',
      updatedAt: now,
    }).catch(() => undefined);

    // 阶段
    const phaseRows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM plan_phases WHERE plan_id = ? AND deleted_at IS NULL',
      planId,
    );
    await Promise.all(
      phaseRows.map((phase) =>
        enqueueSyncCandidate({
          entityType: 'planPhases',
          localId: phase.id,
          operation,
          ownerUserId,
          status: operation === 'create' ? 'pending_create' : 'pending_update',
          updatedAt: now,
        }).catch(() => undefined),
      ),
    );

    // 训练日
    const dayRows = await db.getAllAsync<{ id: string }>(
      'SELECT id FROM plan_days WHERE plan_id = ?',
      planId,
    );
    await Promise.all(
      dayRows.map((day) =>
        enqueueSyncCandidate({
          entityType: 'planDays',
          localId: day.id,
          operation,
          ownerUserId,
          status: operation === 'create' ? 'pending_create' : 'pending_update',
          updatedAt: now,
        }).catch(() => undefined),
      ),
    );

    // 训练日下的动作
    const exerciseRows = await db.getAllAsync<{ id: string }>(
      `SELECT pe.id FROM plan_exercises pe
       INNER JOIN plan_days pd ON pd.id = pe.plan_day_id
       WHERE pd.plan_id = ?`,
      planId,
    );
    await Promise.all(
      exerciseRows.map((exercise) =>
        enqueueSyncCandidate({
          entityType: 'planExercises',
          localId: exercise.id,
          operation,
          ownerUserId,
          status: operation === 'create' ? 'pending_create' : 'pending_update',
          updatedAt: now,
        }).catch(() => undefined),
      ),
    );
  }

  async deleteUserPlan(planId: string): Promise<void> {
    const plan = await requireRow(await this.getPlanById(planId), `未找到计划：${planId}`);

    if (plan.source === 'system' || plan.visibility === 'system') {
      throw new Error('系统方案是只读模板，不能删除。');
    }

    const userPlans = await this.listUserPlans();
    if (userPlans.length <= 1) {
      throw new Error('至少需要保留一个我的计划。');
    }

    const db = await this.getDb();
    const userId = await getRequiredCurrentUserId();
    const groupScope = getGroupAccountScope(userId, 'groups');
    const activeGroup = await db.getFirstAsync<{ id: string }>(
      `SELECT id FROM groups
       WHERE active_plan_id = ?
         AND ${groupScope.where}
         AND deleted_at IS NULL
       LIMIT 1`,
      planId,
      ...groupScope.params,
    );

    if (activeGroup) {
      throw new Error('当前训练计划不能删除，请先切换到其他计划。');
    }

    await db.withExclusiveTransactionAsync(async (txn) => {
      const days = await txn.getAllAsync<{ id: string }>(
        'SELECT id FROM plan_days WHERE plan_id = ?',
        planId,
      );

      for (const day of days) {
        await txn.runAsync('DELETE FROM plan_exercises WHERE plan_day_id = ?', day.id);
      }

      await txn.runAsync('DELETE FROM plan_days WHERE plan_id = ?', planId);
      await txn.runAsync('DELETE FROM plan_phases WHERE plan_id = ?', planId);
      // 软删除 plan_templates，防止 fullPull 重新插入已删除的计划（硬删除后
      // upsertWithRemoteId 找不到 existing 会重新 INSERT，导致"删了又跳出来"）
      const deleteTs = nowIso();
      await txn.runAsync(
        `UPDATE plan_templates
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE id = ?`,
        deleteTs,
        deleteTs,
        planId,
      );
    });

    // 计划删除入队同步
    const now = nowIso();
    await enqueueSyncCandidate({
      entityType: 'trainingPlans',
      localId: planId,
      operation: 'delete',
      ownerUserId: userId,
      status: 'pending_delete',
      updatedAt: now,
    }).catch(() => undefined);
  }

  async getTodayPlan(input: GetTodayPlanInput): Promise<TodayPlanResult> {
    const plan = await requireRow(
      await this.getPlanById(input.planId),
      `未找到计划：${input.planId}`,
    );
    if (plan.source !== 'system' && plan.visibility !== 'system' && plan.status && plan.status !== 'active') {
      throw new Error(`Training plan is not active: ${input.planId}`);
    }
    const phases = await this.listPlanPhases(input.planId);

    if (phases.length === 0) {
      // 结构化错误前缀，供首页/兼容服务识别
      throw new Error(`plan_has_no_phases: 计划没有阶段信息：${input.planId}`);
    }

    // 多级 fallback 查找 phase：
    // 1. type + currentWeek 同时匹配
    // 2. 只按 currentWeek 匹配（currentPhaseType 可能与 phases 不一致）
    // 3. 按 currentPhaseType 匹配第一个 phase（currentWeek 可能超出范围，由兼容服务 clamp）
    // 4. 取第一个 phase（最后兜底）
    const phase =
      phases.find(
        (item) =>
          item.type === input.phaseType &&
          input.currentWeek >= item.startWeek &&
          input.currentWeek <= item.endWeek,
      ) ??
      phases.find(
        (item) =>
          input.currentWeek >= item.startWeek && input.currentWeek <= item.endWeek,
      ) ??
      phases.find((item) => item.type === input.phaseType) ??
      phases[0];

    if (!phase) {
      throw new Error(`phase_not_found: 没有匹配的计划阶段：${input.phaseType} 第 ${input.currentWeek} 周`);
    }

    if (input.weekday === 5 && !input.fridayEnabled) {
      return {
        plan,
        phase,
        day: null,
        exercises: [],
        isRestDay: true,
        reason: '当前小组未开启周五训练。',
      };
    }

    const db = await this.getDb();
    // 多级 fallback 查找 day：
    // 1. plan_id + phase_id + week + weekday 精确匹配
    // 2. plan_id + week + weekday（phase_id 可能悬空，由兼容服务回填）
    // 3. plan_id + phase_id + week + 任意 weekday（当天无训练，但不一定是休息日）
    let dayRow = await db.getFirstAsync<PlanDayRow>(
      `SELECT * FROM plan_days
       WHERE plan_id = ? AND phase_id = ? AND week = ? AND weekday = ?
       LIMIT 1`,
      input.planId,
      phase.id,
      input.currentWeek,
      input.weekday,
    );

    if (!dayRow) {
      // fallback 2：忽略 phase_id
      dayRow = await db.getFirstAsync<PlanDayRow>(
        `SELECT * FROM plan_days
         WHERE plan_id = ? AND week = ? AND weekday = ?
         LIMIT 1`,
        input.planId,
        input.currentWeek,
        input.weekday,
      );
    }

    if (!dayRow) {
      // 当天确实没有训练日 → 返回休息日状态，而不是 throw
      // 这样首页能区分「计划结构缺失」与「今天确实是休息日」
      return {
        plan,
        phase,
        day: null,
        exercises: [],
        isRestDay: true,
        reason: '这一天还没有写入计划训练日。',
      };
    }

    const day = mapPlanDay(dayRow);
    const exercises = filterExercisesByRecovery(
      await this.listPlanExercises(day.id),
      input.recoveryMode ?? 'good',
    );

    return {
      plan,
      phase,
      day,
      exercises,
      isRestDay: false,
    };
  }
}
