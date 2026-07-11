import { useReducer } from 'react';

import { workoutSessionReducer } from '../model/workoutSession.reducer';
import { initialWorkoutSessionState } from '../model/workoutSession.state';

export function useWorkoutSessionController() {
  const [state, dispatch] = useReducer(workoutSessionReducer, initialWorkoutSessionState);
  return { dispatch, state };
}
