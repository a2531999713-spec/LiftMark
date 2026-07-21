import type { PlanExercise } from '../plan/plan.types';
import type {
  WorkoutExerciseRecord,
  WorkoutSessionDetail,
  WorkoutSet,
  WorkoutSummary,
} from './workout.types';

export type WorkoutCursor = {
  exerciseIndex: number;
  setIndex: number;
  memberIndex: number;
};

export type WorkoutExecutionQueueItem = {
  id: string;
  exerciseRecordId: string;
  exerciseId: string;
  plannedExerciseId?: string;
  setIndex: number;
  memberId: string;
  status: 'pending' | 'completed' | 'skipped';
  isExtraSet?: boolean;
  isTemporaryExercise?: boolean;
  replacedFromExerciseId?: string;
};

export type WorkoutAdjustmentSummary = {
  extraSetCount: number;
  hasAdjustments: boolean;
  replacementCount: number;
  skippedExerciseCount: number;
  temporaryExerciseCount: number;
};

export const WORKOUT_EXTRA_SET_NOTE = '加做组';
export const WORKOUT_TEMPORARY_EXERCISE_NOTE = '临时添加动作';
export const WORKOUT_SKIPPED_EXERCISE_NOTE = '本次跳过动作';
export const WORKOUT_REPLACEMENT_NOTE = '本次替换';

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
  const completedSets = sets.filter((set) => set.completed);
  return {
    sessionId,
    completedSets: completedSets.length,
    durationSeconds: 0,
    exerciseCount: new Set(completedSets.map((set) => set.exerciseRecordId)).size,
    totalSets: sets.length,
    totalReps: completedSets.reduce((sum, set) => sum + (set.actualReps ?? 0), 0),
    totalVolume: completedSets.reduce(
      (sum, set) => sum + (set.actualWeight ?? 0) * (set.actualReps ?? 0),
      0,
    ),
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

function compareWorkoutRecords(left: WorkoutExerciseRecord, right: WorkoutExerciseRecord): number {
  return left.orderIndex - right.orderIndex || left.id.localeCompare(right.id);
}

function includesNote(note: string | undefined, keyword: string): boolean {
  return Boolean(note?.includes(keyword));
}

export function isTemporaryWorkoutExercise(record: WorkoutExerciseRecord): boolean {
  return !record.planExerciseId && includesNote(record.notes, WORKOUT_TEMPORARY_EXERCISE_NOTE);
}

export function isExtraWorkoutSet(set: WorkoutSet, record?: WorkoutExerciseRecord): boolean {
  return includesNote(set.notes, WORKOUT_EXTRA_SET_NOTE) || (
    record?.plannedSets !== undefined && set.setNumber > record.plannedSets
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

export function buildWorkoutExecutionQueue(
  detail: WorkoutSessionDetail,
  memberOrder: string[],
): WorkoutExecutionQueueItem[] {
  const recordIndex = new Map<string, WorkoutExerciseRecord>();
  detail.exercises.forEach((record) => recordIndex.set(record.id, record));

  const recordOrder = [...detail.exercises].sort(compareWorkoutRecords);
  const recordOrderIndex = new Map(recordOrder.map((record, index) => [record.id, index]));

  return [...detail.sets]
    .sort((left, right) => {
      const leftRecordIndex = recordOrderIndex.get(left.exerciseRecordId) ?? Number.MAX_SAFE_INTEGER;
      const rightRecordIndex = recordOrderIndex.get(right.exerciseRecordId) ?? Number.MAX_SAFE_INTEGER;
      return (
        leftRecordIndex - rightRecordIndex ||
        compareWorkoutSetsByRotation(memberOrder, left, right)
      );
    })
    .map((set) => {
      const record = recordIndex.get(set.exerciseRecordId);
      return {
        id: set.id,
        exerciseRecordId: set.exerciseRecordId,
        exerciseId: record?.exerciseId ?? set.exerciseRecordId,
        plannedExerciseId: record?.replacedFromExerciseId ?? record?.exerciseId,
        setIndex: Math.max(0, set.setNumber - 1),
        memberId: set.memberId,
        status: set.skipped ? 'skipped' : set.completed ? 'completed' : 'pending',
        isExtraSet: isExtraWorkoutSet(set, record) || undefined,
        isTemporaryExercise: record ? isTemporaryWorkoutExercise(record) || undefined : undefined,
        replacedFromExerciseId: record?.replacedFromExerciseId,
      };
    });
}

export function getWorkoutCursorFromQueue(
  detail: WorkoutSessionDetail,
  memberOrder: string[],
): WorkoutCursor | null {
  const records = [...detail.exercises].sort(compareWorkoutRecords);
  for (const [exerciseIndex, record] of records.entries()) {
    const nextSet = getNextWorkoutSetForRotation(detail.sets, memberOrder, record.id);
    if (!nextSet) {
      continue;
    }

    return {
      exerciseIndex,
      setIndex: Math.max(0, nextSet.setNumber - 1),
      memberIndex: Math.max(0, memberOrder.indexOf(nextSet.memberId)),
    };
  }

  return null;
}

export function advanceWorkoutCursor(
  detail: WorkoutSessionDetail,
  memberOrder: string[],
): WorkoutCursor | null {
  return getWorkoutCursorFromQueue(detail, memberOrder);
}

export function getWorkoutSetByCursor(
  detail: WorkoutSessionDetail,
  memberOrder: string[],
  cursor: WorkoutCursor,
): WorkoutSet | null {
  const record = [...detail.exercises].sort(compareWorkoutRecords)[cursor.exerciseIndex];
  if (!record) {
    return null;
  }
  const memberId = memberOrder[cursor.memberIndex];
  if (!memberId) {
    return null;
  }

  return detail.sets.find(
    (set) =>
      set.exerciseRecordId === record.id &&
      set.setNumber === cursor.setIndex + 1 &&
      set.memberId === memberId,
  ) ?? null;
}

export function summarizeWorkoutAdjustments(detail: WorkoutSessionDetail): WorkoutAdjustmentSummary {
  const replacementCount = detail.exercises.filter((record) => record.replacedFromExerciseId).length;
  const temporaryExerciseIds = new Set(
    detail.exercises.filter(isTemporaryWorkoutExercise).map((record) => record.id),
  );
  const skippedExerciseCount = detail.exercises.filter((record) => {
    const recordSets = detail.sets.filter((set) => set.exerciseRecordId === record.id);
    return recordSets.length > 0 && recordSets.every((set) => set.skipped);
  }).length;
  const extraSetCount = detail.sets.filter((set) => {
    const record = detail.exercises.find((item) => item.id === set.exerciseRecordId);
    return isExtraWorkoutSet(set, record);
  }).length;

  const summary = {
    extraSetCount,
    replacementCount,
    skippedExerciseCount,
    temporaryExerciseCount: temporaryExerciseIds.size,
  };

  return {
    ...summary,
    hasAdjustments:
      summary.replacementCount > 0 ||
      summary.extraSetCount > 0 ||
      summary.skippedExerciseCount > 0 ||
      summary.temporaryExerciseCount > 0,
  };
}

export type WorkoutExerciseSetProgress = {
  completedMemberSets: number;
  currentSetNumber: number;
  isComplete: boolean;
  totalMemberSets: number;
  totalPlannedSets: number;
};

export type WorkoutExerciseProgressStatus = 'completed' | 'current' | 'partial' | 'pending' | 'skipped';

export function getWorkoutExerciseProgressStatus(
  sets: WorkoutSet[],
  exerciseRecordId: string,
  isCurrent = false,
): WorkoutExerciseProgressStatus {
  const exerciseSets = sets.filter((set) => set.exerciseRecordId === exerciseRecordId);
  const pendingCount = exerciseSets.filter((set) => !set.completed && !set.skipped).length;
  const completedCount = exerciseSets.filter((set) => set.completed).length;
  const skippedCount = exerciseSets.filter((set) => set.skipped).length;
  if (isCurrent && pendingCount > 0) return 'current';
  if (exerciseSets.length > 0 && skippedCount === exerciseSets.length) return 'skipped';
  if (pendingCount === 0 && completedCount + skippedCount > 0) return 'completed';
  if (completedCount + skippedCount > 0) return 'partial';
  return 'pending';
}

export function getWorkoutCompletionState(sets: WorkoutSet[]): {
  canFinishFromCompletionCard: boolean;
  incompleteSetCount: number;
} {
  const incompleteSetCount = sets.filter((set) => !set.completed && !set.skipped).length;
  return {
    canFinishFromCompletionCard: sets.length > 0 && incompleteSetCount === 0,
    incompleteSetCount,
  };
}

export function resolveWorkoutSetCompletionInput(input: {
  fallbackReps?: number;
  isBodyweightExercise: boolean;
  previousCompletedWeight?: number;
  set: WorkoutSet;
}): { actualReps?: number; actualWeight?: number } {
  return {
    actualReps: input.set.actualReps ?? input.set.plannedReps ?? input.fallbackReps,
    actualWeight:
      input.set.actualWeight ??
      input.set.plannedWeight ??
      input.previousCompletedWeight ??
      (input.isBodyweightExercise ? 0 : undefined),
  };
}

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
