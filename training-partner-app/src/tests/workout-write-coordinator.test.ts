import { describe, expect, it, jest } from '@jest/globals';

import { WorkoutWriteCoordinator } from '@/features/workout-session/services/workoutWriteCoordinator.service';

describe('WorkoutWriteCoordinator', () => {
  it('merges weight, reps, RPE and notes into one final patch', async () => {
    const writer = jest.fn(async (patches) => patches as never);
    const coordinator = new WorkoutWriteCoordinator(writer);
    coordinator.schedulePatch('set-a', { actualWeight: 60 });
    coordinator.schedulePatch('set-a', { actualReps: 8 });
    coordinator.schedulePatch('set-a', { notes: 'stable' });
    coordinator.schedulePatch('set-a', { rpe: 8 });

    await coordinator.flushSession();

    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith([{
      actualReps: 8,
      actualWeight: 60,
      id: 'set-a',
      notes: 'stable',
      rpe: 8,
    }]);
  });

  it('allows at most one merged next patch while a write is active', async () => {
    let release: (() => void) | undefined;
    const firstWrite = new Promise<void>((resolve) => { release = resolve; });
    const batches: unknown[][] = [];
    const coordinator = new WorkoutWriteCoordinator(async (patches) => {
      batches.push(patches);
      if (batches.length === 1) await firstWrite;
      return patches as never;
    });
    coordinator.schedulePatch('set-a', { actualWeight: 1 });
    const flush = coordinator.flushSession();
    await Promise.resolve();
    for (let value = 2; value <= 100; value += 1) {
      coordinator.schedulePatch('set-a', { actualWeight: value });
    }
    release?.();
    await flush;

    expect(batches).toHaveLength(2);
    expect(batches[1]).toEqual([{ actualWeight: 100, id: 'set-a' }]);
  });

  it('retains failed patches and succeeds on retry', async () => {
    let attempt = 0;
    const coordinator = new WorkoutWriteCoordinator(async (patches) => {
      attempt += 1;
      if (attempt === 1) throw new Error('write failed');
      return patches as never;
    });
    coordinator.schedulePatch('set-a', { actualReps: 10 });

    await expect(coordinator.flushSession()).rejects.toThrow('write failed');
    expect(coordinator.getDiagnostics().pendingPatchCount).toBe(1);
    await coordinator.flushSession();
    expect(attempt).toBe(2);
    expect(coordinator.getDiagnostics().pendingPatchCount).toBe(0);
  });

  it('batches 500 events across 200 sets into one bounded write', async () => {
    const writer = jest.fn(async (patches) => patches as never);
    const coordinator = new WorkoutWriteCoordinator(writer);
    for (let index = 0; index < 500; index += 1) {
      coordinator.schedulePatch(`set-${index % 200}`, { actualWeight: index });
    }
    await coordinator.flushSession();
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer.mock.calls[0][0]).toHaveLength(200);
  });

  it('rejects new edits while completion owns the coordinator', () => {
    const coordinator = new WorkoutWriteCoordinator(async (patches) => patches as never);
    coordinator.freeze();
    expect(() => coordinator.schedulePatch('set-a', { actualWeight: 1 })).toThrow('frozen');
  });
});
