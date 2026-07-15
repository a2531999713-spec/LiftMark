import type { RecoveryMode } from '../plan/plan.service';
import type {
  RecoveryAssessmentResult,
  RecoveryRecommendation,
  RecoveryScoreValues,
} from './recovery.types';

export type RecoveryScoreInput = RecoveryScoreValues & {
  hasSignificantDiscomfort?: boolean;
};

export type RecentRecoveryAssessment = {
  recommendation: RecoveryRecommendation;
  totalScore: number;
};

const SCORE_KEYS: (keyof RecoveryScoreValues)[] = [
  'sleepScore',
  'appetiteScore',
  'motivationScore',
  'sorenessScore',
  'jointPainScore',
  'fatigueScore',
];

function assertValidScores(input: RecoveryScoreInput): void {
  for (const key of SCORE_KEYS) {
    const value = input[key];
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      throw new RangeError(`${key} must be an integer between 1 and 5.`);
    }
  }
}

function buildReasons(input: RecoveryScoreInput, recommendation: RecoveryRecommendation): string[] {
  const reasons: string[] = [];
  if (input.jointPainScore >= 4) reasons.push('关节不适较明显。');
  else if (input.jointPainScore === 3) reasons.push('关节状态需要留意。');
  if (input.fatigueScore >= 4) reasons.push('整体疲劳偏高。');
  else if (input.fatigueScore === 3) reasons.push('整体疲劳处于中等水平。');
  if (input.sorenessScore >= 4) reasons.push('肌肉酸痛较明显。');
  if (input.sleepScore <= 2) reasons.push('昨晚睡眠状态较差。');
  if (input.appetiteScore <= 2) reasons.push('今天食欲状态偏低。');
  if (input.motivationScore <= 2) reasons.push('今天训练欲望偏低。');
  if (input.hasSignificantDiscomfort) reasons.push('你记录了明显身体不适。');

  if (reasons.length === 0) {
    reasons.push(
      recommendation === 'normal'
        ? '今天状态适合按原计划训练。'
        : '今天的综合状态建议适当调整训练。',
    );
  }
  return reasons.slice(0, 3);
}

function buildResult(
  input: RecoveryScoreInput,
  totalScore: number,
  recommendation: RecoveryRecommendation,
  recoveryMode: RecoveryMode,
): RecoveryAssessmentResult {
  const copy: Record<
    Exclude<RecoveryRecommendation, 'deload'>,
    Pick<RecoveryAssessmentResult, 'status' | 'title' | 'summary'>
  > = {
    normal: {
      status: 'good',
      title: '今日状态良好',
      summary: '建议按原计划训练。',
    },
    remove_c: {
      status: 'normal',
      title: '今日状态一般',
      summary: '建议保留主项，减少 C 类辅助动作。',
    },
    reduce_weight: {
      status: 'low',
      title: '今天恢复不足',
      summary: '建议保留动作，并临时降低本次训练重量。',
    },
    only_a: {
      status: 'bad',
      title: '今天状态较差',
      summary: '建议只完成 A 类主项，或选择按原计划训练。',
    },
    rest: {
      status: 'rest',
      title: '今天更适合恢复',
      summary: '建议暂停今天的力量训练，优先恢复。',
    },
  };
  const selected = recommendation === 'deload' ? copy.reduce_weight : copy[recommendation];
  return {
    totalScore,
    recommendation,
    recoveryMode,
    ...selected,
    reasons: buildReasons(input, recommendation),
    ...(recommendation === 'reduce_weight' || recommendation === 'deload'
      ? { suggestedWeightReductionPercent: 7.5 }
      : {}),
  };
}

export function calculateRecoveryScore(input: RecoveryScoreInput): RecoveryAssessmentResult {
  assertValidScores(input);
  const totalScore =
    input.sleepScore +
    input.appetiteScore +
    input.motivationScore +
    (6 - input.sorenessScore) +
    (6 - input.jointPainScore) +
    (6 - input.fatigueScore);

  if (
    totalScore <= 12 ||
    input.jointPainScore === 5 ||
    input.fatigueScore === 5 ||
    input.hasSignificantDiscomfort
  ) {
    return buildResult(input, totalScore, 'rest', 'very_bad');
  }

  if (totalScore <= 16 || input.jointPainScore === 4) {
    return buildResult(input, totalScore, 'only_a', 'bad');
  }

  if (totalScore <= 20 || input.fatigueScore === 4 || input.sorenessScore === 4) {
    return buildResult(input, totalScore, 'reduce_weight', 'good');
  }

  if (totalScore >= 25 && input.jointPainScore <= 2 && input.fatigueScore <= 2) {
    return buildResult(input, totalScore, 'normal', 'good');
  }

  return buildResult(input, totalScore, 'remove_c', 'normal');
}

export function applyConsecutiveLowRecoveryRule(
  current: RecoveryAssessmentResult,
  previous: RecentRecoveryAssessment[],
): RecoveryAssessmentResult {
  if (current.recommendation === 'rest' || current.recommendation === 'only_a') {
    return current;
  }

  const recent = [current, ...previous].slice(0, 3);
  const lowRecommendations = new Set<RecoveryRecommendation>([
    'only_a',
    'reduce_weight',
    'rest',
  ]);
  const averageScore = recent.reduce((sum, item) => sum + item.totalScore, 0) / recent.length;
  if (
    recent.length === 3 &&
    averageScore < 17 &&
    recent.every((item) => lowRecommendations.has(item.recommendation))
  ) {
    return {
      ...current,
      status: 'low',
      recommendation: 'deload',
      recoveryMode: 'normal',
      title: '连续恢复偏低',
      summary: '建议安排短期减量训练或额外恢复日。',
      reasons: [...current.reasons.slice(0, 2), '最近三次恢复评分持续偏低。'].slice(0, 3),
      suggestedWeightReductionPercent: 7.5,
    };
  }

  return current;
}
