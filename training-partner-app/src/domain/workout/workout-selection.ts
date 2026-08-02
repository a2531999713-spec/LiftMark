import type {
  CreateSessionFromTodayPlanInput,
  WorkoutSession,
} from './workout.types';

function hasSameIds(actual: string[] | undefined, expected: string[] | undefined): boolean {
  if (!expected) return true;
  if (!actual) return false;
  const actualIds = new Set(actual);
  const expectedIds = new Set(expected);
  return actualIds.size === expectedIds.size
    && [...expectedIds].every((id) => actualIds.has(id));
}

export function isSameWorkoutSelection(
  session: WorkoutSession,
  input: CreateSessionFromTodayPlanInput,
): boolean {
  return (
    session.planId === input.planId
    && (!session.planDayId || !input.planDayId || session.planDayId === input.planDayId)
    && session.week === input.week
    && session.weekday === input.weekday
    && session.trainingMode === (input.trainingMode ?? 'group_local')
    && hasSameIds(session.participantMemberIds, input.participantMemberIds)
    && hasSameIds(session.planExerciseIds, input.planExerciseIds)
  );
}
