import type { PlanRepository } from '@/data/repositories/planRepository';
import type { Group } from '@/domain/group/group.types';
import type { PlanPhase, PlanTemplate, TodayPlanResult, Weekday } from '@/domain/plan/plan.types';
import type { RecoveryMode } from '@/domain/plan/plan.service';

export async function resolveTodayTraining(input: {
  group: Group;
  phase: PlanPhase | null;
  plan: PlanTemplate;
  recoveryMode: RecoveryMode;
  repository: PlanRepository;
  week: number;
  weekday: Weekday;
}): Promise<TodayPlanResult> {
  return input.repository.getTodayPlan({
    currentWeek: input.week,
    fridayEnabled: true,
    groupId: input.group.id,
    phaseType: input.phase?.type ?? input.group.currentPhaseType,
    planId: input.plan.id,
    recoveryMode: input.recoveryMode,
    weekday: input.weekday,
  });
}
