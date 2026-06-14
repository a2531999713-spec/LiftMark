import type { PhaseType } from './plan.types';

export const DEFAULT_CYCLE_WEEK_COUNT = 16;

export function clampDefaultCycleWeek(week: number): number {
  if (!Number.isFinite(week)) {
    return 1;
  }

  return Math.min(DEFAULT_CYCLE_WEEK_COUNT, Math.max(1, Math.round(week)));
}

export function getDefaultCyclePhaseType(week: number): PhaseType {
  const normalizedWeek = clampDefaultCycleWeek(week);

  if (normalizedWeek <= 6) {
    return 'strength';
  }

  if (normalizedWeek === 7 || normalizedWeek === 16) {
    return 'deload';
  }

  return 'hypertrophy';
}

export function describeDefaultCycleWeek(week: number): string {
  const normalizedWeek = clampDefaultCycleWeek(week);

  if (normalizedWeek <= 6) {
    return `增力第 ${normalizedWeek} 周`;
  }

  if (normalizedWeek === 7) {
    return '增力减量周';
  }

  if (normalizedWeek <= 15) {
    return `增肌第 ${normalizedWeek - 7} 周`;
  }

  return '增肌减量周';
}
