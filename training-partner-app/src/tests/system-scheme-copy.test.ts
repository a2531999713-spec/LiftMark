import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { Group } from '@/domain/group/group.types';
import type { PlanTemplate } from '@/domain/plan/plan.types';
import { listSystemTrainingSchemes } from '@/domain/plan/systemSchemes';
import {
  copyAndActivateSystemScheme,
  createSystemSchemeCopyActionLock,
  findExistingSystemSchemeCopy,
} from '@/features/plan-library/systemSchemeCopyService';
import { activateTrainingPlanForGroup } from '@/services/trainingMainlineService';

jest.mock('@/services/trainingMainlineService', () => ({ activateTrainingPlanForGroup: jest.fn() }));

const scheme = listSystemTrainingSchemes()[0];
const plan: PlanTemplate = {
  id: 'user-copy', name: '我的新手计划', visibility: 'private', goal: 'general', durationWeeks: 8,
  frequencyPerWeek: 3, source: 'system_copy', originSchemeId: scheme.id, version: 1,
  createdAt: '2026-07-15T00:00:00.000Z', updatedAt: '2026-07-15T00:00:00.000Z',
};
const group = { id: 'group-1' } as Group;

describe('system scheme copy behavior', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(activateTrainingPlanForGroup).mockResolvedValue({ group, phaseType: 'strength' });
  });

  it('finds an existing copy by originSchemeId', () => {
    expect(findExistingSystemSchemeCopy([plan], scheme.id)).toBe(plan);
  });

  it('reuses and activates an existing copy without creating a duplicate', async () => {
    const copy = jest.fn<() => Promise<PlanTemplate>>();
    const result = await copyAndActivateSystemScheme({ planRepository: { copySystemSchemeToUserPlan: copy } } as never, {
      group, scheme, userPlans: [plan],
    });
    expect(copy).not.toHaveBeenCalled();
    expect(result).toEqual({ group, plan, reusedExisting: true });
    expect(activateTrainingPlanForGroup).toHaveBeenCalledWith(expect.anything(), { group, plan });
  });

  it('only creates another copy after allowDuplicate is explicit', async () => {
    const duplicate = { ...plan, id: 'user-copy-2' };
    const copy = jest.fn<() => Promise<PlanTemplate>>(async () => duplicate);
    const result = await copyAndActivateSystemScheme({ planRepository: { copySystemSchemeToUserPlan: copy } } as never, {
      allowDuplicate: true, group, scheme, userPlans: [plan],
    });
    expect(copy).toHaveBeenCalledTimes(1);
    expect(result.plan.id).toBe('user-copy-2');
  });

  it('prevents double taps from running two copy actions', async () => {
    const lock = createSystemSchemeCopyActionLock();
    let release!: () => void;
    const task = jest.fn(() => new Promise<string>((resolve) => { release = () => resolve('done'); }));
    const first = lock.run(task);
    const second = lock.run(task);
    expect(task).toHaveBeenCalledTimes(1);
    await expect(second).resolves.toBeUndefined();
    release();
    await expect(first).resolves.toBe('done');
  });
});
