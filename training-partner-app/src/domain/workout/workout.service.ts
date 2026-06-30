import type { PlanExercise } from '../plan/plan.types';
import type { WorkoutExerciseRecord, WorkoutSet, WorkoutSummary } from './workout.types';

export function getPlanExerciseSetCount(exercise: PlanExercise): number {
  return Math.max(1, exercise.sets ?? 1);
}

export function getPlanExerciseInitialReps(exercise: PlanExercise): number | undefined {
  return exercise.reps ?? exercise.repMin;
}

export function getWorkoutRecordInitialReps(record: WorkoutExerciseRecord): number | undefined {
  return record.plannedReps ?? record.plannedRepMin;
}

export function summarizeWorkoutSets(sessionId: string, sets: WorkoutSet[]): WorkoutSummary {
  return {
    sessionId,
    completedSets: sets.filter((set) => set.completed).length,
    totalSets: sets.length,
  };
}

function getMemberOrderIndex(memberOrder: string[], memberId: string): number {
  const index = memberOrder.indexOf(memberId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function compareWorkoutSetsByRotation(
  memberOrder: string[],
  left: WorkoutSet,
  right: WorkoutSet,
): number {
  return (
    left.setNumber - right.setNumber ||
    getMemberOrderIndex(memberOrder, left.memberId) - getMemberOrderIndex(memberOrder, right.memberId) ||
    left.createdAt.localeCompare(right.createdAt) ||
    left.id.localeCompare(right.id)
  );
}

export function getNextWorkoutSetForRotation(
  sets: WorkoutSet[],
  memberOrder: string[],
  exerciseRecordId: string,
  preferredMemberId?: string,
): WorkoutSet | null {
  const pendingSets = sets
    .filter((set) => set.exerciseRecordId === exerciseRecordId && !set.completed && !set.skipped)
    .sort((left, right) => compareWorkoutSetsByRotation(memberOrder, left, right));

  if (pendingSets.length === 0) {
    return null;
  }

  if (preferredMemberId) {
    return pendingSets.find((set) => set.memberId === preferredMemberId) ?? pendingSets[0];
  }

  return pendingSets[0];
}

export type WorkoutExerciseSetProgress = {
  completedMemberSets: number;
  currentSetNumber: number;
  isComplete: boolean;
  totalMemberSets: number;
  totalPlannedSets: number;
};

export function getWorkoutExerciseSetProgress(
  sets: WorkoutSet[],
  exerciseRecordId: string,
): WorkoutExerciseSetProgress {
  const exerciseSets = sets.filter((set) => set.exerciseRecordId === exerciseRecordId);
  const totalPlannedSets = Math.max(0, ...exerciseSets.map((set) => set.setNumber));
  const pendingSets = exerciseSets
    .filter((set) => !set.completed && !set.skipped)
    .sort((left, right) => left.setNumber - right.setNumber || left.id.localeCompare(right.id));

  return {
    completedMemberSets: exerciseSets.filter((set) => set.completed).length,
    currentSetNumber: pendingSets[0]?.setNumber ?? totalPlannedSets,
    isComplete: exerciseSets.length > 0 && pendingSets.length === 0,
    totalMemberSets: exerciseSets.length,
    totalPlannedSets,
  };
}

export type ShortWorkoutCheckInput = {
  completedExerciseCount: number;
  completedSetCount: number;
  elapsedSeconds: number;
  totalExerciseCount: number;
  totalVolumeKg: number;
};

export type ShortWorkoutCheckResult = {
  elapsedMinutes: number;
  reasons: string[];
  shouldConfirm: boolean;
};

export function checkShortWorkout(input: ShortWorkoutCheckInput): ShortWorkoutCheckResult {
  const elapsedMinutes = Math.floor(input.elapsedSeconds / 60);
  const reasons: string[] = [];

  if (input.completedExerciseCount < 2) {
    reasons.push(`只完成了 ${input.completedExerciseCount} 个动作`);
  }
  if (input.completedSetCount < 3) {
    reasons.push(`只完成了 ${input.completedSetCount} 组`);
  }
  if (input.elapsedSeconds < 5 * 60) {
    reasons.push(`训练时间 ${elapsedMinutes} 分钟`);
  }
  if (input.totalVolumeKg <= 0) {
    reasons.push('训练总量为 0');
  }
  if (
    input.totalExerciseCount > 0 &&
    input.completedExerciseCount < Math.ceil(input.totalExerciseCount / 2)
  ) {
    reasons.push('大部分动作未完成');
  }

  return {
    elapsedMinutes,
    reasons,
    shouldConfirm: reasons.length > 0,
  };
}
