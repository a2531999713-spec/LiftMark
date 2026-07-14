import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import type {
  SystemTrainingScheme,
  SystemTrainingSchemeEquipment,
} from '@/domain/plan/systemSchemes';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';

export type SystemPlanGoalFilter = 'all' | PlanTemplate['goal'];
export type SystemPlanFrequencyFilter = 'all' | '2' | '3' | '4' | 'other';
export type SystemPlanLevelFilter = 'all' | 'beginner' | 'intermediate' | 'general';
export type SystemPlanEquipmentFilter = 'all' | SystemTrainingSchemeEquipment;

export type SystemPlanLibraryFilters = {
  equipment: SystemPlanEquipmentFilter;
  frequency: SystemPlanFrequencyFilter;
  goal: SystemPlanGoalFilter;
  level: SystemPlanLevelFilter;
  query: string;
};

export const defaultSystemPlanLibraryFilters: SystemPlanLibraryFilters = {
  equipment: 'all',
  frequency: 'all',
  goal: 'all',
  level: 'all',
  query: '',
};

function matchesFrequency(scheme: SystemTrainingScheme, filter: SystemPlanFrequencyFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'other') return ![2, 3, 4].includes(scheme.frequencyPerWeek);
  return scheme.frequencyPerWeek === Number(filter);
}

export function filterSystemPlanLibrary(
  schemes: SystemTrainingScheme[],
  filters: SystemPlanLibraryFilters,
): SystemTrainingScheme[] {
  const query = filters.query.trim().toLocaleLowerCase('zh-CN');
  return schemes.filter((scheme) => {
    if (filters.goal !== 'all' && scheme.goal !== filters.goal) return false;
    if (filters.level !== 'all' && scheme.level !== (filters.level === 'general' ? 'all' : filters.level)) return false;
    if (filters.equipment !== 'all' && scheme.equipment !== filters.equipment) return false;
    if (!matchesFrequency(scheme, filters.frequency)) return false;
    if (!query) return true;
    return [scheme.title, scheme.subtitle, scheme.description, ...scheme.tags]
      .join(' ')
      .toLocaleLowerCase('zh-CN')
      .includes(query);
  });
}

export function sortSystemPlanLibrary(
  schemes: SystemTrainingScheme[],
  catalogOrder: readonly string[],
  recommendedSchemeIds: readonly string[] = [],
): SystemTrainingScheme[] {
  const recommendedOrder = new Map(recommendedSchemeIds.map((id, index) => [id, index]));
  const catalogIndex = new Map(catalogOrder.map((id, index) => [id, index]));
  return [...schemes].sort((left, right) => {
    const leftRecommended = recommendedOrder.get(left.id);
    const rightRecommended = recommendedOrder.get(right.id);
    if (leftRecommended !== undefined || rightRecommended !== undefined) {
      if (leftRecommended === undefined) return 1;
      if (rightRecommended === undefined) return -1;
      if (leftRecommended !== rightRecommended) return leftRecommended - rightRecommended;
    }
    if (left.isAvailable !== right.isAvailable) return left.isAvailable ? -1 : 1;
    return (catalogIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
      (catalogIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER);
  });
}

export type SystemSchemeCatalogIssueCode =
  | 'duplicate_scheme_id'
  | 'missing_template_id'
  | 'missing_template'
  | 'missing_phase'
  | 'missing_day'
  | 'missing_plan_exercise'
  | 'missing_exercise';

export type SystemSchemeCatalogIssue = {
  code: SystemSchemeCatalogIssueCode;
  message: string;
  schemeId: string;
  templatePlanId?: string;
};

export type SystemSchemeCatalogSnapshot = {
  days: PlanDay[];
  exerciseIds: ReadonlySet<string>;
  phases: PlanPhase[];
  planExercises: PlanExercise[];
  templates: PlanTemplate[];
};

export function validateSystemSchemeCatalog(
  schemes: SystemTrainingScheme[] = listSystemTrainingSchemes(),
  snapshot?: SystemSchemeCatalogSnapshot,
): SystemSchemeCatalogIssue[] {
  const issues: SystemSchemeCatalogIssue[] = [];
  const seen = new Set<string>();
  for (const scheme of schemes) {
    if (seen.has(scheme.id)) {
      issues.push({ code: 'duplicate_scheme_id', message: '系统方案 ID 重复。', schemeId: scheme.id });
    }
    seen.add(scheme.id);
    if (!scheme.templatePlanId) {
      issues.push({ code: 'missing_template_id', message: '系统方案没有关联模板。', schemeId: scheme.id });
      continue;
    }
    if (!snapshot) continue;
    const templatePlanId = scheme.templatePlanId;
    if (!snapshot.templates.some((template) => template.id === templatePlanId)) {
      issues.push({ code: 'missing_template', message: '关联的系统模板不存在。', schemeId: scheme.id, templatePlanId });
      continue;
    }
    if (!snapshot.phases.some((phase) => phase.planId === templatePlanId)) {
      issues.push({ code: 'missing_phase', message: '系统模板没有训练阶段。', schemeId: scheme.id, templatePlanId });
    }
    const days = snapshot.days.filter((day) => day.planId === templatePlanId);
    if (days.length === 0) {
      issues.push({ code: 'missing_day', message: '系统模板没有训练日。', schemeId: scheme.id, templatePlanId });
      continue;
    }
    const dayIds = new Set(days.map((day) => day.id));
    const prescriptions = snapshot.planExercises.filter((exercise) => dayIds.has(exercise.planDayId));
    if (prescriptions.length === 0) {
      issues.push({ code: 'missing_plan_exercise', message: '系统模板没有动作处方。', schemeId: scheme.id, templatePlanId });
      continue;
    }
    if (prescriptions.some((prescription) => !snapshot.exerciseIds.has(prescription.exerciseId))) {
      issues.push({ code: 'missing_exercise', message: '系统模板引用了不存在的动作。', schemeId: scheme.id, templatePlanId });
    }
  }
  return issues;
}
