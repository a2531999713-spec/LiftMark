import { describe, expect, it, jest } from '@jest/globals';

import type { Exercise } from '@/domain/exercise/exercise.types';
import type { PlanDay, PlanExercise, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import {
  createImportedPlanDraft,
  parsePlanFile,
  serializePlanFile,
  type LiftMarkPlanFile,
} from '@/services/planFileService';

let mockIdCounter = 0;
jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_${(mockIdCounter += 1)}`,
}));

const template: PlanTemplate = {
  id: 'plan_original',
  name: '测试计划',
  visibility: 'private',
  goal: 'strength',
  durationWeeks: 1,
  frequencyPerWeek: 1,
  source: 'user',
  version: 1,
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

const phase: PlanPhase = {
  id: 'phase_original',
  planId: template.id,
  name: '测试阶段',
  type: 'strength',
  startWeek: 1,
  endWeek: 1,
  orderIndex: 1,
};

const day: PlanDay = {
  id: 'day_original',
  planId: template.id,
  phaseId: phase.id,
  week: 1,
  weekday: 1,
  title: '测试日',
  focus: 'bench',
};

const planExercise: PlanExercise = {
  id: 'plan_exercise_original',
  planDayId: day.id,
  exerciseId: 'exercise_original',
  priority: 'A',
  orderIndex: 1,
  sets: 3,
  reps: 5,
  intensityType: 'percent_1rm',
  percent1RM: 0.75,
  referenceLift: 'bench',
};

const exercise: Exercise = {
  id: 'exercise_original',
  name: '卧推',
  category: 'chest',
  movementPattern: 'horizontal_push',
  targetMuscle: '胸',
  equipment: 'barbell',
  createdAt: '2026-06-01T00:00:00.000Z',
  updatedAt: '2026-06-01T00:00:00.000Z',
};

function createPlanFile(): LiftMarkPlanFile {
  return {
    app: 'LiftMark',
    format: 'liftmark-plan',
    schemaVersion: 1,
    exportedAt: '2026-06-01T00:00:00.000Z',
    plan: {
      template,
      phases: [phase],
      days: [day],
      exercises: [planExercise],
    },
    exercises: [exercise],
    alternatives: [],
    progressionRules: [],
  };
}

describe('LiftMark plan file service', () => {
  it('serializes and parses .liftmark JSON payloads', () => {
    const parsed = parsePlanFile(serializePlanFile(createPlanFile()));

    expect(parsed.app).toBe('LiftMark');
    expect(parsed.format).toBe('liftmark-plan');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('rejects incompatible schema versions with a Chinese error', () => {
    expect(() =>
      parsePlanFile(JSON.stringify({ ...createPlanFile(), schemaVersion: 99 })),
    ).toThrow('不支持的计划文件版本');
  });

  it('creates new local ids for imported plans', () => {
    const draft = createImportedPlanDraft(createPlanFile());

    expect(draft.plan.template.id).not.toBe(template.id);
    expect(draft.plan.template.source).toBe('imported');
    expect(draft.plan.phases[0].planId).toBe(draft.plan.template.id);
    expect(draft.plan.days[0].phaseId).toBe(draft.plan.phases[0].id);
    expect(draft.plan.exercises[0].planDayId).toBe(draft.plan.days[0].id);
    expect(draft.plan.exercises[0].exerciseId).toBe(draft.exercises[0].id);
  });
});
