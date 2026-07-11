import { describe, expect, it } from '@jest/globals';

import {
  calculateCycleCompletionRate,
  canArchivePlanCycle,
  canCompletePlanCycle,
  isPlanCycleReadyToComplete,
  calculatePlanCycleOverview,
} from '@/domain/plan/planCycle.service';
import type { PlanCycle } from '@/domain/plan/plan.types';

const cycle: PlanCycle = {
  createdAt: '2026-07-01T00:00:00.000Z',
  cycleIndex: 1,
  groupId: 'group-1',
  id: 'cycle-1',
  name: '力量周期 1',
  planId: 'plan-1',
  plannedWeeks: 4,
  startDate: '2026-07-01',
  status: 'active',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

describe('plan cycle domain', () => {
  it('clamps completion rate and handles empty plans', () => {
    expect(calculateCycleCompletionRate(0, 3)).toBe(0);
    expect(calculateCycleCompletionRate(8, 4)).toBe(0.5);
    expect(calculateCycleCompletionRate(8, 12)).toBe(1);
  });

  it('marks an active cycle ready at its final week', () => {
    expect(isPlanCycleReadyToComplete(cycle, 3, 3)).toBe(false);
    expect(isPlanCycleReadyToComplete(cycle, 4, 3)).toBe(true);
  });

  it('keeps state transitions explicit and archive idempotent', () => {
    expect(canCompletePlanCycle('active')).toBe(true);
    expect(canCompletePlanCycle('completed')).toBe(false);
    expect(canArchivePlanCycle('completed')).toBe(true);
    expect(canArchivePlanCycle('archived')).toBe(true);
    expect(canArchivePlanCycle('active')).toBe(false);
  });

  it('recalculates the same cycle summary deterministically with report fallback', () => {
    const input = {
      cycle,
      frequencyPerWeek: 2,
      planName: '力量计划',
      sessions: [{
        bodyweightsKg: [80],
        completedSets: 2,
        durationSeconds: 3600,
        hasReport: false,
        sessionId: 'session-1',
        totalReps: 10,
        totalVolume: 800,
      }],
      today: '2026-07-14',
    };
    const first = calculatePlanCycleOverview(input);
    const second = calculatePlanCycleOverview(input);
    expect(second).toEqual(first);
    expect(first.plannedWorkoutCount).toBe(8);
    expect(first.completedWorkoutCount).toBe(1);
    expect(first.completionRate).toBe(0.125);
    expect(first.estimatedCalories).toBeGreaterThan(0);
  });
});
