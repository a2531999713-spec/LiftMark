import type { Exercise, ExerciseAlternative } from '@/domain/exercise/exercise.types';
import { createId } from '@/domain/common/ids';
import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import type { ExerciseRepository } from '@/data/repositories/exerciseRepository';
import type { PlanRepository } from '@/data/repositories/planRepository';

export const LIFTMARK_PLAN_SCHEMA_VERSION = 1;

export type LiftMarkPlanManifest = {
  app: 'LiftMark';
  format: 'liftmark-plan';
  schemaVersion: 1;
  exportedAt: string;
};

export type ProgressionRuleExport = {
  id: string;
  name: string;
  description?: string;
};

export type LiftMarkPlanFile = LiftMarkPlanManifest & {
  plan: {
    template: PlanTemplate;
    phases: PlanPhase[];
    days: PlanDay[];
    exercises: PlanExercise[];
  };
  exercises: Exercise[];
  alternatives: ExerciseAlternative[];
  progressionRules: ProgressionRuleExport[];
};

export type PlanFileRepositories = {
  planRepository: Pick<
    PlanRepository,
    'getPlanById' | 'listPlanPhases' | 'listPlanDays' | 'listPlanExercises'
  >;
  exerciseRepository: Pick<ExerciseRepository, 'listExercisesByIds' | 'listAlternatives'>;
};

export class PlanFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlanFileError';
  }
}

export function serializePlanFile(payload: LiftMarkPlanFile): string {
  return JSON.stringify(payload, null, 2);
}

export function parsePlanFile(json: string): LiftMarkPlanFile {
  let payload: unknown;

  try {
    payload = JSON.parse(json);
  } catch {
    throw new PlanFileError('计划文件不是有效 JSON。');
  }

  return validatePlanFile(payload);
}

function parseReps(reps: unknown): { repMin: number; repMax: number } {
  if (typeof reps === 'number') return { repMin: reps, repMax: reps };
  const match = String(reps).match(/(\d+)(?:\s*[-~]\s*(\d+))?/);
  if (!match) return { repMin: 10, repMax: 10 };
  const min = parseInt(match[1], 10);
  const max = match[2] ? parseInt(match[2], 10) : min;
  return { repMin: min, repMax: max };
}

function normalizePlanExercises(rawExercises: unknown[], dayMap: Map<string, string>): PlanExercise[] {
  if (!Array.isArray(rawExercises)) return [];

  const exerciseNameMap = new Map<string, string>();
  let idx = 0;

  return rawExercises.map((ex: any) => {
    const name = ex.name || ex.exerciseName || `动作${++idx}`;
    if (!exerciseNameMap.has(name)) {
      exerciseNameMap.set(name, `ex_imported_${exerciseNameMap.size + 1}`);
    }
    const exerciseId = exerciseNameMap.get(name)!;
    const dayId = ex.planDayId || ex.dayId || '';
    const mappedDayId = dayMap.get(dayId) || dayId;
    const { repMin, repMax } = parseReps(ex.reps);
    const priority = (ex.orderIndex ?? 1) <= 2 ? 'A' : 'B';

    return {
      id: ex.id || `pex_imported_${Math.random().toString(36).slice(2, 10)}`,
      planDayId: mappedDayId,
      exerciseId,
      priority,
      orderIndex: ex.orderIndex ?? 1,
      sets: ex.sets ?? 3,
      reps: Math.round((repMin + repMax) / 2),
      repMin,
      repMax,
      intensityType: 'manual',
      percent1RM: undefined,
      rpeTarget: undefined,
      rirTarget: undefined,
      fixedWeight: undefined,
      referenceLift: 'none',
      restSeconds: undefined,
      progressionRuleId: undefined,
      notes: ex.notes || undefined,
    };
  });
}

function normalizeExercises(rawPlanExercises: PlanExercise[]): { id: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const ex of rawPlanExercises) {
    if (!seen.has(ex.exerciseId)) {
      seen.set(ex.exerciseId, ex.exerciseId);
    }
  }
  return Array.from(seen.entries()).map(([id, name]) => ({
    id,
    name,
    source: 'imported',
    category: 'unknown',
    movement_pattern: 'unknown',
    target_muscle: 'unknown',
    secondary_muscle: null,
    equipment: 'unknown',
    difficulty: null,
    notes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as any));
}

function normalizeIntensityType(exercise: PlanExercise): PlanExercise {
  return {
    ...exercise,
    intensityType: exercise.percent1RM ? 'percent_1rm' : exercise.fixedWeight ? 'fixed' : 'manual',
  };
}

