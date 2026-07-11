import { describe, expect, it } from '@jest/globals';

import { workoutSessionReducer } from '@/features/workout-session/model/workoutSession.reducer';
import { initialWorkoutSessionState } from '@/features/workout-session/model/workoutSession.state';
import { WorkoutAutosaveService } from '@/features/workout-session/services/workoutAutosave.service';
import { getRestTimerSnapshot } from '@/features/workout-session/services/workoutRestTimer.service';

describe('workout session architecture', () => {
  it('serializes rapid writes to the same set', async () => {
    const service = new WorkoutAutosaveService();
    const events: number[] = [];
    const first = service.enqueue('set-a', async () => {
      await Promise.resolve();
      events.push(1);
    });
    const second = service.enqueue('set-a', async () => {
      events.push(2);
    });
    await Promise.all([first, second]);
    expect(events).toEqual([1, 2]);
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
