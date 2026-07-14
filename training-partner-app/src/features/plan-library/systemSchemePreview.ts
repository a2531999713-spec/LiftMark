import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import type { SystemTrainingScheme } from '@/domain/plan/systemSchemes';

export type SystemSchemePreviewAvailability = 'ready' | 'metadata_only' | 'unavailable';

export type SystemSchemePreviewExercise = {
  name: string;
  prescription: PlanExercise;
  unresolved: boolean;
};

export type SystemSchemePreviewDay = {
  day: PlanDay;
  estimatedMinutes: { max: number; min: number };
  exercises: SystemSchemePreviewExercise[];
  totalSets: number;
};

export type SystemSchemePreviewWeek = {
  days: SystemSchemePreviewDay[];
  phaseName: string;
  week: number;
};

export type SystemSchemePreview = {
  availability: SystemSchemePreviewAvailability;
  fallbackMessage?: string;
  hasRepeatedWeeklyStructure: boolean;
  plan?: PlanTemplate;
  scheme: SystemTrainingScheme;
  weeks: SystemSchemePreviewWeek[];
};

export type SystemSchemePreviewRepositories = {
  exerciseRepository: {
    listExercisesByIds(ids: string[]): Promise<Exercise[]>;
  };
  planRepository: {
    getPlanById(planId: string): Promise<PlanTemplate | null>;
    listPlanDays(planId: string): Promise<PlanDay[]>;
    listPlanExercisesForDays(planDayIds: string[]): Promise<PlanExercise[]>;
    listPlanPhases(planId: string): Promise<PlanPhase[]>;
  };
};

function roundDownFive(value: number): number {
  return Math.max(5, Math.floor(value / 5) * 5);
}

function roundUpFive(value: number): number {
  return Math.max(10, Math.ceil(value / 5) * 5);
}

export function estimateTrainingDayMinutes(exercises: PlanExercise[]): { max: number; min: number } {
  let minSeconds = 6 * 60;
  let maxSeconds = 9 * 60;
  for (const exercise of exercises) {
    const sets = Math.max(1, exercise.sets ?? 1);
    const rest = Math.max(30, exercise.restSeconds ?? 90);
    minSeconds += sets * 35 + Math.max(0, sets - 1) * rest + 45;
    maxSeconds += sets * 55 + sets * rest + 90;
  }
  return {
    min: roundDownFive(minSeconds / 60),
    max: roundUpFive(maxSeconds / 60),
  };
}

export function formatPlanExercisePrescription(exercise: PlanExercise): string {
  const sets = exercise.sets ?? 1;
  if (exercise.repMin && exercise.repMax) return `${sets} × ${exercise.repMin}-${exercise.repMax}`;
  return `${sets} × ${exercise.reps ?? exercise.repMin ?? exercise.repMax ?? '按状态'}`;
}

export function formatPlanExerciseIntensity(exercise: PlanExercise): string {
  if (exercise.intensityType === 'percent_1rm' && exercise.percent1RM) {
    return `${Math.round(exercise.percent1RM * 100)}% 1RM`;
  }
  if (exercise.intensityType === 'fixed' && exercise.fixedWeight) return `${exercise.fixedWeight} kg`;
  if (exercise.intensityType === 'rpe' && exercise.rpeTarget) return `RPE ${exercise.rpeTarget}`;
  if (exercise.intensityType === 'rir' && exercise.rirTarget !== undefined) return `RIR ${exercise.rirTarget}`;
  return '按状态选重';
}

function weeklySignature(week: SystemSchemePreviewWeek): string {
  return week.days.map(({ day, exercises }) =>
    `${day.weekday}:${exercises.map(({ prescription }) =>
      [prescription.exerciseId, prescription.sets, prescription.reps, prescription.repMin, prescription.repMax].join(':')).join(',')}`,
  ).join('|');
}

export async function loadSystemSchemePreview(
  repositories: SystemSchemePreviewRepositories,
  scheme: SystemTrainingScheme,
): Promise<SystemSchemePreview> {
  if (!scheme.isAvailable || !scheme.templatePlanId) {
    return {
      availability: 'unavailable',
      fallbackMessage: '该方案仍在完善，暂时只能查看目录信息。',
      hasRepeatedWeeklyStructure: false,
      scheme,
      weeks: [],
    };
  }

  const plan = await repositories.planRepository.getPlanById(scheme.templatePlanId);
  if (!plan) {
    return {
      availability: 'metadata_only',
      fallbackMessage: '完整训练模板暂时不可用，你仍可查看方案说明。',
      hasRepeatedWeeklyStructure: false,
      scheme,
      weeks: [],
    };
  }

  const [phases, days] = await Promise.all([
    repositories.planRepository.listPlanPhases(plan.id),
    repositories.planRepository.listPlanDays(plan.id),
  ]);
  if (days.length === 0) {
    return {
      availability: 'metadata_only',
      fallbackMessage: '该模板暂时没有可预览的训练日。',
      hasRepeatedWeeklyStructure: false,
      plan,
      scheme,
      weeks: [],
    };
  }

  const prescriptions = await repositories.planRepository.listPlanExercisesForDays(days.map((day) => day.id));
  const exerciseIds = [...new Set(prescriptions.map((exercise) => exercise.exerciseId))];
  const exercises = await repositories.exerciseRepository.listExercisesByIds(exerciseIds);
  const exerciseMap = new Map(exercises.map((exercise) => [exercise.id, exercise]));
  const prescriptionsByDay = new Map<string, PlanExercise[]>();
  for (const prescription of prescriptions) {
    const current = prescriptionsByDay.get(prescription.planDayId) ?? [];
    current.push(prescription);
    prescriptionsByDay.set(prescription.planDayId, current);
  }

  const weekNumbers = [...new Set(days.map((day) => day.week))].sort((left, right) => left - right);
  const weeks = weekNumbers.map<SystemSchemePreviewWeek>((week) => {
    const weekDays = days.filter((day) => day.week === week).sort((left, right) => left.weekday - right.weekday);
    const phase = phases.find((item) => item.startWeek <= week && item.endWeek >= week);
    return {
      days: weekDays.map((day) => {
        const dayPrescriptions = (prescriptionsByDay.get(day.id) ?? []).sort(
          (left, right) => left.orderIndex - right.orderIndex,
        );
        return {
          day,
          estimatedMinutes: estimateTrainingDayMinutes(dayPrescriptions),
          exercises: dayPrescriptions.map((prescription) => ({
            name: exerciseMap.get(prescription.exerciseId)?.name ?? '未知动作',
            prescription,
            unresolved: !exerciseMap.has(prescription.exerciseId),
          })),
          totalSets: dayPrescriptions.reduce((sum, item) => sum + (item.sets ?? 0), 0),
        };
      }),
      phaseName: phase?.name ?? '训练周期',
      week,
    };
  });
  const firstSignature = weeks[0] ? weeklySignature(weeks[0]) : '';
  return {
    availability: prescriptions.length > 0 ? 'ready' : 'metadata_only',
    fallbackMessage: prescriptions.length > 0 ? undefined : '训练日已建立，但动作处方仍在完善。',
    hasRepeatedWeeklyStructure: weeks.length > 1 && weeks.every((week) => weeklySignature(week) === firstSignature),
    plan,
    scheme,
    weeks,
  };
}
