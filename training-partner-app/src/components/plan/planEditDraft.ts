import type { UpdateUserPlanInput } from '@/data/repositories/planRepository';
import type { PlanDay, PlanExercise, PlanTemplate, Weekday } from '@/domain/plan/plan.types';

import type { PlanDayDraft, PlanEditDraft, PlanExerciseDraft } from './planEditTypes';

export function createPlanDraftId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyPlanDayDraft(index: number): PlanDayDraft {
  return {
    exercises: [],
    focus: index === 0 ? '全身力量' : '训练重点',
    id: createPlanDraftId('day'),
    title: `Day ${index + 1}`,
    week: 1,
    weekday: Math.min(7, index + 1) as Weekday,
  };
}

export function createPlanExerciseDraft(exerciseId: string, index: number): PlanExerciseDraft {
  return {
    exerciseId,
    id: createPlanDraftId('plan_exercise'),
    orderIndex: index,
    priority: index === 0 ? 'A' : index <= 2 ? 'B' : 'C',
    reps: 8,
    sets: 3,
  };
}

export function buildPlanEditDraft(
  plan: PlanTemplate,
  days: PlanDay[],
  exerciseLists: PlanExercise[][],
): PlanEditDraft {
  return {
    days: days.map((day, index) => ({
      exercises: (exerciseLists[index] ?? []).map((exercise, exerciseIndex) => ({
        exerciseId: exercise.exerciseId,
        id: exercise.id,
        orderIndex: exerciseIndex,
        priority: exercise.priority,
        reps: exercise.reps ?? exercise.repMin ?? 8,
        sets: exercise.sets ?? 3,
      })),
      focus: day.focus,
      id: day.id,
      title: day.title,
      week: day.week,
      weekday: day.weekday,
    })),
    durationWeeks: plan.durationWeeks,
    frequencyPerWeek: plan.frequencyPerWeek,
    goal: plan.goal,
    name: plan.name,
  };
}

export function toUpdateUserPlanInput(planId: string, draft: PlanEditDraft): UpdateUserPlanInput {
  return {
    days: draft.days.map((day) => ({
      exercises: day.exercises.map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        priority: exercise.priority ?? (index === 0 ? 'A' : index <= 2 ? 'B' : 'C'),
        reps: Math.max(1, Math.round(exercise.reps)),
        sets: Math.max(1, Math.round(exercise.sets)),
      })),
      focus: day.focus,
      title: day.title,
      week: Math.max(1, Math.round(day.week)),
      weekday: Math.min(7, Math.max(1, Math.round(day.weekday))) as Weekday,
    })),
    durationWeeks: Math.max(1, Math.round(draft.durationWeeks)),
    frequencyPerWeek: Math.max(1, Math.round(draft.frequencyPerWeek)),
    goal: draft.goal,
    name: draft.name,
    planId,
  };
}
