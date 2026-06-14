import { createId, type ID } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';

import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from './plan.types';

export type UserPlanCopyDraft = {
  template: PlanTemplate;
  phases: PlanPhase[];
  days: PlanDay[];
  exercises: PlanExercise[];
};

export type CreateUserPlanCopyInput = {
  sourceTemplate: PlanTemplate;
  phases: PlanPhase[];
  days: PlanDay[];
  exercises: PlanExercise[];
  name: string;
  originSchemeId: ID;
  now?: string;
};

export function createUserPlanCopyDraft(input: CreateUserPlanCopyInput): UserPlanCopyDraft {
  const timestamp = input.now ?? nowIso();
  const planId = createId('plan_user');
  const phaseIdMap = new Map(input.phases.map((phase) => [phase.id, createId('phase_user')]));
  const dayIdMap = new Map(input.days.map((day) => [day.id, createId('day_user')]));

  return {
    template: {
      ...input.sourceTemplate,
      id: planId,
      name: input.name.trim() || `${input.sourceTemplate.name}（我的）`,
      visibility: 'private',
      source: 'system_copy',
      originSchemeId: input.originSchemeId,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    phases: input.phases.map((phase) => ({
      ...phase,
      id: phaseIdMap.get(phase.id) ?? createId('phase_user'),
      planId,
    })),
    days: input.days.map((day) => ({
      ...day,
      id: dayIdMap.get(day.id) ?? createId('day_user'),
      planId,
      phaseId: phaseIdMap.get(day.phaseId) ?? day.phaseId,
    })),
    exercises: input.exercises.map((exercise) => ({
      ...exercise,
      id: createId('plan_exercise_user'),
      planDayId: dayIdMap.get(exercise.planDayId) ?? exercise.planDayId,
    })),
  };
}
