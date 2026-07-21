import { describe, expect, it, jest } from '@jest/globals';

import { finishWorkoutSession } from '@/features/workout-session/application/finishWorkoutSession.usecase';
import { WorkoutWriteCoordinator } from '@/features/workout-session/services/workoutWriteCoordinator.service';

describe.each([
  ['A', 15],
  ['B', 64],
  ['C', 200],
] as [string, number][])('workout write performance scenario %s', (_name, setCount) => {
  it(`keeps ${setCount} sets bounded by current dirty-set count`, async () => {
    const batchWriter = jest.fn(async (patches) => patches as never);
    const completionInputs: { patches: unknown[] }[] = [];
    const completeSessionAtomic = jest.fn(async (input: { patches: unknown[] }) => {
      completionInputs.push(input);
      return { session: {}, sets: [] };
    });
    const coordinator = new WorkoutWriteCoordinator(batchWriter);

    for (let index = 0; index < setCount; index += 1) {
      const setId = `set-${index}`;
      coordinator.schedulePatch(setId, { actualWeight: 40 });
      coordinator.schedulePatch(setId, { actualWeight: 42.5 });
      coordinator.schedulePatch(setId, { actualReps: 8 });
      coordinator.schedulePatch(setId, { notes: 'ok' });
      coordinator.schedulePatch(setId, { completed: true });
    }

    await finishWorkoutSession({
      cancelDebounceTimers: () => undefined,
      coordinator,
      repository: { completeSessionAtomic } as never,
      sessionId: 'session-performance',
    });

    expect(batchWriter).not.toHaveBeenCalled();
    expect(completeSessionAtomic).toHaveBeenCalledTimes(1);
    expect(completionInputs[0]?.patches).toHaveLength(setCount);
  });
});
