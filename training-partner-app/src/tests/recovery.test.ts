import { describe, expect, it } from '@jest/globals';

import {
  applyConsecutiveLowRecoveryRule,
  calculateRecoveryScore,
} from '@/domain/recovery/recovery-engine';

describe('recovery scoring', () => {
  const goodScores = {
    sleepScore: 5,
    appetiteScore: 5,
    motivationScore: 5,
    sorenessScore: 1,
    jointPainScore: 1,
    fatigueScore: 1,
  } as const;

  it('keeps all priorities when all six recovery signals are good', () => {
    expect(calculateRecoveryScore(goodScores)).toMatchObject({
      totalScore: 30,
      status: 'good',
      recommendation: 'normal',
      recoveryMode: 'good',
    });
  });

  it('removes C priority work for a middle recovery score', () => {
    expect(
      calculateRecoveryScore({
        sleepScore: 4,
        appetiteScore: 4,
        motivationScore: 4,
        sorenessScore: 2,
        jointPainScore: 2,
        fatigueScore: 3,
      }),
    ).toMatchObject({ recommendation: 'remove_c', recoveryMode: 'normal' });
  });

  it('recommends a temporary weight reduction when fatigue is high', () => {
    expect(
      calculateRecoveryScore({
        ...goodScores,
        fatigueScore: 4,
      }),
    ).toMatchObject({
      recommendation: 'reduce_weight',
      suggestedWeightReductionPercent: 7.5,
    });
  });

  it('recommends a temporary weight reduction when soreness is high despite a high total', () => {
    expect(calculateRecoveryScore({ ...goodScores, sorenessScore: 4 })).toMatchObject({
      recommendation: 'reduce_weight',
    });
  });

  it('keeps only A priority work when joint pain is high', () => {
    expect(
      calculateRecoveryScore({
        sleepScore: 5,
        appetiteScore: 5,
        motivationScore: 5,
        sorenessScore: 1,
        jointPainScore: 4,
        fatigueScore: 1,
      }),
    ).toMatchObject({
      recommendation: 'only_a',
      recoveryMode: 'bad',
    });
  });

  it('recommends rest for a hard stop signal', () => {
    expect(calculateRecoveryScore({ ...goodScores, jointPainScore: 5 })).toMatchObject({
      status: 'rest',
      recommendation: 'rest',
      recoveryMode: 'very_bad',
    });
  });

  const boundaryCases: [
    number,
    Parameters<typeof calculateRecoveryScore>[0],
    ReturnType<typeof calculateRecoveryScore>['recommendation'],
  ][] = [
    [12, { sleepScore: 1, appetiteScore: 1, motivationScore: 1, sorenessScore: 3, jointPainScore: 3, fatigueScore: 3 }, 'rest'],
    [13, { sleepScore: 2, appetiteScore: 1, motivationScore: 1, sorenessScore: 3, jointPainScore: 3, fatigueScore: 3 }, 'only_a'],
    [16, { sleepScore: 3, appetiteScore: 2, motivationScore: 2, sorenessScore: 3, jointPainScore: 3, fatigueScore: 3 }, 'only_a'],
    [17, { sleepScore: 2, appetiteScore: 3, motivationScore: 3, sorenessScore: 3, jointPainScore: 3, fatigueScore: 3 }, 'reduce_weight'],
    [20, { sleepScore: 4, appetiteScore: 4, motivationScore: 3, sorenessScore: 3, jointPainScore: 3, fatigueScore: 3 }, 'reduce_weight'],
    [21, { sleepScore: 4, appetiteScore: 4, motivationScore: 4, sorenessScore: 3, jointPainScore: 3, fatigueScore: 3 }, 'remove_c'],
    [24, { sleepScore: 4, appetiteScore: 4, motivationScore: 4, sorenessScore: 2, jointPainScore: 2, fatigueScore: 2 }, 'remove_c'],
    [25, { sleepScore: 5, appetiteScore: 4, motivationScore: 4, sorenessScore: 2, jointPainScore: 2, fatigueScore: 2 }, 'normal'],
  ];

  it.each(boundaryCases)('maps boundary score %s deterministically', (totalScore, input, recommendation) => {
    const first = calculateRecoveryScore(input);
    const second = calculateRecoveryScore(input);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ recommendation, totalScore });
    expect(Number.isNaN(first.totalScore)).toBe(false);
  });

  it('includes fatigue in the score and reverses negative indicators', () => {
    const baseline = calculateRecoveryScore({
      sleepScore: 3,
      appetiteScore: 3,
      motivationScore: 3,
      sorenessScore: 3,
      jointPainScore: 3,
      fatigueScore: 3,
    });
    const moreFatigued = calculateRecoveryScore({
      sleepScore: 3,
      appetiteScore: 3,
      motivationScore: 3,
      sorenessScore: 4,
      jointPainScore: 4,
      fatigueScore: 4,
    });
    expect(baseline.totalScore).toBe(18);
    expect(moreFatigued.totalScore).toBe(15);
  });

  it('rejects scores outside the 1 to 5 range', () => {
    expect(() => calculateRecoveryScore({ ...goodScores, sleepScore: 0 })).toThrow(RangeError);
  });

  it('upgrades three consecutive low results to a deload recommendation', () => {
    const current = calculateRecoveryScore({
      sleepScore: 3,
      appetiteScore: 3,
      motivationScore: 3,
      sorenessScore: 4,
      jointPainScore: 3,
      fatigueScore: 3,
    });

    expect(
      applyConsecutiveLowRecoveryRule(current, [
        { totalScore: 16, recommendation: 'only_a' },
        { totalScore: 15, recommendation: 'reduce_weight' },
      ]),
    ).toMatchObject({ recommendation: 'deload', suggestedWeightReductionPercent: 7.5 });
  });
});
