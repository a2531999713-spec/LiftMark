import type { ManualWorkoutExerciseV2Input } from '@/domain/workout/workout.types';
import type { ManualExerciseDraft, ManualSetDraft } from '@/store/manualWorkoutDraftStore';

export type ManualWorkoutSummary = {
  exerciseCount: number;
  plannedSetCount: number;
  savedSetCount: number;
  totalVolume: number;
};

export function parseDraftNumber(value: string): number | undefined {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseDraftInteger(value: string): number | undefined {
  const parsed = parseDraftNumber(value);
  if (parsed === undefined) return undefined;
  return Number.isInteger(parsed) ? parsed : undefined;
}

export function calculateSetVolume(set: ManualSetDraft): number {
  if (set.status !== 'completed') return 0;
  const weight = parseDraftNumber(set.weight) ?? 0;
  const reps = parseDraftInteger(set.reps) ?? 0;
  return weight * reps;
}

export function summarizeManualWorkout(
  exercises: ManualExerciseDraft[],
  participantMemberIds: string[],
): ManualWorkoutSummary {
  const participantSet = new Set(participantMemberIds);
  return exercises.reduce<ManualWorkoutSummary>(
    (summary, exercise) => {
      const memberSets = exercise.memberSets.filter((memberSet) => participantSet.has(memberSet.memberId));
      const savedSetCount = memberSets.reduce((sum, memberSet) => sum + memberSet.sets.length, 0);
      const totalVolume = memberSets.reduce(
        (sum, memberSet) => sum + memberSet.sets.reduce((setSum, set) => setSum + calculateSetVolume(set), 0),
        0,
      );

      return {
        exerciseCount: summary.exerciseCount + 1,
        plannedSetCount: summary.plannedSetCount + exercise.plannedSets,
        savedSetCount: summary.savedSetCount + savedSetCount,
        totalVolume: summary.totalVolume + totalVolume,
      };
    },
    { exerciseCount: 0, plannedSetCount: 0, savedSetCount: 0, totalVolume: 0 },
  );
}

export function formatKilograms(value: number): string {
  return `${Math.round(value).toLocaleString('zh-CN')} kg`;
}

export function toManualSessionV2Exercises(
  exercises: ManualExerciseDraft[],
  participantMemberIds: string[],
): ManualWorkoutExerciseV2Input[] {
  const participantSet = new Set(participantMemberIds);

  return exercises.map((exercise) => ({
    exerciseId: exercise.exerciseId,
    plannedReps: exercise.plannedReps ?? null,
    plannedRestSeconds: exercise.plannedRestSeconds ?? null,
    plannedSets: exercise.plannedSets,
    priority: exercise.priority,
    memberSets: exercise.memberSets
      .filter((memberSet) => participantSet.has(memberSet.memberId))
      .map((memberSet) => ({
        memberId: memberSet.memberId,
        sets: memberSet.sets.map((set) => ({
          completed: set.status === 'completed',
          notes: set.notes?.trim() || null,
          reps: parseDraftInteger(set.reps),
          rpe: parseDraftNumber(set.rpe ?? '') ?? null,
          rir: parseDraftNumber(set.rir ?? '') ?? null,
          setIndex: set.setIndex,
          skipped: set.status === 'skipped',
          weight: parseDraftNumber(set.weight),
        })),
      })),
  }));
}