export function validatePlanFile(payload: unknown): LiftMarkPlanFile {
  if (!payload || typeof payload !== 'object') {
    throw new PlanFileError('计划文件内容为空或格式错误。');
  }

  const candidate = payload as any;

  if (candidate.app !== 'LiftMark' || candidate.format !== 'liftmark-plan') {
    throw new PlanFileError('这不是 LiftMark 计划文件。');
  }

  if (candidate.schemaVersion !== LIFTMARK_PLAN_SCHEMA_VERSION) {
    throw new PlanFileError(
      `不支持的计划文件版本：${String(candidate.schemaVersion ?? '未知')}。`,
    );
  }

  if (!candidate.plan?.template || !Array.isArray(candidate.plan.phases)) {
    throw new PlanFileError('计划文件缺少 PlanTemplate 或 PlanPhase。');
  }

  if (!Array.isArray(candidate.plan.days)) {
    throw new PlanFileError('计划文件缺少 PlanDay。');
  }

  // 兼容两种格式：标准格式和 Codex 生成的自定义格式
  let planExercises: PlanExercise[];

  if (Array.isArray(candidate.plan.exercises) && candidate.plan.exercises.length > 0) {
    const firstEx = candidate.plan.exercises[0];
    // 检查是否是标准格式（有 planDayId 和 exerciseId）
    if (firstEx.planDayId && firstEx.exerciseId) {
      planExercises = candidate.plan.exercises;
    } else {
      // Codex 自定义格式：需要转换
      const dayMap = new Map<string, string>(candidate.plan.days.map((d: any) => [d.id, d.id]));
      planExercises = normalizePlanExercises(candidate.plan.exercises, dayMap);
    }
  } else {
    planExercises = [];
  }

  // 兼容缺失的 exercises 和 alternatives 数组
  const exercises = Array.isArray(candidate.exercises)
    ? candidate.exercises
    : normalizeExercises(planExercises);

  const alternatives = Array.isArray(candidate.alternatives)
    ? candidate.alternatives
    : [];

  return {
    app: 'LiftMark',
    format: 'liftmark-plan',
    schemaVersion: LIFTMARK_PLAN_SCHEMA_VERSION,
    exportedAt: candidate.exportedAt || new Date().toISOString(),
    plan: {
      template: candidate.plan.template,
      phases: candidate.plan.phases,
      days: candidate.plan.days,
      exercises: planExercises,
    },
    exercises,
    alternatives,
    progressionRules: candidate.progressionRules || [],
  };
}

export async function createCurrentPlanFile(
  repositories: PlanFileRepositories,
  planId: string,
): Promise<LiftMarkPlanFile> {
  const template = await repositories.planRepository.getPlanById(planId);

  if (!template) {
    throw new PlanFileError('当前计划不存在，无法导出。');
  }

  const phases = await repositories.planRepository.listPlanPhases(planId);
  const days = await repositories.planRepository.listPlanDays(planId);
  const planExercises = (
    await Promise.all(days.map((day) => repositories.planRepository.listPlanExercises(day.id)))
  ).flat();
  const exerciseIds = [...new Set(planExercises.map((exercise) => exercise.exerciseId))];
  const exercises = await repositories.exerciseRepository.listExercisesByIds(exerciseIds);
  const alternatives = (
    await Promise.all(exerciseIds.map((exerciseId) => repositories.exerciseRepository.listAlternatives(exerciseId)))
  ).flat();

  return {
    app: 'LiftMark',
    format: 'liftmark-plan',
    schemaVersion: LIFTMARK_PLAN_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    plan: {
      template,
      phases,
      days,
      exercises: planExercises.map(normalizeIntensityType),
    },
    exercises,
    alternatives,
    progressionRules: [],
  };
}

export function createImportedPlanDraft(payload: LiftMarkPlanFile): LiftMarkPlanFile {
  const file = validatePlanFile(payload);
  const now = new Date().toISOString();
  const planId = createId('plan_imported');
  const phaseIds = new Map(file.plan.phases.map((phase) => [phase.id, createId('phase_imported')]));
  const dayIds = new Map(file.plan.days.map((day) => [day.id, createId('day_imported')]));
  const exerciseIds = new Map(file.exercises.map((exercise) => [exercise.id, createId('exercise_imported')]));
  const alternativeIds = new Map(
    file.alternatives.map((alternative) => [alternative.id, createId('alternative_imported')]),
  );
  const planExerciseIds = new Map(
    file.plan.exercises.map((exercise) => [exercise.id, createId('plan_exercise_imported')]),
  );

  return {
    ...file,
    exportedAt: now,
    plan: {
      template: {
        ...file.plan.template,
        id: planId,
        name: `${file.plan.template.name}（导入）`,
        originSchemeId: undefined,
        visibility: 'private',
        source: 'imported',
        createdAt: now,
        updatedAt: now,
      },
      phases: file.plan.phases.map((phase) => ({
        ...phase,
        id: phaseIds.get(phase.id) ?? createId('phase_imported'),
        planId,
      })),
      days: file.plan.days.map((day) => ({
        ...day,
        id: dayIds.get(day.id) ?? createId('day_imported'),
        planId,
        phaseId: phaseIds.get(day.phaseId) ?? day.phaseId,
      })),
      exercises: file.plan.exercises.map((exercise) => ({
        ...normalizeIntensityType(exercise),
        id: planExerciseIds.get(exercise.id) ?? createId('plan_exercise_imported'),
        planDayId: dayIds.get(exercise.planDayId) ?? exercise.planDayId,
        exerciseId: exerciseIds.get(exercise.exerciseId) ?? exercise.exerciseId,
      })),
    },
    exercises: file.exercises.map((exercise) => ({
      ...exercise,
      id: exerciseIds.get(exercise.id) ?? createId('exercise_imported'),
      createdAt: now,
      updatedAt: now,
    })),
    alternatives: file.alternatives.map((alternative) => ({
      ...alternative,
      id: alternativeIds.get(alternative.id) ?? createId('alternative_imported'),
      exerciseId: exerciseIds.get(alternative.exerciseId) ?? alternative.exerciseId,
      alternativeExerciseId:
        exerciseIds.get(alternative.alternativeExerciseId) ?? alternative.alternativeExerciseId,
    })),
  };
}
