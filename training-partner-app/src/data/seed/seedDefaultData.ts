import type { SQLiteDatabase } from 'expo-sqlite';

import { defaultExerciseAlternativeSeeds } from './defaultAlternatives';
import { defaultExerciseSeeds } from './defaultExercises';
import {
  classicPplPhaseSeed,
  classicPplPlanDaySeeds,
  classicPplPlanExerciseSeeds,
  createClassicPplPlanTemplateSeed,
} from './classicPplPlan';
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
  DEFAULT_MAINSTREAM_ORIGIN_SCHEME_ID,
  DEFAULT_MAINSTREAM_USER_PLAN_ID,
  MAINSTREAM_PLAN_IDS,
  createMainstreamPlanTemplateSeeds,
  mainstreamPlanDaySeeds,
  mainstreamPlanExerciseSeeds,
  mainstreamPlanPhaseSeeds,
} from './mainstreamPlans';
import {
  DEFAULT_GROUP_ID,
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
  const classicPplPlan = createClassicPplPlanTemplateSeed(now);
  const mainstreamPlans = createMainstreamPlanTemplateSeeds(now);
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
  const defaultMainstreamPlanId = MAINSTREAM_PLAN_IDS.beginnerFullBody;
  const defaultMainstreamPlan = mainstreamPlans.find((item) => item.id === defaultMainstreamPlanId);
  const defaultMainstreamPhases = mainstreamPlanPhaseSeeds.filter(
    (phase) => phase.planId === defaultMainstreamPlanId,
  );
  const defaultMainstreamDays = mainstreamPlanDaySeeds.filter(
    (day) => day.planId === defaultMainstreamPlanId,
  );
  const defaultMainstreamDayIds = new Set(defaultMainstreamDays.map((day) => day.id));
  const defaultMainstreamExercises = mainstreamPlanExerciseSeeds.filter((exercise) =>
    defaultMainstreamDayIds.has(exercise.planDayId),
  );
  const userPhaseIdBySystemId = new Map(
    defaultMainstreamPhases.map((phase) => [phase.id, `user_${phase.id}`]),
  );
  const userDayIdBySystemId = new Map(
    defaultMainstreamDays.map((day) => [day.id, `user_${day.id}`]),
  );
  const userPlan = {
    ...(defaultMainstreamPlan ?? mainstreamPlans[0]),
    id: DEFAULT_MAINSTREAM_USER_PLAN_ID,
    name: '新手全身训练计划',
    visibility: 'private' as const,
    source: 'system_copy' as const,
    originSchemeId: DEFAULT_MAINSTREAM_ORIGIN_SCHEME_ID,
    updatedAt: now,
  };
  const userPhases = defaultMainstreamPhases.map((phase) => ({
    ...phase,
    id: userPhaseIdBySystemId.get(phase.id) ?? `user_${phase.id}`,
    planId: DEFAULT_MAINSTREAM_USER_PLAN_ID,
  }));
  const userPlanDays = defaultMainstreamDays.map((day) => ({
    ...day,
    id: userDayIdBySystemId.get(day.id) ?? `user_${day.id}`,
    planId: DEFAULT_MAINSTREAM_USER_PLAN_ID,
    phaseId: userPhaseIdBySystemId.get(day.phaseId) ?? day.phaseId,
  }));
  const userPlanExercises = defaultMainstreamExercises.map((exercise) => ({
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

    for (const mainstreamPlan of mainstreamPlans) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO plan_templates (
          id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
          description, source, origin_scheme_id, version, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        mainstreamPlan.id,
        mainstreamPlan.name,
        mainstreamPlan.creatorId ?? null,
        mainstreamPlan.visibility,
        mainstreamPlan.goal,
        mainstreamPlan.durationWeeks,
        mainstreamPlan.frequencyPerWeek,
        mainstreamPlan.description ?? null,
        mainstreamPlan.source,
        mainstreamPlan.originSchemeId ?? null,
        mainstreamPlan.version,
        mainstreamPlan.createdAt,
        mainstreamPlan.updatedAt,
      );
    }

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

    await txn.runAsync(
      `INSERT OR IGNORE INTO plan_templates (
        id, name, creator_id, visibility, goal, duration_weeks, frequency_per_week,
        description, source, origin_scheme_id, version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      classicPplPlan.id,
      classicPplPlan.name,
      classicPplPlan.creatorId ?? null,
      classicPplPlan.visibility,
      classicPplPlan.goal,
      classicPplPlan.durationWeeks,
      classicPplPlan.frequencyPerWeek,
      classicPplPlan.description ?? null,
      classicPplPlan.source,
      classicPplPlan.originSchemeId ?? null,
      classicPplPlan.version,
      classicPplPlan.createdAt,
      classicPplPlan.updatedAt,
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

    for (const phase of mainstreamPlanPhaseSeeds) {
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

    await txn.runAsync(
      `INSERT OR IGNORE INTO plan_phases (
        id, plan_id, name, type, start_week, end_week, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      classicPplPhaseSeed.id,
      classicPplPhaseSeed.planId,
      classicPplPhaseSeed.name,
      classicPplPhaseSeed.type,
      classicPplPhaseSeed.startWeek,
      classicPplPhaseSeed.endWeek,
      classicPplPhaseSeed.orderIndex,
    );

    for (const exercise of defaultExerciseSeeds) {
      await txn.runAsync(
        `INSERT INTO exercises (
          id, name, source, category, movement_pattern, target_muscle, secondary_muscle,
          equipment, difficulty, notes, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          source = 'system',
          category = excluded.category,
          movement_pattern = excluded.movement_pattern,
          target_muscle = excluded.target_muscle,
          secondary_muscle = excluded.secondary_muscle,
          equipment = excluded.equipment,
          difficulty = excluded.difficulty,
          notes = excluded.notes,
          updated_at = excluded.updated_at`,
        exercise.id,
        exercise.name,
        exercise.source,
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

    for (const day of mainstreamPlanDaySeeds) {
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

    for (const day of classicPplPlanDaySeeds) {
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
        exercise.intensityType === 'percent_1rm' ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
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

    for (const exercise of classicPplPlanExerciseSeeds) {
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
        exercise.intensityType === 'percent_1rm' ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
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

    for (const exercise of mainstreamPlanExerciseSeeds) {
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
        exercise.intensityType === 'percent_1rm' ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
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
        exercise.intensityType === 'percent_1rm' ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
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

    await txn.runAsync(
      `INSERT OR IGNORE INTO groups (
        id, name, owner_user_id, active_plan_id, current_phase_type,
        current_week, friday_enabled, friday_strategy, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      DEFAULT_GROUP_ID,
      '默认训练小组',
      null,
      DEFAULT_MAINSTREAM_USER_PLAN_ID,
      'strength',
      1,
      1,
      'default_rest',
      now,
      now,
    );

    await txn.runAsync(
      `UPDATE groups
       SET active_plan_id = ?, current_phase_type = ?, current_week = 1, updated_at = ?
       WHERE active_plan_id IN (?, ?)`,
      DEFAULT_MAINSTREAM_USER_PLAN_ID,
      'strength',
      now,
      DEFAULT_PLAN_ID,
      DEFAULT_USER_PLAN_ID,
    );
  });
}
