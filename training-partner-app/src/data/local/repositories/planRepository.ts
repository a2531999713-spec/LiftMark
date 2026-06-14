import type {
  CopySystemSchemeToUserPlanInput,
  CreateUserPlanInput,
  ImportUserPlanInput,
  PlanRepository,
} from '@/data/repositories/planRepository';
import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import { createUserPlanCopyDraft } from '@/domain/plan/planCopy';
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

export class SQLitePlanRepository implements PlanRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getPlanById(planId: string): Promise<PlanTemplate | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<PlanTemplateRow>(
      'SELECT * FROM plan_templates WHERE id = ?',
      planId,
    );
    return row ? mapPlanTemplate(row) : null;
  }

  async listUserPlans(): Promise<PlanTemplate[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<PlanTemplateRow>(
      `SELECT * FROM plan_templates
       WHERE source != 'system'
       ORDER BY updated_at DESC, created_at DESC`,
    );
    return rows.map(mapPlanTemplate);
  }

  async listPlanPhases(planId: string): Promise<PlanPhase[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<PlanPhaseRow>(
      'SELECT * FROM plan_phases WHERE plan_id = ? ORDER BY order_index ASC',
      planId,
    );
    return rows.map(mapPlanPhase);
  }

  async listPlanDays(planId: string): Promise<PlanDay[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<PlanDayRow>(
      'SELECT * FROM plan_days WHERE plan_id = ? ORDER BY week ASC, weekday ASC',
      planId,
    );
    return rows.map(mapPlanDay);
  }

  async listPlanExercises(planDayId: string): Promise<PlanExercise[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<PlanExerciseRow>(
      'SELECT * FROM plan_exercises WHERE plan_day_id = ? ORDER BY order_index ASC',
      planDayId,
    );
    return rows.map(mapPlanExercise);
  }

  async createUserPlan(input: CreateUserPlanInput): Promise<PlanTemplate> {
    const db = await this.getDb();
    const now = nowIso();
    const plan: PlanTemplate = {
      id: createId('plan'),
      name: input.name.trim() || '我的训练计划',
      visibility: 'private',
      goal: input.goal,
      durationWeeks: Math.max(1, Math.round(input.durationWeeks)),
      frequencyPerWeek: Math.max(1, Math.round(input.frequencyPerWeek)),
      description: '用户创建的本地训练计划',
      source: 'blank_created',
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    const phaseId = createId('phase');

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        plan.id,
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
          id, plan_id, name, type, start_week, end_week, order_index
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        phaseId,
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
            id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          planDayId,
          plan.id,
          phaseId,
          1,
          day.weekday,
          day.title.trim() || `Day ${dayIndex + 1}`,
          day.focus.trim() || '自定义训练',
          '用户创建的训练日',
        );

        for (const [exerciseIndex, exercise] of day.exercises.entries()) {
          await txn.runAsync(
            `INSERT INTO plan_exercises (
              id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
              intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
              rest_seconds, progression_rule_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            createId('plan_exercise'),
            planDayId,
            exercise.exerciseId,
            exercise.priority ?? 'A',
            exerciseIndex + 1,
            exercise.sets,
            exercise.reps,
            null,
            null,
            exercise.rpeTarget ? 'rpe' : exercise.rirTarget ? 'rir' : 'manual',
            null,
            exercise.rpeTarget ?? null,
            exercise.rirTarget ?? null,
            null,
            'none',
            90,
            null,
            null,
          );
        }
      }
    });

    return plan;
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

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        draft.template.id,
        draft.template.name,
        draft.template.creatorId ?? null,
        draft.template.visibility,
        draft.template.goal,
        draft.template.durationWeeks,
        draft.template.frequencyPerWeek,
        draft.template.description ?? null,
        draft.template.source,
        draft.template.originSchemeId ?? null,
        draft.template.version,
        draft.template.createdAt,
        draft.template.updatedAt,
      );

      for (const phase of draft.phases) {
        await txn.runAsync(
          `INSERT INTO plan_phases (
            id, plan_id, name, type, start_week, end_week, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
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
            id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          day.id,
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
            id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
            intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
            rest_seconds, progression_rule_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          exercise.planDayId,
          exercise.exerciseId,
          exercise.priority,
          exercise.orderIndex,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.repMin ?? null,
          exercise.repMax ?? null,
          exercise.intensityType,
          exercise.percent1RM ?? null,
          exercise.rpeTarget ?? null,
          exercise.rirTarget ?? null,
          exercise.fixedWeight ?? null,
          exercise.referenceLift,
          exercise.restSeconds ?? null,
          exercise.progressionRuleId ?? null,
          exercise.notes ?? null,
        );
      }
    });

    return draft.template;
  }

  async importUserPlan(input: ImportUserPlanInput): Promise<PlanTemplate> {
    if (input.template.source === 'system') {
      throw new Error('系统方案不能直接导入为当前训练计划。');
    }

    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      for (const exercise of input.exercises) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO exercises (
            id, name, category, movement_pattern, target_muscle, secondary_muscle,
            equipment, difficulty, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          exercise.name,
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
      }

      for (const alternative of input.alternatives) {
        await txn.runAsync(
          `INSERT OR IGNORE INTO exercise_alternatives (
            id, exercise_id, alternative_exercise_id, reason
          ) VALUES (?, ?, ?, ?)`,
          alternative.id,
          alternative.exerciseId,
          alternative.alternativeExerciseId,
          alternative.reason ?? null,
        );
      }

      await txn.runAsync(
        `INSERT INTO plan_templates (
          id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        input.template.id,
        input.template.name,
        input.template.creatorId ?? null,
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
            id, plan_id, name, type, start_week, end_week, order_index
          ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          phase.id,
          phase.planId,
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
            id, plan_id, phase_id, week, weekday, title, focus, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          day.id,
          day.planId,
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
            id, plan_day_id, exercise_id, priority, order_index, sets, reps, rep_min, rep_max,
            intensity_type, percent_1rm, rpe_target, rir_target, fixed_weight, reference_lift,
            rest_seconds, progression_rule_id, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          exercise.id,
          exercise.planDayId,
          exercise.exerciseId,
          exercise.priority,
          exercise.orderIndex,
          exercise.sets ?? null,
          exercise.reps ?? null,
          exercise.repMin ?? null,
          exercise.repMax ?? null,
          exercise.intensityType,
          exercise.percent1RM ?? null,
          exercise.rpeTarget ?? null,
          exercise.rirTarget ?? null,
          exercise.fixedWeight ?? null,
          exercise.referenceLift,
          exercise.restSeconds ?? null,
          exercise.progressionRuleId ?? null,
          exercise.notes ?? null,
        );
      }
    });

    return {
      ...input.template,
      source: 'imported',
      visibility: 'private',
    };
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
