import { addWeightStep, roundWeightToIncrement, subtractWeightStep } from '@/domain/weight/weight-calculator';

import type {
  ExercisePerformanceSnapshot,
  ExercisePerformanceSummary,
  HistoricalExercisePerformance,
  ProgressionDecision,
  ProgressionStrategy,
} from './progression.types';

const MAX_SUGGESTED_WEIGHT_KG = 1000;

function safeIncrement(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 2.5;
}

function formatKg(value: number): string {
  return `${Math.round(value * 1000) / 1000}`;
}

function hasWorkingWeight(input: ExercisePerformanceSnapshot): boolean {
  return (input.latestWorkingWeight ?? 0) > 0 && input.completedWeights.some((weight) => weight > 0);
}

function suggestedIncrease(input: ExercisePerformanceSnapshot): number | undefined {
  if (!hasWorkingWeight(input)) return undefined;
  const next = addWeightStep(input.latestWorkingWeight ?? 0, safeIncrement(input.weightIncrement));
  return Number.isFinite(next) && next >= 0 && next <= MAX_SUGGESTED_WEIGHT_KG ? next : undefined;
}

function suggestedDecrease(input: ExercisePerformanceSnapshot, factor?: number): number | undefined {
  if (!hasWorkingWeight(input)) return undefined;
  const current = input.latestWorkingWeight ?? 0;
  const increment = safeIncrement(input.weightIncrement);
  const next = factor === undefined
    ? subtractWeightStep(current, increment)
    : roundWeightToIncrement(Math.max(0, current * factor), increment);
  return Number.isFinite(next) && next >= 0 && next <= MAX_SUGGESTED_WEIGHT_KG ? next : undefined;
}

export function roundToEquipmentIncrement(weight: number, increment: number): number {
  if (!Number.isFinite(weight)) return 0;
  return Math.max(0, roundWeightToIncrement(Math.min(weight, MAX_SUGGESTED_WEIGHT_KG), safeIncrement(increment)));
}

export function resolveProgressionStrategy(input: Pick<
  ExercisePerformanceSnapshot,
  'intensityType' | 'planGoal' | 'plannedRepMax' | 'plannedRepMin' | 'plannedReps' | 'progressionRuleId'
>): ProgressionStrategy {
  const rule = input.progressionRuleId?.toLowerCase();
  if (rule?.includes('hypertrophy')) return 'hypertrophy';
  if (rule?.includes('strength')) return 'strength';
  if (input.planGoal === 'hypertrophy') return 'hypertrophy';
  if (input.planGoal === 'strength') return 'strength';
  if (input.plannedRepMin !== undefined && input.plannedRepMax !== undefined) return 'hypertrophy';
  if (input.intensityType === 'percent_1rm' || input.intensityType === 'fixed' || (input.plannedReps ?? 99) <= 6) {
    return 'strength';
  }
  return 'general';
}

export function summarizeExercisePerformance(input: ExercisePerformanceSnapshot): ExercisePerformanceSummary {
  const targetSetCount = Math.max(1, input.plannedSets || input.completedSets + input.skippedSets);
  const validReps = input.completedReps.filter((reps) => Number.isFinite(reps) && reps >= 0);
  const completedSetCount = Math.min(targetSetCount, input.completedSets);
  const targetReps = input.plannedReps ?? input.plannedRepMax ?? input.plannedRepMin;
  const repTargetTotal = targetReps && targetReps > 0 ? targetReps * targetSetCount : 0;
  const actualRepTotal = validReps.reduce((sum, reps) => sum + reps, 0);
  const repCompletionRate = repTargetTotal > 0 ? Math.min(1, actualRepTotal / repTargetTotal) : 0;
  const allSetsReachedTarget = Boolean(
    targetReps &&
      input.skippedSets === 0 &&
      completedSetCount >= targetSetCount &&
      validReps.length >= targetSetCount &&
      validReps.slice(0, targetSetCount).every((reps) => reps >= targetReps),
  );
  const allSetsReachedRepMin = Boolean(
    input.plannedRepMin &&
      input.skippedSets === 0 &&
      completedSetCount >= targetSetCount &&
      validReps.length >= targetSetCount &&
      validReps.slice(0, targetSetCount).every((reps) => reps >= input.plannedRepMin!),
  );
  const allSetsReachedRepMax = Boolean(
    input.plannedRepMax &&
      input.skippedSets === 0 &&
      completedSetCount >= targetSetCount &&
      validReps.length >= targetSetCount &&
      validReps.slice(0, targetSetCount).every((reps) => reps >= input.plannedRepMax!),
  );
  const positiveWeights = input.completedWeights.filter((weight) => Number.isFinite(weight) && weight > 0);
  const minWeight = positiveWeights.length > 0 ? Math.min(...positiveWeights) : 0;
  const maxWeight = positiveWeights.length > 0 ? Math.max(...positiveWeights) : 0;

  return {
    allSetsReachedRepMax,
    allSetsReachedRepMin,
    allSetsReachedTarget,
    averageReps: validReps.length > 0 ? actualRepTotal / validReps.length : 0,
    hasValidWorkingSets: validReps.length > 0 && completedSetCount > 0,
    repCompletionRate,
    setCompletionRate: completedSetCount / targetSetCount,
    workingWeightConsistency: positiveWeights.length <= 1 || maxWeight - minWeight <= safeIncrement(input.weightIncrement),
  };
}

