import type { ID } from '@/domain/common/ids';
import type { TrainingProfileDraft } from '@/domain/onboarding/trainingProfile.types';

import {
  SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID,
  SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID,
  SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
  SYSTEM_SCHEME_CLASSIC_PPL_ID,
  SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID,
  SYSTEM_SCHEME_HOME_DUMBBELL_ID,
  SYSTEM_SCHEME_RECOVERY_ID,
  SYSTEM_SCHEME_UPPER_LOWER_ID,
  type SystemTrainingScheme,
} from './systemSchemes';

export type RecommendedPlan = {
  isPrimary: boolean;
  reasons: string[];
  scheme: SystemTrainingScheme;
  score: number;
};

const orderedFallbackSchemeIds: ID[] = [
  SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID,
  SYSTEM_SCHEME_CLASSIC_PPL_ID,
  SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID,
  SYSTEM_SCHEME_UPPER_LOWER_ID,
  SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID,
  SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID,
  SYSTEM_SCHEME_RECOVERY_ID,
  SYSTEM_SCHEME_HOME_DUMBBELL_ID,
];

function normalizeTrainingDays(value: TrainingProfileDraft['trainingDaysPerWeek']): number {
  return value === 'flexible' ? 3 : value;
}

function addScore(
  scores: Map<ID, { reasons: string[]; score: number }>,
  schemeId: ID,
  score: number,
  reason: string,
) {
  const current = scores.get(schemeId) ?? { reasons: [], score: 0 };
  current.score += score;
  current.reasons.push(reason);
  scores.set(schemeId, current);
}

export function recommendPlans(
  profile: TrainingProfileDraft,
  systemPlans: SystemTrainingScheme[],
): RecommendedPlan[] {
  const availablePlans = systemPlans.filter((scheme) => scheme.isAvailable && scheme.templatePlanId);
  const scores = new Map<ID, { reasons: string[]; score: number }>();
  const days = normalizeTrainingDays(profile.trainingDaysPerWeek);

  if (profile.equipment === 'home_basic' || profile.equipment === 'dumbbell_barbell') {
    addScore(scores, SYSTEM_SCHEME_HOME_DUMBBELL_ID, 120, '器械条件更适合居家或哑铃训练。');
  }

  if (profile.goal === 'recovery') {
    addScore(scores, SYSTEM_SCHEME_RECOVERY_ID, 90, '当前目标是恢复训练，优先降低训练压力。');
  }

  if (
    profile.goal === 'beginner' ||
    profile.experience === 'just_started' ||
    profile.experience === 'under_3_months'
  ) {
    addScore(scores, SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID, 85, '训练经验较少，全身三练更容易建立节奏。');
  }

  if (profile.goal === 'strength') {
    addScore(scores, SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID, 74, '目标偏力量，5x5 更适合小步加重。');
    if (days <= 3) {
      addScore(scores, SYSTEM_SCHEME_BASIC_STRENGTH_5X5_ID, 18, '每周 3 天以内适合基础力量计划。');
    }
  }

  if (profile.goal === 'hypertrophy') {
    if (days >= 4) {
      addScore(scores, SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID, 88, '每周 4 天适合胸背肩腿四分化增肌。');
      addScore(scores, SYSTEM_SCHEME_UPPER_LOWER_ID, 72, '上下肢分化也适合稳定增加训练容量。');
    } else {
      addScore(scores, SYSTEM_SCHEME_CLASSIC_PPL_ID, 82, '增肌目标每周 3 天适合 PPL 三分化。');
    }
  }

  if (profile.goal === 'fat_loss') {
    addScore(scores, SYSTEM_SCHEME_FAT_LOSS_MAINTENANCE_ID, 86, '减脂期优先保留复合动作和可恢复训练量。');
  }

  if (days <= 2) {
    addScore(scores, SYSTEM_SCHEME_RECOVERY_ID, 26, '每周可训练天数较少，低频计划更稳。');
    addScore(scores, SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID, 24, '全身训练能在低频下覆盖主要动作。');
  }

  if (days === 3) {
    addScore(scores, SYSTEM_SCHEME_BEGINNER_FULL_BODY_ID, 12, '每周 3 天适合全身计划。');
    addScore(scores, SYSTEM_SCHEME_CLASSIC_PPL_ID, 10, '每周 3 天也适合 PPL 三分化。');
  }

  if (days >= 4) {
    addScore(scores, SYSTEM_SCHEME_CLASSIC_BODY_PART_SPLIT_ID, 18, '每周 4 天以上可以使用身体部位分化。');
    addScore(scores, SYSTEM_SCHEME_UPPER_LOWER_ID, 18, '每周 4 天以上适合上下肢分化。');
  }

  const recommended = availablePlans
    .map((scheme) => {
      const score = scores.get(scheme.id);
      return {
        isPrimary: false,
        reasons: score?.reasons.length ? score.reasons : [scheme.recommendationReason],
        scheme,
        score: score?.score ?? 1,
      };
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return (
        orderedFallbackSchemeIds.indexOf(left.scheme.id) -
        orderedFallbackSchemeIds.indexOf(right.scheme.id)
      );
    });

  if (recommended.length === 0) {
    return [];
  }

  return recommended.slice(0, 3).map((item, index) => ({
    ...item,
    isPrimary: index === 0,
  }));
}
