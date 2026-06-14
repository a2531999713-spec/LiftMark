import { describe, expect, it } from '@jest/globals';

import { calculateRecoveryScore } from '@/domain/recovery/recovery-engine';

describe('recovery scoring', () => {
  it('keeps all priorities when recovery score is high', () => {
    expect(
      calculateRecoveryScore({
        sleepScore: 5,
        appetiteScore: 5,
        motivationScore: 5,
        sorenessScore: 1,
        jointPainScore: 1,
      }),
    ).toEqual({
      totalScore: 25,
      recommendation: 'normal',
      recoveryMode: 'good',
    });
  });

  it('removes C priority work for a middle recovery score', () => {
    expect(
      calculateRecoveryScore({
        sleepScore: 4,
        appetiteScore: 3,
        motivationScore: 3,
        sorenessScore: 3,
        jointPainScore: 3,
      }).recoveryMode,
    ).toBe('normal');
  });

  it('keeps only A priority work when joint pain is high', () => {
    expect(
      calculateRecoveryScore({
        sleepScore: 5,
        appetiteScore: 5,
        motivationScore: 5,
        sorenessScore: 1,
        jointPainScore: 4,
      }),
    ).toMatchObject({
      recommendation: 'only_a',
      recoveryMode: 'bad',
    });
  });
});