function consecutiveLowCompletionCount(
  current: ExercisePerformanceSummary,
  history: HistoricalExercisePerformance[],
  threshold: number,
): number {
  let count = current.repCompletionRate < threshold || current.setCompletionRate < threshold ? 1 : 0;
  if (count === 0) return 0;
  for (const item of history) {
    if (!item.hasValidWorkingSets || item.repCompletionRate >= threshold) break;
    count += 1;
  }
  return count;
}

function decision(
  suggestion: ProgressionDecision['suggestion'],
  reason: string,
  suggestedWeight: number | undefined,
  performance: ExercisePerformanceSummary,
  strategy: ProgressionStrategy,
): ProgressionDecision {
  return { performance, reason, strategy, suggestedWeight, suggestion };
}

export function getProgressionDecision(
  input: ExercisePerformanceSnapshot,
  history: HistoricalExercisePerformance[] = [],
): ProgressionDecision | null {
  const performance = summarizeExercisePerformance(input);
  if (!performance.hasValidWorkingSets) return null;
  const strategy = resolveProgressionStrategy(input);
  const lowCompletionCount = consecutiveLowCompletionCount(performance, history, 0.9);
  const severeFailureCount = consecutiveLowCompletionCount(performance, history, 0.6);
  const currentWeight = input.latestWorkingWeight;

  if (strategy === 'hypertrophy') {
    if (performance.allSetsReachedRepMax) {
      const next = suggestedIncrease(input);
      return decision(
        'increase',
        next === undefined
          ? '所有工作组均达到次数区间上限，下次可增加次数、停顿或外部负重。'
          : `所有工作组均达到次数区间上限，建议按器械最小增量增加至 ${formatKg(next)} kg，并从区间下限重新积累。`,
        next,
        performance,
        strategy,
      );
    }
    if (performance.allSetsReachedRepMin) {
      return decision(
        'add_reps',
        currentWeight && currentWeight > 0
          ? `当前重量 ${formatKg(currentWeight)} kg 下已达到有效次数区间，下次继续增加总次数，优先让更多组接近上限。`
          : '当前动作已达到有效次数区间，下次继续增加次数，优先让更多组接近上限。',
        currentWeight && currentWeight > 0 ? currentWeight : undefined,
        performance,
        strategy,
      );
    }
    if (lowCompletionCount >= 2) {
      const next = suggestedDecrease(input);
      return decision(
        'decrease',
        next === undefined
          ? '最近两次均有工作组低于次数区间下限，建议降低难度后重新完成目标次数。'
          : `最近两次均有工作组低于次数区间下限，建议降低一个重量档位至 ${formatKg(next)} kg。`,
        next,
        performance,
        strategy,
      );
    }
    return decision('maintain', '部分工作组未达到次数区间下限，先维持重量并完成目标次数。', currentWeight, performance, strategy);
  }

  if (strategy === 'strength') {
    if (severeFailureCount >= 3) {
      const next = suggestedDecrease(input, 0.9);
      return decision(
        'deload',
        next === undefined
          ? '连续 3 次训练完成率低于 60%，建议减量并优先恢复动作质量。'
          : `连续 3 次训练完成率低于 60%，建议减量至 ${formatKg(next)} kg，并优先恢复动作质量。`,
        next,
        performance,
        strategy,
      );
    }
    if (lowCompletionCount >= 2) {
      const next = suggestedDecrease(input);
      return decision(
        'decrease',
        next === undefined
          ? '最近两次均有超过 10% 的目标次数未完成，建议降低一个重量档位。'
          : `最近两次均有超过 10% 的目标次数未完成，建议降低一个重量档位至 ${formatKg(next)} kg。`,
        next,
        performance,
        strategy,
      );
    }
    if (performance.allSetsReachedTarget) {
      const next = suggestedIncrease(input);
      return decision(
        'increase',
        next === undefined
          ? '全部计划组均达到目标次数，当前动作没有可用工作重量，建议先维持并继续记录。'
          : `全部 ${input.plannedSets} 组均达到目标次数，建议按器械最小增量增加至 ${formatKg(next)} kg。`,
        next,
        performance,
        strategy,
      );
    }
    if (performance.repCompletionRate >= 0.9 && performance.setCompletionRate >= 0.9) {
      return decision('maintain', '本次接近完成目标，下次维持当前重量，优先完成全部计划组。', currentWeight, performance, strategy);
    }
    return decision('maintain_or_decrease', '本次未完全达到目标；下次可先维持，若恢复状态不足则小幅降重。', undefined, performance, strategy);
  }

  if (performance.allSetsReachedTarget && history.length >= 2 && history.slice(0, 2).every((item) => item.allSetsReachedTarget) && performance.workingWeightConsistency) {
    const next = suggestedIncrease(input);
    return decision(
      next === undefined ? 'maintain' : 'increase',
      next === undefined
        ? '当前训练样本稳定，但没有可靠工作重量，建议维持安排并继续积累数据。'
        : `最近多次训练稳定完成，建议按器械最小增量增加至 ${formatKg(next)} kg。`,
      next,
      performance,
      strategy,
    );
  }
  if (lowCompletionCount >= 2) {
    return decision('decrease', '最近两次训练均明显低于目标，建议降低一个重量档位或减少训练量。', suggestedDecrease(input), performance, strategy);
  }
  if (performance.repCompletionRate < 0.9) {
    return decision('maintain_or_decrease', '本次未完全达到目标；建议维持安排并继续观察恢复状态。', undefined, performance, strategy);
  }
  return decision('maintain', '当前训练样本不足，建议维持安排并继续积累数据。', currentWeight, performance, strategy);
}
