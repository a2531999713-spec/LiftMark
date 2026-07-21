import type { WorkoutSessionState } from './workoutSession.state';

export const selectHasPendingWrites = (state: WorkoutSessionState) => state.pendingWriteIds.length > 0;
export const selectCanFinishWorkout = (state: WorkoutSessionState) =>
  Boolean(state.detail && state.status !== 'loading' && state.status !== 'closing' && state.status !== 'completed');
