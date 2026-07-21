import { describe, expect, it } from '@jest/globals';

import { workoutSessionReducer } from '@/features/workout-session/model/workoutSession.reducer';
import { initialWorkoutSessionState } from '@/features/workout-session/model/workoutSession.state';
import { WorkoutWriteCoordinator } from '@/features/workout-session/services/workoutWriteCoordinator.service';
import { getRestTimerSnapshot } from '@/features/workout-session/services/workoutRestTimer.service';

describe('workout session architecture', () => {
  it('coalesces rapid writes to the same set', async () => {
    const batches: unknown[][] = [];
    const coordinator = new WorkoutWriteCoordinator(async (patches) => {
      batches.push(patches);
      return patches as never;
    });
    for (let value = 1; value <= 100; value += 1) {
      coordinator.schedulePatch('set-a', { actualWeight: value });
    }
    await coordinator.flushSession();
    expect(batches).toHaveLength(1);
    expect(batches[0]).toEqual([{ id: 'set-a', actualWeight: 100 }]);
  });

  it('derives rest time from timestamps after background time passes', () => {
    expect(getRestTimerSnapshot(1_000, 90, 96_000)).toEqual({
      elapsedSeconds: 95,
      remainingSeconds: 0,
      ready: true,
    });
  });

  it('tracks pending writes through the reducer', () => {
    const queued = workoutSessionReducer(initialWorkoutSessionState, { type: 'writeQueued', setId: 'set-a' });
    const flushed = workoutSessionReducer(queued, { type: 'writeFinished', setId: 'set-a', savedAt: 'now' });
    expect(queued.pendingWriteIds).toEqual(['set-a']);
    expect(flushed.pendingWriteIds).toEqual([]);
    expect(flushed.lastSavedAt).toBe('now');
  });
});
