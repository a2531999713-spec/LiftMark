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
  DEFAULT_PLAN_ID,
  createDefaultPlanTemplateSeed,
  defaultStrengthPhaseSeed,
  defaultStrengthPlanDaySeeds,
  defaultStrengthPlanExerciseSeeds,
} from '@/data/seed/defaultStrengthPlan';
import {
  MAINSTREAM_PLAN_IDS,
  createMainstreamPlanTemplateSeeds,
  mainstreamPlanDaySeeds,
  mainstreamPlanExerciseSeeds,
  mainstreamPlanPhaseSeeds,
} from '@/data/seed/mainstreamPlans';
import {
  clampDefaultCycleWeek,
  getDefaultCyclePhaseType,
} from '@/domain/plan/defaultCycle';
import { createUserPlanCopyDraft } from '@/domain/plan/planCopy';
import { filterExercisesByRecovery } from '@/domain/plan/plan.service';
import {
  SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
  listSystemTrainingSchemes,
} from '@/domain/plan/systemSchemes';

let mockIdCounter = 0;
jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_${(mockIdCounter += 1)}`,
}));

describe('default plan seed and recovery filtering', () => {
  it('ships a broad system exercise library with stable Chinese names', () => {
    const names = defaultExerciseSeeds.map((exercise) => exercise.name);
    const uniqueNames = new Set(names);

    expect(defaultExerciseSeeds.length).toBeGreaterThanOrEqual(100);
    expect(uniqueNames.size).toBe(names.length);
    expect(names).toEqual(expect.arrayContaining(['杠铃卧推', '腿举', '面拉', '绳索下压', '悬垂举腿', '泽奇深蹲']));
    expect(defaultExerciseSeeds.every((exercise) => exercise.source === 'system')).toBe(true);
  });

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

  it('does not expose the legacy four-day template in the current system scheme catalog', () => {
    expect(
      listSystemTrainingSchemes().some(
        (item) => item.id === 'scheme_four_day_strength_hypertrophy' || item.title.includes('四练'),
      ),
    ).toBe(false);
  });

  it('copies a system template into a user plan draft without mutating source ids', () => {
    const sourceTemplate = createDefaultPlanTemplateSeed('2026-06-01T00:00:00.000Z');
    const monday = defaultStrengthPlanDaySeeds.find((day) => day.week === 1 && day.weekday === 1);
    const mondayExercises = defaultStrengthPlanExerciseSeeds.filter(
      (exercise) => exercise.planDayId === monday?.id,
    );

    const draft = createUserPlanCopyDraft({
      sourceTemplate,
      phases: [defaultStrengthPhaseSeed],
      days: monday ? [monday] : [],
      exercises: mondayExercises,
      name: '我的力量计划',
      originSchemeId: 'legacy_strength_template',
      now: '2026-06-12T00:00:00.000Z',
    });

    expect(draft.template.id).not.toBe(DEFAULT_PLAN_ID);
    expect(draft.template.name).toBe('我的力量计划');
    expect(draft.template.source).toBe('system_copy');
    expect(draft.template.originSchemeId).toBe('legacy_strength_template');
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

    expect(scheme?.title).toBe('Push Pull Legs 三分化计划');
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

  it('exposes the classic four-day body-part split as a copyable system scheme', () => {
    const scheme = listSystemTrainingSchemes().find(
      (item) => item.id === SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
    );
    const sourceTemplate = createMainstreamPlanTemplateSeeds('2026-06-30T00:00:00.000Z').find(
      (item) => item.id === MAINSTREAM_PLAN_IDS.classicBodyPartSplit,
    );
    const phases = mainstreamPlanPhaseSeeds.filter(
      (phase) => phase.planId === MAINSTREAM_PLAN_IDS.classicBodyPartSplit,
    );
    const firstWeekDays = mainstreamPlanDaySeeds.filter(
      (day) => day.planId === MAINSTREAM_PLAN_IDS.classicBodyPartSplit && day.week === 1,
    );
    const firstWeekDayIds = new Set(firstWeekDays.map((day) => day.id));
    const firstWeekExercises = mainstreamPlanExerciseSeeds.filter((exercise) =>
      firstWeekDayIds.has(exercise.planDayId),
    );

    expect(scheme?.title).toBe('经典四分化增肌计划');
    expect(scheme?.dayStructure).toContain('胸 + 三头');
    expect(scheme?.dayStructure).toContain('背 + 二头');
    expect(scheme?.dayStructure).toContain('肩');
    expect(scheme?.dayStructure).toContain('腿');
    expect(scheme?.isAvailable).toBe(true);
    expect(scheme?.templatePlanId).toBe(MAINSTREAM_PLAN_IDS.classicBodyPartSplit);
    expect(firstWeekDays.map((day) => day.title)).toEqual(['胸 + 三头', '背 + 二头', '肩', '腿']);
    expect(firstWeekExercises).toHaveLength(24);

    const draft = createUserPlanCopyDraft({
      sourceTemplate: sourceTemplate!,
      phases,
      days: firstWeekDays,
      exercises: firstWeekExercises,
      name: '我的经典四分化增肌计划',
      originSchemeId: SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
      now: '2026-06-30T00:00:00.000Z',
    });

    expect(draft.template.source).toBe('system_copy');
    expect(draft.template.originSchemeId).toBe(SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID);
    expect(draft.days).toHaveLength(4);
    expect(draft.exercises.every((exercise) => draft.days.some((day) => day.id === exercise.planDayId))).toBe(true);
  });
});
