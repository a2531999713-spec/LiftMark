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
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
  TodayPlanResult,
} from '@/domain/plan/plan.types';
import { filterExercisesByRecovery } from '@/domain/plan/plan.service';

import { requireRow, type DatabaseProvider } from './base';
import { getCurrentAccountUserId, getGroupAccountScope, getPlanAccountScope } from '../accountScope';
import {
  mapPlanDay,
  mapPlanExercise,
  mapPlanPhase,
  mapPlanTemplate,
  type PlanDayRow,
  type PlanExerciseRow,
  type PlanPhaseRow,
  type PlanTemplateRow,
} from './mappers';

const LEGACY_FOUR_DAY_DEFAULT_USER_PLAN_ID = 'plan_user_four_day_strength_hypertrophy_default';
const LEGACY_FOUR_DAY_SCHEME_ID = 'scheme_four_day_strength_hypertrophy';

type UserPlanExerciseInput = CreateUserPlanInput['days'][number]['exercises'][number];

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
    repMax,
    repMin,
    reps,
    restSeconds: exercise.restSeconds ?? 90,
    sets: Math.max(1, Math.round(exercise.sets ?? 3)),
  };
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
    const scope = getPlanAccountScope(userId, 'plan_templates');
    const rows = await db.getAllAsync<PlanTemplateRow>(
      `SELECT * FROM plan_templates
       WHERE source != 'system'
         AND ${scope.where}
         AND id != ?
         AND COALESCE(origin_scheme_id, '') != ?
       ORDER BY updated_at DESC, created_at DESC`,
      ...scope.params,
      LEGACY_FOUR_DAY_DEFAULT_USER_PLAN_ID,
      LEGACY_FOUR_DAY_SCHEME_ID,
    );
    return rows.map(mapPlanTemplate);
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

  async createUserPlan(input: CreateUserPlanInput): Promise<PlanTemplate> {
    const db = await this.getDb();
    const ownerUserId = await getCurrentAccountUserId();
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
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const phaseId = createId('phase');

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        plan.createdAt,
        plan.updatedAt,
      );

      await txn.runAsync(
        `INSERT INTO plan_phases (
          id, owner_user_id, plan_id, name, type, start_week, end_week, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        phaseId,
        ownerUserId,
        plan.id,
        '基础周期',
        plan.goal === 'hypertrophy' ? 'hypertrophy' : plan.goal === 'strength' ? 'strength' : 'custom',
        1,
        plan.durationWeeks,
        1,
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
            null,
            null,
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
    const ownerUserId = current.creatorId ?? await getCurrentAccountUserId();
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
          id, owner_user_id, plan_id, name, type, start_week, end_week, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        phaseId,
        ownerUserId,
        updated.id,
        '基础周期',
        updated.goal === 'hypertrophy' ? 'hypertrophy' : updated.goal === 'strength' ? 'strength' : 'custom',
        1,
        updated.durationWeeks,
        1,
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
            null,
            null,
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
    const exercises = (
      await Promise.all(days.map((day) => this.listPlanExercises(day.id)))
    ).flat();
    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases,
      days,
      exercises,
      name: input.name,
      originSchemeId: input.scheme.id,
    });
    const ownerUserId = await getCurrentAccountUserId();
    const template = {
      ...draft.template,
      creatorId: ownerUserId ?? draft.template.creatorId,
    };

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        template.createdAt,
        template.updatedAt,
      );

      for (const phase of draft.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, owner_user_id, plan_id, name, type, start_week, end_week, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
          ownerUserId,
          phase.planId,
          phase.name,
          phase.type,
          phase.startWeek,
          phase.endWeek,
          phase.orderIndex,
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
    const exercises = (
      await Promise.all(days.map((day) => this.listPlanExercises(day.id)))
    ).flat();
    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases,
      days,
      exercises,
      name: input.name ?? `${sourceTemplate.name}（我的）`,
      originSchemeId: sourceTemplate.originSchemeId ?? sourceTemplate.id,
    });
    const ownerUserId = await getCurrentAccountUserId();
    const template = {
      ...draft.template,
      creatorId: ownerUserId ?? draft.template.creatorId,
      source: 'duplicated' as const,
    };

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, owner_user_id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        template.createdAt,
        template.updatedAt,
      );

      for (const phase of draft.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, owner_user_id, plan_id, name, type, start_week, end_week, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
          ownerUserId,
          phase.planId,
          phase.name,
          phase.type,
          phase.startWeek,
          phase.endWeek,
          phase.orderIndex,
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
    const ownerUserId = await getCurrentAccountUserId();
    const exerciseIdByImportedId = new Map<string, string>();
    let finalPlanId = input.template.id;

    await db.withExclusiveTransactionAsync(async (txn) => {
      // 检查 plan ID 是否已存在：存在则生成新 ID 避免覆盖已有计划，
      // 不存在则保留原 ID（用于重装后重新导入时与旧训练记录 plan_id 重新关联）
      const existing = await txn.getFirstAsync<{ id: string }>(
        'SELECT id FROM plan_templates WHERE id = ?',
        input.template.id,
      );
      const planId = existing ? createId('plan_imported') : input.template.id;
      finalPlanId = planId;

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
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        input.template.createdAt,
        input.template.updatedAt,
      );

      for (const phase of input.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, owner_user_id, plan_id, name, type, start_week, end_week, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
          ownerUserId,
          planId,
          phase.name,
          phase.type,
          phase.startWeek,
          phase.endWeek,
          phase.orderIndex,
        );
      }

      for (const day of input.days) {
        await txn.runAsync(
          `INSERT INTO plan_days (
            id, owner_user_id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          day.id,
          ownerUserId,
          planId,
          day.phaseId,
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
          exercise.id,
          ownerUserId,
          exercise.planDayId,
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
    const userId = await getCurrentAccountUserId();
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
      await txn.runAsync('DELETE FROM plan_templates WHERE id = ?', planId);
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
    const phases = await this.listPlanPhases(input.planId);
    const phase = phases.find(
      (item) =>
        item.type === input.phaseType &&
        input.currentWeek >= item.startWeek &&
        input.currentWeek <= item.endWeek,
    );

    if (!phase) {
      throw new Error(`没有匹配的计划阶段：${input.phaseType} 第 ${input.currentWeek} 周`);
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
    const dayRow = await db.getFirstAsync<PlanDayRow>(
      `SELECT * FROM plan_days
       WHERE plan_id = ? AND phase_id = ? AND week = ? AND weekday = ?
       LIMIT 1`,
      input.planId,
      phase.id,
      input.currentWeek,
      input.weekday,
    );

    if (!dayRow) {
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
