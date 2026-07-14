import { describe, expect, it, jest } from '@jest/globals';

import { finishWorkoutSession } from '@/features/workout-session/application/finishWorkoutSession.usecase';

describe('finishWorkoutSession', () => {
  it('waits only for local write flushing and session completion', async () => {
    const calls: string[] = [];
    const repository = {
      finishSession: jest.fn(async () => { calls.push('finish'); }),
      generateTrainingReport: jest.fn(async () => { calls.push('report'); }),
    };
    const autosave = { flush: jest.fn(async () => { calls.push('autosave'); }) };

    await finishWorkoutSession({
      autosave: autosave as never,
      flushDebouncedWrites: async () => { calls.push('debounced'); },
      repository: repository as never,
      sessionId: 'session-a',
    });

    expect(calls).toEqual(['debounced', 'autosave', 'finish']);
    expect(repository.generateTrainingReport).not.toHaveBeenCalled();
  });
});
