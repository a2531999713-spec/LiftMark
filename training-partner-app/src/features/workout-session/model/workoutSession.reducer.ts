import type { WorkoutSessionAction } from './workoutSession.actions';
import type { WorkoutSessionState } from './workoutSession.state';

export function workoutSessionReducer(
  state: WorkoutSessionState,
  action: WorkoutSessionAction,
): WorkoutSessionState {
  switch (action.type) {
    case 'loaded':
      return {
        ...state,
        detail: action.detail,
        participants: action.participants,
        profiles: action.profiles,
        exercises: action.exercises,
        activeParticipantId: action.activeParticipantId,
        activeExerciseIndex: action.activeExerciseIndex,
        status: 'active',
        recoverableError: null,
      };
    case 'statusChanged':
      return { ...state, status: action.status };
    case 'detailChanged':
      return { ...state, detail: action.detail };
    case 'writeQueued':
      return state.pendingWriteIds.includes(action.setId)
        ? state
        : { ...state, pendingWriteIds: [...state.pendingWriteIds, action.setId], status: 'saving_set' };
    case 'writeFinished': {
      const pendingWriteIds = state.pendingWriteIds.filter((id) => id !== action.setId);
      return {
        ...state,
        pendingWriteIds,
        lastSavedAt: action.savedAt ?? state.lastSavedAt,
        status: pendingWriteIds.length === 0 ? 'active' : state.status,
      };
    }
    case 'recoverableError':
      return { ...state, recoverableError: action.message, status: action.message ? 'save_failed' : state.status };
    case 'sheetChanged':
      return {
        ...state,
        adjustmentSheetVisible: action.sheet === 'adjustment' ? action.visible : state.adjustmentSheetVisible,
        participantSheetVisible: action.sheet === 'participant' ? action.visible : state.participantSheetVisible,
        exercisePickerVisible: action.sheet === 'exercisePicker' ? action.visible : state.exercisePickerVisible,
      };
  }
}
