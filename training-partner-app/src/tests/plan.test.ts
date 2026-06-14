import { describe, expect, it, jest } from '@jest/globals';

import { defaultExerciseSeeds } from '@/data/seed/defaultExercises';
import {
  CLASSIC_PPL_PLAN_ID,
  CLASSIC_PPL_SCHEME_ID,
  classicPplPhaseSeed,
  classicPplPlanDaySeeds,
  classicPplPlanExerciseSeeds,
  createClassicPplPlanTemplateSeed,
} from '@/data/seed/classicPplPlan';
import {
  DEFAULT_ORIGIN_SCHEME_ID,
  DEFAULT_PLAN_ID,
  createDefaultPlanTemplateSeed,
  defaultStrengthPhaseSeed,
  defaultStrengthPlanDaySeeds,
  defaultStrengthPlanExerciseSeeds,
} from '@/data/seed/defaultStrengthPlan';
import {
  clampDefaultCycleWeek,
  getDefaultCyclePhaseType,
} from '@/domain/plan/defaultCycle';
import { createUserPlanCopyDraft } from '@/domain/plan/planCopy';
import { filterExercisesByRecovery } from '@/domain/plan/plan.service';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';

let mockIdCounter = 0;
jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_${(mockIdCounter += 1)}`,
}));

describe('default plan seed and recovery filtering', () => {
  it('seeds the first Monday bench day as percentage-based plan data', () => {
    const monday = defaultStrengthPlanDaySeeds.find((day) => day.week === 1 && day.weekday === 1);
    const bench = defaultExerciseSeeds.find((exercise) => exercise.name === '杠铃卧推');
    const benchPlanExercise = defaultStrengthPlanExerciseSeeds.find(
      (exercise) => exercise.planDayId === monday?.id && exercise.exerciseId === bench?.id,
    );

    expect(monday?.phaseId).toBe('phase_strength_1');
    expect(benchPlanExercise?.referenceLift).toBe('bench');
    expect(benchPlanExercise?.percent1RM).toBe(0.75);
  });

  it('maps the global 16-week cycle to the right phase type', () => {
    expect(getDefaultCyclePhaseType(1)).toBe('strength');
    expect(getDefaultCyclePhaseType(7)).toBe('deload');
    expect(getDefaultCyclePhaseType(8)).toBe('hypertrophy');
    expect(getDefaultCyclePhaseType(16)).toBe('deload');
    expect(clampDefaultCycleWeek(100)).toBe(16);
  });

  it('filters A/B/C exercises by recovery mode', () => {
    const exercises = [
      { priority: 'A' as const, name: 'main' },
      { priority: 'B' as const, name: 'support' },
      { priority: 'C' as const, name: 'optional' },
    ];

    expect(filterExercisesByRecovery(exercises, 'good')).toHaveLength(3);
    expect(filterExercisesByRecovery(exercises, 'normal').map((exercise) => exercise.priority)).toEqual([
      'A',
      'B',
    ]);
    expect(filterExercisesByRecovery(exercises, 'bad').map((exercise) => exercise.priority)).toEqual([
      'A',
    ]);
    expect(filterExercisesByRecovery(exercises, 'very_bad')).toHaveLength(0);
  });

  it('keeps system schemes separate and copies one into a user plan draft', () => {
    const scheme = listSystemTrainingSchemes().find(
      (item) => item.id === DEFAULT_ORIGIN_SCHEME_ID,
    );
    const sourceTemplate = createDefaultPlanTemplateSeed('2026-06-01T00:00:00.000Z');
    const monday = defaultStrengthPlanDaySeeds.find((day) => day.week === 1 && day.weekday === 1);
    const mondayExercises = defaultStrengthPlanExerciseSeeds.filter(
      (exercise) => exercise.planDayId === monday?.id,
    );

    expect(scheme?.isAvailable).toBe(true);
    expect(scheme?.templatePlanId).toBe(DEFAULT_PLAN_ID);

    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases: [defaultStrengthPhaseSeed],
      days: monday ? [monday] : [],
      exercises: mondayExercises,
      name: '我的四练计划',
      originSchemeId: DEFAULT_ORIGIN_SCHEME_ID,
      now: '2026-06-12T00:00:00.000Z',
    });

    expect(draft.template.id).not.toBe(DEFAULT_PLAN_ID);
    expect(draft.template.name).toBe('我的四练计划');
    expect(draft.template.source).toBe('system_copy');
    expect(draft.template.originSchemeId).toBe(DEFAULT_ORIGIN_SCHEME_ID);
    expect(draft.phases.every((phase) => phase.planId === draft.template.id)).toBe(true);
    expect(draft.days.every((day) => day.planId === draft.template.id)).toBe(true);
    expect(draft.exercises.every((exercise) => exercise.planDayId === draft.days[0]?.id)).toBe(true);
  });

  it('exposes classic three-day PPL as a copyable system scheme', () => {
    const scheme = listSystemTrainingSchemes().find((item) => item.id === CLASSIC_PPL_SCHEME_ID);
    const sourceTemplate = createClassicPplPlanTemplateSeed('2026-06-14T00:00:00.000Z');
    const firstWeekDays = classicPplPlanDaySeeds.filter((day) => day.week === 1);
    const firstWeekExercises = classicPplPlanExerciseSeeds.filter((exercise) =>
      firstWeekDays.some((day) => day.id === exercise.planDayId),
    );

    expect(scheme?.title).toBe('经典三分化 PPL');
    expect(scheme?.isAvailable).toBe(true);
    expect(scheme?.templatePlanId).toBe(CLASSIC_PPL_PLAN_ID);

    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases: [classicPplPhaseSeed],
      days: firstWeekDays,
      exercises: firstWeekExercises,
      name: '我的经典三分化 PPL',
      originSchemeId: CLASSIC_PPL_SCHEME_ID,
      now: '2026-06-14T00:00:00.000Z',
    });

    expect(draft.template.source).toBe('system_copy');
    expect(draft.template.originSchemeId).toBe(CLASSIC_PPL_SCHEME_ID);
    expect(draft.template.id).not.toBe(CLASSIC_PPL_PLAN_ID);
    expect(draft.days).toHaveLength(3);
    expect(draft.exercises).toHaveLength(15);
    expect(draft.exercises.every((exercise) => draft.days.some((day) => day.id === exercise.planDayId))).toBe(true);
  });
});
