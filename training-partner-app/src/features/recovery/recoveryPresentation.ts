import { calculateRecoveryScore } from '@/domain/recovery/recovery-engine';
import type {
  RecoveryAssessmentResult,
  RecoveryLog,
  RecoveryRecommendation,
  RecoveryScoreValues,
} from '@/domain/recovery/recovery.types';

export const defaultRecoveryDraft: RecoveryScoreValues = {
  sleepScore: 3,
  appetiteScore: 3,
  motivationScore: 3,
  sorenessScore: 3,
  jointPainScore: 3,
  fatigueScore: 3,
};

export const recoveryScoreItems: {
  key: keyof RecoveryScoreValues;
  label: string;
  labels: readonly string[];
}[] = [
  { key: 'sleepScore', label: '睡眠状态', labels: ['很差', '较差', '一般', '良好', '很好'] },
  { key: 'appetiteScore', label: '食欲状态', labels: ['很差', '较差', '一般', '良好', '很好'] },
  { key: 'motivationScore', label: '训练欲望', labels: ['很差', '较差', '一般', '良好', '很好'] },
  { key: 'sorenessScore', label: '肌肉酸痛', labels: ['几乎没有', '较轻', '中等', '较重', '很重'] },
  { key: 'jointPainScore', label: '关节不适', labels: ['几乎没有', '较轻', '中等', '较重', '很重'] },
  { key: 'fatigueScore', label: '整体疲劳', labels: ['几乎没有', '较轻', '中等', '较重', '很重'] },
];

export type RecoveryTone = 'success' | 'brand' | 'warning' | 'dangerSoft' | 'danger';

export function getRecoveryTone(result: RecoveryAssessmentResult): RecoveryTone {
  if (result.status === 'good') return 'success';
  if (result.status === 'normal') return 'brand';
  if (result.status === 'low') return 'warning';
  if (result.status === 'bad') return 'dangerSoft';
  return 'danger';
}

export function getRecoveryCardCopy(
  assessment: RecoveryAssessmentResult | null,
  error = false,
): { action: string; status: string; summary: string; title: string } {
  if (error) {
    return {
      action: '重新查看',
      status: '暂不可用',
      summary: '计划不受影响，可以稍后重试评估。',
      title: '今日状态暂未加载',
    };
  }
  return {
    action: assessment
      ? assessment.status === 'good'
        ? '查看详情'
        : '查看并调整'
      : '开始评估',
    status: assessment
      ? getRecoveryRecommendationLabel(assessment.recommendation)
      : '未记录',
    summary: assessment?.summary ?? '训练前花 20 秒记录恢复情况。',
    title: assessment?.title ?? '今日状态',
  };
}

export function getRecoveryRecommendationLabel(recommendation: RecoveryRecommendation): string {
  const labels: Record<RecoveryRecommendation, string> = {
    normal: '按原计划训练',
    remove_c: '减少 C 类动作',
    reduce_weight: '临时降低重量',
    only_a: '只保留 A 类主项',
    deload: '短期减量',
    rest: '今天优先恢复',
  };
  return labels[recommendation];
}

export function getRecoveryDraftFromLog(log: RecoveryLog | null): RecoveryScoreValues {
  if (!log) return defaultRecoveryDraft;
  return {
    sleepScore: log.sleepScore,
    appetiteScore: log.appetiteScore,
    motivationScore: log.motivationScore,
    sorenessScore: log.sorenessScore,
    jointPainScore: log.jointPainScore,
    fatigueScore: log.fatigueScore,
  };
}

export function getAssessmentForLog(log: RecoveryLog): RecoveryAssessmentResult {
  const calculated = calculateRecoveryScore(log);
  if (log.recommendation !== 'deload') return calculated;
  return {
    ...calculated,
    status: 'low',
    recommendation: 'deload',
    recoveryMode: 'normal',
    title: '连续恢复偏低',
    summary: '建议安排短期减量训练或额外恢复日。',
    reasons: [...calculated.reasons.slice(0, 2), '最近三次恢复评分持续偏低。'].slice(0, 3),
    suggestedWeightReductionPercent: 7.5,
  };
}

export function formatRecoveryDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return `${parsed.getMonth() + 1}月${parsed.getDate()}日`;
}
