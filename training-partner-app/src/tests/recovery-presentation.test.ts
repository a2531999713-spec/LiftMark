import { describe, expect, it } from '@jest/globals';

import {
  defaultRecoveryDraft,
  getAssessmentForLog,
  getRecoveryCardCopy,
  getRecoveryDraftFromLog,
  getRecoveryRecommendationLabel,
  recoveryScoreItems,
} from '@/features/recovery/recoveryPresentation';

describe('recovery presentation model', () => {
  it('contains all six assessment items with neutral defaults', () => {
    expect(recoveryScoreItems.map((item) => item.key)).toEqual([
      'sleepScore',
      'appetiteScore',
      'motivationScore',
      'sorenessScore',
      'jointPainScore',
      'fatigueScore',
    ]);
    expect(Object.values(defaultRecoveryDraft)).toEqual([3, 3, 3, 3, 3, 3]);
    expect(recoveryScoreItems[0]?.labels).toEqual(['很差', '较差', '一般', '良好', '很好']);
    expect(recoveryScoreItems[5]?.labels).toEqual(['几乎没有', '较轻', '中等', '较重', '很重']);
  });

  it('keeps missing and failed status cards non-blocking', () => {
    expect(getRecoveryCardCopy(null)).toEqual({
      action: '开始评估',
      status: '未记录',
      summary: '训练前花 20 秒记录恢复情况。',
      title: '今日状态',
    });
    expect(getRecoveryCardCopy(null, true)).toMatchObject({
      action: '重新查看',
      status: '暂不可用',
      title: '今日状态暂未加载',
    });
  });

  it('uses the saved same-day values when editing', () => {
    const log = {
      appetiteScore: 4,
      createdAt: '2026-07-15T07:00:00.000Z',
      date: '2026-07-15',
      fatigueScore: 2,
      id: 'recovery-a',
      jointPainScore: 1,
      memberId: 'member-a',
      motivationScore: 4,
      recommendation: 'normal' as const,
      sleepScore: 5,
      sorenessScore: 2,
      totalScore: 26,
      updatedAt: '2026-07-15T08:00:00.000Z',
    };

    expect(getRecoveryDraftFromLog(log)).toEqual({
      appetiteScore: 4,
      fatigueScore: 2,
      jointPainScore: 1,
      motivationScore: 4,
      sleepScore: 5,
      sorenessScore: 2,
    });
    expect(getAssessmentForLog(log)).toMatchObject({ recommendation: 'normal', totalScore: 26 });
  });

  it('provides concise labels for every deterministic recommendation', () => {
    expect([
      'normal',
      'remove_c',
      'reduce_weight',
      'only_a',
      'deload',
      'rest',
    ].map((value) => getRecoveryRecommendationLabel(value as never))).toEqual([
      '按原计划训练',
      '减少 C 类动作',
      '临时降低重量',
      '只保留 A 类主项',
      '短期减量',
      '今天优先恢复',
    ]);
  });
});
