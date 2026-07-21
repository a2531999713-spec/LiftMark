import { describe, expect, it, jest } from '@jest/globals';

import { finishWorkoutSession } from '@/features/workout-session/application/finishWorkoutSession.usecase';
import { WorkoutWriteCoordinator } from '@/features/workout-session/services/workoutWriteCoordinator.service';

describe('finishWorkoutSession', () => {
  it('uses one atomic local completion and does not run post-workout tasks', async () => {
    const calls: string[] = [];
    const repository = {
      completeSessionAtomic: jest.fn(async () => {
        calls.push('complete');
        return { session: {}, sets: [] };
      }),
      generateTrainingReport: jest.fn(async () => { calls.push('report'); }),
    };
    const coordinator = new WorkoutWriteCoordinator(async () => {
      calls.push('write');
      return [];
    });
    coordinator.schedulePatch('set-a', { actualWeight: 42 });

    await finishWorkoutSession({
      cancelDebounceTimers: () => { calls.push('cancel'); },
      coordinator,
      repository: repository as never,
      sessionId: 'session-a',
    });

    expect(calls).toEqual(['cancel', 'complete']);
    expect(repository.completeSessionAtomic).toHaveBeenCalledTimes(1);
    expect(repository.completeSessionAtomic).toHaveBeenCalledWith({
      patches: [{ actualWeight: 42, id: 'set-a' }],
      sessionId: 'session-a',
    });
    expect(repository.generateTrainingReport).not.toHaveBeenCalled();
  });

  it('restores patches and resumes writes when atomic completion fails', async () => {
    const repository = {
      completeSessionAtomic: jest.fn(async () => { throw new Error('disk full'); }),
    };
    const coordinator = new WorkoutWriteCoordinator(async () => []);
    coordinator.schedulePatch('set-a', { actualReps: 8 });

    await expect(finishWorkoutSession({
      cancelDebounceTimers: () => undefined,
      coordinator,
      repository: repository as never,
      sessionId: 'session-a',
    })).rejects.toThrow('disk full');

    expect(coordinator.getDiagnostics()).toMatchObject({ frozen: false, pendingPatchCount: 1 });
  });
});
