import { describe, expect, it } from '@jest/globals';

import {
  buildPlanEditDraft,
  duplicatePlanDayDraft,
  duplicatePlanExerciseDraft,
  toUpdateUserPlanInput,
} from '@/components/plan/planEditDraft';
import { formatPlanExercisePrescription, validatePlanEditorDraft } from '@/components/plan/planEditorValidation';
import type { PlanDay, PlanExercise, PlanTemplate } from '@/domain/plan/plan.types';

const plan: PlanTemplate = {
  createdAt: '2026-07-14T00:00:00.000Z',
  durationWeeks: 8,
  frequencyPerWeek: 3,
  goal: 'strength',
  id: 'plan_1',
  name: '处方计划',
  source: 'user',
  updatedAt: '2026-07-14T00:00:00.000Z',
  version: 1,
  visibility: 'private',
};

const day: PlanDay = {
  focus: '上肢',
  id: 'day_1',
  phaseId: 'phase_1',
  planId: plan.id,
  title: '上肢日',
  week: 1,
  weekday: 1,
};

const fixedExercise: PlanExercise = {
  exerciseId: 'bench',
  fixedWeight: 82.5,
  id: 'exercise_fixed',
  intensityType: 'fixed',
  notes: '暂停一秒',
  orderIndex: 0,
  planDayId: day.id,
  priority: 'A',
  referenceLift: 'bench',
  reps: 5,
  restSeconds: 180,
  sets: 4,
};

const rangeExercise: PlanExercise = {
  exerciseId: 'row',
  id: 'exercise_range',
  intensityType: 'percent_1rm',
  orderIndex: 1,
  percent1RM: 0.8,
  planDayId: day.id,
  priority: 'B',
  referenceLift: 'deadlift',
  repMax: 10,
  repMin: 8,
  restSeconds: 90,
  sets: 3,
};

const legacyRpeExercise: PlanExercise = {
  ...fixedExercise,
  id: 'exercise_legacy_rpe',
  intensityType: 'rpe',
  rpeTarget: 8,
  rirTarget: 2,
};

describe('plan exercise prescription editor', () => {
  it('restores and saves independent prescriptions without using the first exercise defaults', () => {
    const draft = buildPlanEditDraft(plan, [day], [[fixedExercise, rangeExercise]]);

    expect(draft.days[0].exercises[0]).toMatchObject({ fixedWeight: 82.5, reps: 5, restSeconds: 180, sets: 4 });
    expect(draft.days[0].exercises[1]).toMatchObject({ percent1RM: 0.8, repMax: 10, repMin: 8, reps: null, sets: 3 });

    const input = toUpdateUserPlanInput(plan.id, draft);
    expect(input.days[0].exercises).toEqual([
      expect.objectContaining({ fixedWeight: 82.5, reps: 5, restSeconds: 180, sets: 4 }),
      expect.objectContaining({ percent1RM: 0.8, repMax: 10, repMin: 8, reps: null, restSeconds: 90, sets: 3 }),
    ]);
  });

  it('validates exact prescription limits and identifies the affected day and exercise', () => {
    const draft = buildPlanEditDraft(plan, [day], [[fixedExercise, rangeExercise]]);
    draft.days[0].exercises[0] = { ...draft.days[0].exercises[0], reps: 101, sets: 21 };
    draft.days[0].exercises[1] = { ...draft.days[0].exercises[1], percent1RM: 1.1, repMax: 4, restSeconds: 601 };

    const result = validatePlanEditorDraft(draft);
    expect(result.isValid).toBe(false);
    expect(result.errors.some((error) => error.dayId === day.id && error.exerciseDraftId === fixedExercise.id && error.message.includes('组数'))).toBe(true);
    expect(result.errors.some((error) => error.dayId === day.id && error.exerciseDraftId === rangeExercise.id && error.message.includes('次数范围'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('%1RM'))).toBe(true);
    expect(result.errors.some((error) => error.message.includes('休息时间'))).toBe(true);
  });

  it('supports fixed and range prescriptions and formats the summary from that exercise only', () => {
    const draft = buildPlanEditDraft(plan, [day], [[fixedExercise, rangeExercise]]);
    expect(validatePlanEditorDraft(draft).isValid).toBe(true);
    expect(formatPlanExercisePrescription(draft.days[0].exercises[0])).toBe('4 组 × 5 次 · 82.5kg · 休息 180 秒');
    expect(formatPlanExercisePrescription(draft.days[0].exercises[1])).toBe('3 组 × 8-10 次 · 80% 1RM · 休息 90 秒');
  });

  it('duplicates actions and days deeply with new stable draft identifiers', () => {
    const draft = buildPlanEditDraft(plan, [day], [[fixedExercise, rangeExercise]]);
    const copiedExercise = duplicatePlanExerciseDraft(draft.days[0].exercises[0], 2);
    const copiedDay = duplicatePlanDayDraft(draft.days[0], 2);

    expect(copiedExercise.id).not.toBe(draft.days[0].exercises[0].id);
    expect(copiedExercise).toMatchObject({ fixedWeight: 82.5, notes: '暂停一秒', orderIndex: 2, sets: 4 });
    expect(copiedDay.id).not.toBe(draft.days[0].id);
    expect(copiedDay.title).toBe('上肢日 副本');
    expect(copiedDay.exercises.map((exercise) => exercise.id)).not.toEqual(draft.days[0].exercises.map((exercise) => exercise.id));
    copiedDay.exercises[0].sets = 9;
    expect(draft.days[0].exercises[0].sets).toBe(4);
  });

  it('keeps legacy RPE/RIR through a save without exposing a legacy intensity mode', () => {
    const draft = buildPlanEditDraft(plan, [day], [[legacyRpeExercise]]);
    const input = toUpdateUserPlanInput(plan.id, draft);

    expect(draft.days[0].exercises[0].intensityType).toBe('manual');
    expect(draft.days[0].exercises[0]).toMatchObject({ rpeTarget: 8, rirTarget: 2 });
    expect(input.days[0].exercises[0]).toMatchObject({ intensityType: 'manual', rpeTarget: 8, rirTarget: 2 });
  });
});
