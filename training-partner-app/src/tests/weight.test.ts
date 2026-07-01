import { describe, expect, it } from '@jest/globals';

import type { MemberProfile } from '@/domain/member/member.types';
import {
  addWeightStep,
  calculateSuggestedWeight,
  formatWeight,
  subtractWeightStep,
} from '@/domain/weight/weight-calculator';

function createProfile(patch: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: 'profile_1',
    memberId: 'member_1',
    groupId: 'group_1',
    bodyweight: 80,
    bench1RM: 100,
    squat1RM: 120,
    deadlift1RM: 150,
    overheadPress1RM: 60,
    barbellIncrement: 2.5,
    dumbbellIncrement: 2.5,
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...patch,
  };
}

describe('suggested weight calculation', () => {
  it('rounds barbell percentage work to the member barbell increment', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'bench',
      percent1RM: 0.775,
      equipment: 'barbell',
      profile: createProfile(),
    });

    expect(result).toEqual({ status: 'ready', percent1RM: 0.775, weight: 77.5 });
  });

  it('uses dumbbell increment for dumbbell exercises', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'overhead_press',
      percent1RM: 0.65,
      equipment: 'dumbbell',
      profile: createProfile({ dumbbellIncrement: 2 }),
    });

    expect(result).toEqual({ status: 'ready', percent1RM: 0.65, weight: 40 });
  });

  it('keeps the default 2.5kg dumbbell step instead of falling back to 2kg', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'overhead_press',
      percent1RM: 0.7,
      equipment: 'dumbbell',
      profile: createProfile(),
    });

    expect(result).toEqual({ status: 'ready', percent1RM: 0.7, weight: 42.5 });
  });

  it('preserves custom fractional increments and formats them cleanly', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'overhead_press',
      percent1RM: 0.65,
      equipment: 'dumbbell',
      profile: createProfile({ dumbbellIncrement: 1.25 }),
    });

    expect(result).toEqual({ status: 'ready', percent1RM: 0.65, weight: 38.75 });
    expect(addWeightStep(38.75, 1.25)).toBe(40);
    expect(subtractWeightStep(40, 1.25)).toBe(38.75);
    expect(formatWeight(38.75)).toBe('38.75');
  });

  it('falls back to bodyweight for pull-up total load when reference weight is empty', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'pullup_total',
      percent1RM: 0.75,
      equipment: 'bodyweight',
      profile: createProfile({ pullupReferenceWeight: undefined }),
    });

    expect(result).toEqual({ status: 'ready', percent1RM: 0.75, weight: 60 });
  });

  it('returns missing 1RM when the needed member parameter is absent', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'squat',
      percent1RM: 0.8,
      equipment: 'barbell',
      profile: createProfile({ squat1RM: undefined }),
    });

    expect(result.status).toBe('missing_1rm');
  });

  it('infers a conservative percentage from target rep ranges', () => {
    const result = calculateSuggestedWeight({
      referenceLift: 'bench',
      repMin: 5,
      repMax: 8,
      equipment: 'barbell',
      profile: createProfile(),
    });

    expect(result).toEqual({ status: 'ready', percent1RM: 0.75, weight: 75 });
  });
});
