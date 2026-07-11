import { estimateTrainingCalories, getTrainingIntensityLevel } from '../report/trainingReport.service';
import type { PlanCycle, PlanCycleOverview, PlanCycleSessionStats, PlanCycleStatus } from './plan.types';

export function calculateCycleCompletionRate(plannedWorkoutCount: number, completedWorkoutCount: number): number {
  if (plannedWorkoutCount <= 0) return 0;
  return Math.min(1, Math.max(0, completedWorkoutCount / plannedWorkoutCount));
}

export function isPlanCycleReadyToComplete(cycle: PlanCycle, currentWeek: number, completedWorkoutCount: number): boolean {
  if (cycle.status !== 'active') return false;
  return currentWeek >= cycle.plannedWeeks || completedWorkoutCount > 0 && new Date().toISOString().slice(0, 10) > (cycle.endDate ?? '9999-12-31');
}

export function canCompletePlanCycle(status: PlanCycleStatus): boolean {
  return status === 'active' || status === 'draft';
}

export function canArchivePlanCycle(status: PlanCycleStatus): boolean {
  return status === 'completed' || status === 'archived';
}

export function getPlanCycleStatusLabel(status: PlanCycleStatus): string {
  const labels: Record<PlanCycleStatus, string> = {
    abandoned: '已放弃',
    active: '进行中',
    archived: '已归档',
    completed: '已完成',
    draft: '未开始',
  };
  return labels[status];
}

function getInclusiveDayCount(fromDate: string, toDate: string): number {
  const start = new Date(`${fromDate}T12:00:00`).getTime();
  const end = new Date(`${toDate}T12:00:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export function calculatePlanCycleOverview(input: {
  cycle: PlanCycle;
  frequencyPerWeek: number;
  planName: string;
  sessions: PlanCycleSessionStats[];
  today?: string;
}): PlanCycleOverview {
  const plannedWorkoutCount = Math.max(0, input.frequencyPerWeek) * Math.max(1, input.cycle.plannedWeeks);
  const completedWorkoutCount = input.sessions.length;
  const totals = input.sessions.reduce(
    (acc, session) => {
      const totalSets = session.hasReport ? session.reportTotalSets ?? session.completedSets : session.completedSets;
      const totalReps = session.hasReport ? session.reportTotalReps ?? session.totalReps : session.totalReps;
      const totalVolume = session.hasReport ? session.reportTotalVolume ?? session.totalVolume : session.totalVolume;
      const intensity = getTrainingIntensityLevel({
        durationSeconds: session.durationSeconds,
        totalSets,
        totalVolume,
      });
      const fallbackCalories = estimateTrainingCalories({
        durationSeconds: session.durationSeconds,
        intensity,
        participantBodyweightsKg: session.bodyweightsKg,
      });
      acc.totalSets += totalSets;
      acc.totalReps += totalReps;
      acc.totalVolume += totalVolume;
      acc.totalDurationSeconds += session.durationSeconds;
      acc.estimatedCalories += session.reportEstimatedCalories ?? fallbackCalories.estimatedCalories;
      if (session.hasReport) acc.reportCount += 1;
      return acc;
    },
    { estimatedCalories: 0, reportCount: 0, totalDurationSeconds: 0, totalReps: 0, totalSets: 0, totalVolume: 0 },
  );
  const endDate = input.cycle.actualEndDate
    ?? input.cycle.completedAt?.slice(0, 10)
    ?? input.cycle.archivedAt?.slice(0, 10)
    ?? input.today
    ?? new Date().toISOString().slice(0, 10);
  return {
    actualDurationDays: getInclusiveDayCount(input.cycle.actualStartDate ?? input.cycle.startDate, endDate),
    completedWorkoutCount,
    completionRate: calculateCycleCompletionRate(plannedWorkoutCount, completedWorkoutCount),
    cycle: input.cycle,
    estimatedCalories: totals.estimatedCalories,
    planName: input.planName,
    plannedWorkoutCount,
    reportCount: totals.reportCount,
    // There is no explicit skipped-session event in the current data model.
    // A plan day without a completed session must not be reported as "skipped".
    skippedWorkoutCount: 0,
    totalDurationSeconds: totals.totalDurationSeconds,
    totalReps: totals.totalReps,
    totalSets: totals.totalSets,
    totalVolume: totals.totalVolume,
  };
}
