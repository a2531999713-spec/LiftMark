import type { PlanEditDraft, PlanExerciseDraft } from './planEditTypes';
import { formatWeight, type WeightUnit } from '@/domain/preferences/user-preferences.types';

export type PlanEditorValidationError = {
  dayId: string;
  exerciseDraftId?: string;
  message: string;
};

export type PlanEditorValidationResult = {
  errors: PlanEditorValidationError[];
  isValid: boolean;
};

function exerciseLabel(index: number): string {
  return `动作 ${index + 1}`;
}

function isIntegerInRange(value: number | null | undefined, minimum: number, maximum: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isFiniteInRange(value: number | null | undefined, minimum: number, maximum: number): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}

export function isRangeRepMode(exercise: PlanExerciseDraft): boolean {
  return exercise.repMin !== null && exercise.repMin !== undefined;
}

export function formatPlanExercisePrescription(exercise: PlanExerciseDraft, weightUnit: WeightUnit = 'kg'): string {
  const reps = isRangeRepMode(exercise)
    ? `${exercise.repMin ?? '-'}-${exercise.repMax ?? '-'} 次`
    : `${exercise.reps ?? '-'} 次`;
  const intensity =
    exercise.intensityType === 'percent_1rm'
      ? `${Math.round((exercise.percent1RM ?? 0) * 100)}% 1RM`
      : exercise.intensityType === 'fixed'
        ? exercise.fixedWeight === null || exercise.fixedWeight === undefined
          ? `- ${weightUnit}`
          : formatWeight(exercise.fixedWeight, weightUnit)
        : '手动重量';
  return `${exercise.sets} 组 × ${reps} · ${intensity} · 休息 ${exercise.restSeconds ?? '-'} 秒`;
}

export function validatePlanEditorDraft(draft: PlanEditDraft): PlanEditorValidationResult {
  const errors: PlanEditorValidationError[] = [];

  if (!draft.name.trim()) {
    errors.push({ dayId: '', message: '请填写计划名称。' });
  }
  if (!isIntegerInRange(draft.durationWeeks, 1, 52)) {
    errors.push({ dayId: '', message: '计划周期需要在 1 到 52 周之间。' });
  }
  if (!isIntegerInRange(draft.frequencyPerWeek, 1, 7)) {
    errors.push({ dayId: '', message: '每周训练天数需要在 1 到 7 天之间。' });
  }
  if (draft.days.length === 0) {
    errors.push({ dayId: '', message: '至少需要一个训练日。' });
  }

  for (const [dayIndex, day] of draft.days.entries()) {
    const dayLabel = day.title.trim() || `训练日 ${dayIndex + 1}`;
    if (!day.exercises.length) {
      errors.push({ dayId: day.id, message: `“${dayLabel}”至少需要一个动作。` });
      continue;
    }

    const draftIds = new Set<string>();
    const orderIndexes = new Set<number>();
    for (const [exerciseIndex, exercise] of day.exercises.entries()) {
      const prefix = `“${dayLabel}”${exerciseLabel(exerciseIndex)}`;
      const base = { dayId: day.id, exerciseDraftId: exercise.id };
      if (!exercise.exerciseId) errors.push({ ...base, message: `${prefix}未选择训练动作。` });
      if (draftIds.has(exercise.id)) errors.push({ ...base, message: `${prefix}的草稿标识重复。` });
      draftIds.add(exercise.id);
      if (!Number.isInteger(exercise.orderIndex) || orderIndexes.has(exercise.orderIndex)) {
        errors.push({ ...base, message: `${prefix}的动作排序无效。` });
      }
      orderIndexes.add(exercise.orderIndex);
      if (!['A', 'B', 'C'].includes(exercise.priority)) {
        errors.push({ ...base, message: `${prefix}的优先级无效。` });
      }
      if (!isIntegerInRange(exercise.sets, 1, 20)) {
        errors.push({ ...base, message: `${prefix}组数需为 1 到 20。` });
      }
      if (isRangeRepMode(exercise)) {
        if (!isIntegerInRange(exercise.repMin, 1, 100) || !isIntegerInRange(exercise.repMax, 1, 100) || (exercise.repMax ?? 0) < (exercise.repMin ?? 0)) {
          errors.push({ ...base, message: `${prefix}次数范围需为 1 到 100，且最大次数不能小于最小次数。` });
        }
      } else if (!isIntegerInRange(exercise.reps, 1, 100)) {
        errors.push({ ...base, message: `${prefix}次数需为 1 到 100。` });
      }
      if (!isIntegerInRange(exercise.restSeconds, 0, 600)) {
        errors.push({ ...base, message: `${prefix}休息时间需为 0 到 600 秒。` });
      }
      if (exercise.intensityType === 'fixed' && !isFiniteInRange(exercise.fixedWeight, 0, Number.MAX_SAFE_INTEGER)) {
        errors.push({ ...base, message: `${prefix}固定重量必须是不小于 0 的数字。` });
      }
      if (exercise.intensityType === 'percent_1rm' && !isFiniteInRange(exercise.percent1RM, 0.01, 1)) {
        errors.push({ ...base, message: `${prefix}%1RM 需为 1 到 100。` });
      }
    }
  }

  return { errors, isValid: errors.length === 0 };
}
