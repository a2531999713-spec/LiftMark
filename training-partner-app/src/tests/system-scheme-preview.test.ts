import { describe, expect, it, jest } from '@jest/globals';

import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';
import {
  estimateTrainingDayMinutes,
  loadSystemSchemePreview,
} from '@/features/plan-library/systemSchemePreview';

const scheme = listSystemTrainingSchemes()[0];
const plan: PlanTemplate = {
  id: scheme.templatePlanId!, name: scheme.title, visibility: 'system', goal: scheme.goal,
  durationWeeks: 2, frequencyPerWeek: 1, source: 'system', version: 1,
  createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
};
const phase: PlanPhase = { id: 'phase', planId: plan.id, name: '基础阶段', type: 'strength', startWeek: 1, endWeek: 2, orderIndex: 1 };
const days: PlanDay[] = [1, 2].map((week) => ({ id: `day-${week}`, planId: plan.id, phaseId: phase.id, week, weekday: 1, title: '全身 A', focus: '全身' }));
const prescriptions: PlanExercise[] = days.map((day) => ({
  id: `pe-${day.id}`, planDayId: day.id, exerciseId: 'missing-exercise', priority: 'A', orderIndex: 1,
  sets: 3, repMin: 8, repMax: 12, intensityType: 'manual', referenceLift: 'none', restSeconds: 90,
}));

describe('system scheme preview', () => {
  it('loads days and prescriptions in batches, groups weeks and tolerates unknown exercises', async () => {
    const listPlanExercisesForDays = jest.fn<(ids: string[]) => Promise<PlanExercise[]>>(async () => prescriptions);
    const preview = await loadSystemSchemePreview({
      exerciseRepository: { listExercisesByIds: jest.fn<(ids: string[]) => Promise<never[]>>(async () => []) },
      planRepository: {
        getPlanById: jest.fn<(id: string) => Promise<PlanTemplate | null>>(async () => plan),
        listPlanDays: jest.fn<(id: string) => Promise<PlanDay[]>>(async () => days),
        listPlanExercisesForDays,
        listPlanPhases: jest.fn<(id: string) => Promise<PlanPhase[]>>(async () => [phase]),
      },
    }, scheme);

    expect(listPlanExercisesForDays).toHaveBeenCalledTimes(1);
    expect(listPlanExercisesForDays).toHaveBeenCalledWith(['day-1', 'day-2']);
    expect(preview.availability).toBe('ready');
    expect(preview.weeks).toHaveLength(2);
    expect(preview.hasRepeatedWeeklyStructure).toBe(true);
    expect(preview.weeks[0].days[0].exercises[0]).toEqual(expect.objectContaining({ name: '未知动作', unresolved: true }));
  });

  it('returns metadata-only state when the linked template is missing', async () => {
    const preview = await loadSystemSchemePreview({
      exerciseRepository: { listExercisesByIds: jest.fn<(ids: string[]) => Promise<never[]>>() },
      planRepository: {
        getPlanById: jest.fn<(id: string) => Promise<PlanTemplate | null>>(async () => null),
        listPlanDays: jest.fn<(id: string) => Promise<PlanDay[]>>(),
        listPlanExercisesForDays: jest.fn<(ids: string[]) => Promise<PlanExercise[]>>(),
        listPlanPhases: jest.fn<(id: string) => Promise<PlanPhase[]>>(),
      },
    }, scheme);
    expect(preview.availability).toBe('metadata_only');
    expect(preview.fallbackMessage).toBeTruthy();
  });

  it('estimates a deterministic time range without fake precision', () => {
    expect(estimateTrainingDayMinutes(prescriptions.slice(0, 1))).toEqual({ min: 10, max: 20 });
  });
});
