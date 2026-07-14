import { describe, expect, it } from '@jest/globals';

import { createClassicPplPlanTemplateSeed, classicPplPhaseSeed, classicPplPlanDaySeeds, classicPplPlanExerciseSeeds } from '@/data/seed/classicPplPlan';
import { defaultExerciseSeeds } from '@/data/seed/defaultExercises';
import {
  createMainstreamPlanTemplateSeeds,
  mainstreamPlanDaySeeds,
  mainstreamPlanExerciseSeeds,
  mainstreamPlanPhaseSeeds,
} from '@/data/seed/mainstreamPlans';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';
import {
  defaultSystemPlanLibraryFilters,
  filterSystemPlanLibrary,
  sortSystemPlanLibrary,
  validateSystemSchemeCatalog,
} from '@/features/plan-library/systemPlanLibrary';

describe('system plan library', () => {
  const schemes = listSystemTrainingSchemes();

  it('filters locally by goal, frequency, level, equipment and query', () => {
    expect(filterSystemPlanLibrary(schemes, { ...defaultSystemPlanLibraryFilters, goal: 'strength' }).map((item) => item.id))
      .toEqual(['scheme_basic_strength_5x5']);
    expect(filterSystemPlanLibrary(schemes, { ...defaultSystemPlanLibraryFilters, frequency: '2' }).map((item) => item.id))
      .toEqual(['scheme_recovery_training']);
    expect(filterSystemPlanLibrary(schemes, { ...defaultSystemPlanLibraryFilters, level: 'beginner' })).toHaveLength(2);
    expect(filterSystemPlanLibrary(schemes, { ...defaultSystemPlanLibraryFilters, level: 'general' })).toHaveLength(2);
    expect(filterSystemPlanLibrary(schemes, { ...defaultSystemPlanLibraryFilters, equipment: 'home_dumbbell' }).map((item) => item.id))
      .toEqual(['scheme_home_dumbbell']);
    expect(filterSystemPlanLibrary(schemes, { ...defaultSystemPlanLibraryFilters, query: 'PPL' }).map((item) => item.id))
      .toEqual(['scheme_classic_three_day_ppl']);
  });

  it('sorts recommendations first, then availability and stable catalog order', () => {
    const catalogOrder = schemes.map((item) => item.id);
    const reversed = [...schemes].reverse();
    const sorted = sortSystemPlanLibrary(reversed, catalogOrder, ['scheme_basic_strength_5x5']);
    expect(sorted[0].id).toBe('scheme_basic_strength_5x5');
    expect(sorted.slice(1).map((item) => item.id)).toEqual(catalogOrder.filter((id) => id !== 'scheme_basic_strength_5x5'));
  });

  it('validates all eight current schemes against their real seeded templates', () => {
    const now = '2026-07-15T00:00:00.000Z';
    const issues = validateSystemSchemeCatalog(schemes, {
      days: [...mainstreamPlanDaySeeds, ...classicPplPlanDaySeeds],
      exerciseIds: new Set(defaultExerciseSeeds.map((exercise) => exercise.id)),
      phases: [...mainstreamPlanPhaseSeeds, classicPplPhaseSeed],
      planExercises: [...mainstreamPlanExerciseSeeds, ...classicPplPlanExerciseSeeds],
      templates: [...createMainstreamPlanTemplateSeeds(now), createClassicPplPlanTemplateSeed(now)],
    });
    expect(schemes).toHaveLength(8);
    expect(issues).toEqual([]);
  });

  it('returns structured catalog issues instead of throwing', () => {
    const issues = validateSystemSchemeCatalog([{ ...schemes[0], templatePlanId: undefined }]);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_template_id', schemeId: schemes[0].id }),
    ]));
  });
});
