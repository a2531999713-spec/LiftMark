import { describe, expect, it } from '@jest/globals';

import { recommendPlans } from '@/domain/plan/planRecommendation';
import {
  listSystemTrainingSchemes,
  SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID,
  SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID,
  SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
  SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID,
  SYSTEM_SCHEME_HOME_DUMBBELL_ID,
  SYSTEM_SCHEME_UPPER_LOWER_ID,
} from '@/domain/plan/systemSchemes';
import type { TrainingProfileDraft } from '@/domain/onboarding/trainingProfile.types';

const baseProfile: TrainingProfileDraft = {
  equipment: 'full_gym',
  experience: 'three_to_twelve_months',
  goal: 'hypertrophy',
  trainingDaysPerWeek: 3,
};

describe('plan recommendation', () => {
  it('recommends beginner full body for new users with low frequency', () => {
    const result = recommendPlans(
      {
        ...baseProfile,
        equipment: 'unknown',
        experience: 'just_started',
        goal: 'beginner',
        trainingDaysPerWeek: 2,
      },
      listSystemTrainingSchemes(),
    );

    expect(result[0]?.scheme.id).toBe(SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID);
    expect(result[0]?.isPrimary).toBe(true);
  });

  it('recommends classic body-part split for hypertrophy users training four days', () => {
    const result = recommendPlans(
      { ...baseProfile, goal: 'hypertrophy', trainingDaysPerWeek: 4 },
      listSystemTrainingSchemes(),
    );

    expect(result[0]?.scheme.id).toBe(SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID);
    expect(result.map((item) => item.scheme.id)).toContain(SYSTEM_SCHEME_UPPER_LOWER_ID);
  });

  it('recommends 5x5 for strength users with full gym equipment', () => {
    const result = recommendPlans(
      { ...baseProfile, goal: 'strength', trainingDaysPerWeek: 3 },
      listSystemTrainingSchemes(),
    );

    expect(result[0]?.scheme.id).toBe(SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID);
  });

  it('recommends fat loss maintenance for fat loss goals', () => {
    const result = recommendPlans(
      { ...baseProfile, goal: 'fat_loss', trainingDaysPerWeek: 3 },
      listSystemTrainingSchemes(),
    );

    expect(result[0]?.scheme.id).toBe(SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID);
  });

  it('prioritizes home dumbbell plans when equipment is limited', () => {
    const result = recommendPlans(
      { ...baseProfile, equipment: 'dumbbell_barbell', goal: 'hypertrophy' },
      listSystemTrainingSchemes(),
    );

    expect(result[0]?.scheme.id).toBe(SYSTEM_SCHEME_HOME_DUMBBELL_ID);
  });
});
