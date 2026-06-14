import type { SQLiteDatabase } from 'expo-sqlite';

import { defaultExerciseAlternativeSeeds } from './defaultAlternatives';
import { defaultExerciseSeeds } from './defaultExercises';
import {
  defaultDeloadPhaseSeeds,
  defaultDeloadPlanDaySeeds,
  defaultDeloadPlanExerciseSeeds,
} from './defaultDeloadPlan';
import {
  defaultHypertrophyPhaseSeed,
  defaultHypertrophyPlanDaySeeds,
  defaultHypertrophyPlanExerciseSeeds,
} from './defaultHypertrophyPlan';
import {
  DEFAULT_GROUP_ID,
  DEFAULT_ORIGIN_SCHEME_ID,
  DEFAULT_PLAN_ID,
  DEFAULT_USER_PLAN_ID,
  createDefaultPlanTemplateSeed,
  defaultStrengthPhaseSeed,
  defaultStrengthPlanDaySeeds,
  defaultStrengthPlanExerciseSeeds,
} from './defaultStrengthPlan';

export async function seedDefaultData(db: SQLiteDatabase): Promise<void> {
  const now = new Date().toISOString();
  const plan = createDefaultPlanTemplateSeed(now);
  const phases = [
    defaultStrengthPhaseSeed,
    ...defaultDeloadPhaseSeeds,
    defaultHypertrophyPhaseSeed,
  ].sort((left, right) => left.orderIndex - right.orderIndex);
  const planDays = [
    ...defaultStrengthPlanDaySeeds,
    ...defaultDeloadPlanDaySeeds,
    ...defaultHypertrophyPlanDaySeeds,
  ];
  const planExercises = [
    ...defaultStrengthPlanExerciseSeeds,
    ...defaultDeloadPlanExerciseSeeds,
    ...defaultHypertrophyPlanExerciseSeeds,
  ];
  const userPhaseIdBySystemId = new Map(phases.map((phase) => [phase.id, `user_${phase.id}`]));
  const userDayIdBySystemId = new Map(planDays.map((day) => [day.id, `user_${day.id}`]));
  const userPlan = {
    ...plan,
    id: DEFAULT_USER_PLAN_ID,
    name: '四练增力增肌计划',
    visibility: 'private' as const,
    source: 'system_copy' as const,
    originSchemeId: DEFAULT_ORIGIN_SCHEME_ID,
    updatedAt: now,
  };
  const userPhases = phases.map((phase) => ({
    ...phase,
    id: userPhaseIdBySystemId.get(phase.id) ?? `user_${phase.id}`,
    planId: DEFAULT_USER_PLAN_ID,
  }));
  const userPlanDays = planDays.map((day) => ({
    ...day,
    id: userDayIdBySystemId.get(day.id) ?? `user_${day.id}`,
    planId: DEFAULT_USER_PLAN_ID,
    phaseId: userPhaseIdBySystemId.get(day.phaseId) ?? day.phaseId,
  }));
  const userPlanExercises = planExercises.map((exercise) => ({
    ...exercise,
    id: `user_${exercise.id}`,
    planDayId: userDayIdBySystemId.get(exercise.planDayId) ?? exercise.planDayId,
  }));

  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `INSERT OR IGNORE INTO plan_templates (
        id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
        description, source, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      plan.id,
      plan.name,
      plan.creatorId ?? null,
      plan.visibility,
      plan.goal,
      plan.durationWeeks,
      plan.frequencyPerWeek,
      plan.description ?? null,
      plan.source,
      plan.version,
      plan.createdAt,
      plan.updatedAt,
    );

    await txn.runAsync(
      `INSERT OR IGNORE INTO plan_templates (
        id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
        description, source, origin_scheme_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userPlan.id,
      userPlan.name,
      userPlan.creatorId ?? null,
      userPlan.visibility,
      userPlan.goal,
      userPlan.durationWeeks,
      userPlan.frequencyPerWeek,
      userPlan.description ?? null,
      userPlan.source,
      userPlan.originSchemeId,
      userPlan.version,
      userPlan.createdAt,
      userPlan.updatedAt,
    );

    for (const phase of phases) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_phases (
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

    for (const phase of userPhases) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_phases (
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

    for (const exercise of defaultExerciseSeeds) {
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
        now,
        now,
      );
    }

    for (const alternative of defaultExerciseAlternativeSeeds) {
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

    for (const day of planDays) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_days (
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

    for (const day of userPlanDays) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_days (
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

    for (const exercise of planExercises) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_exercises (
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

    for (const exercise of userPlanExercises) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_exercises (
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

    await txn.runAsync(
      `INSERT OR IGNORE INTO groups (
        id, name, owner_user_id, active_plan_id, current_phase_type,
        current_week, friday_enabled, friday_strategy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      DEFAULT_GROUP_ID,
      '默认训练小组',
      null,
      DEFAULT_USER_PLAN_ID,
      'strength',
      1,
      0,
      'default_rest',
      now,
      now,
    );

    await txn.runAsync(
      `UPDATE groups
       SET active_plan_id = ?, updated_at = ?
       WHERE active_plan_id = ?`,
      DEFAULT_USER_PLAN_ID,
      now,
      DEFAULT_PLAN_ID,
    );
  });
}
