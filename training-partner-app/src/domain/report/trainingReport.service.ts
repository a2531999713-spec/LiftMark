import type {
  TrainingIntensityLevel,
  TrainingReportDetail,
  TrainingReportExerciseView,
  TrainingReportMemberView,
  TrainingReportSource,
} from './trainingReport.types';

export const DEFAULT_REPORT_BODYWEIGHT_KG = 65;

export function getTrainingIntensityLevel(input: {
  durationSeconds: number;
  totalSets: number;
  totalVolume: number;
}): TrainingIntensityLevel {
  if (input.durationSeconds >= 75 * 60 || input.totalSets >= 24 || input.totalVolume >= 12_000) return 'high';
  if (input.durationSeconds >= 35 * 60 || input.totalSets >= 10 || input.totalVolume >= 3_500) return 'medium';
  return 'low';
}

function getMetForIntensity(intensity: TrainingIntensityLevel): number {
  if (intensity === 'high') return 6;
  if (intensity === 'medium') return 5;
  return 3.5;
}

export function estimateTrainingCalories(input: {
  durationSeconds: number;
  intensity: TrainingIntensityLevel;
  participantBodyweightsKg: (number | null | undefined)[];
}) {
  const weights = input.participantBodyweightsKg.length > 0 ? input.participantBodyweightsKg : [undefined];
  const usedDefaultBodyweight = weights.some((weight) => !weight || weight <= 0);
  const totalBodyweightKg = weights.reduce<number>(
    (sum, weight) => sum + (weight && weight > 0 ? weight : DEFAULT_REPORT_BODYWEIGHT_KG),
    0,
  );
  const hours = Math.max(input.durationSeconds, 60) / 3600;
  const calories = getMetForIntensity(input.intensity) * totalBodyweightKg * hours;
  return {
    estimatedCalories: Math.max(0, Math.round(calories)),
    estimatedCaloriesMin: Math.max(0, Math.round(calories * 0.8)),
    estimatedCaloriesMax: Math.max(0, Math.round(calories * 1.2)),
    usedDefaultBodyweight,
  };
}

function getDurationSeconds(source: TrainingReportSource): number {
  if (source.report) return Math.max(0, source.report.durationSeconds);
  const start = source.startedAt ? new Date(source.startedAt).getTime() : Number.NaN;
  const end = source.finishedAt ? new Date(source.finishedAt).getTime() : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 1000);
}

export function buildTrainingReportDetail(source: TrainingReportSource): TrainingReportDetail {
  const exercises: TrainingReportExerciseView[] = source.exercises.map((exercise) => {
    const completedSets = exercise.sets.filter((set) => set.completed && !set.skipped);
    return {
      completedSets: completedSets.length,
      exerciseId: exercise.exerciseId,
      exerciseName: exercise.exerciseName,
      isTemporary: exercise.isTemporary,
      memberNames: [...new Set(completedSets.map((set) => set.memberName))],
      recordId: exercise.recordId,
      replacedFromExerciseName: exercise.replacedFromExerciseName,
      sets: exercise.sets,
      totalReps: completedSets.reduce((sum, set) => sum + set.reps, 0),
      totalVolume: completedSets.reduce((sum, set) => sum + set.weight * set.reps, 0),
    };
  });
  const completedSets = exercises.flatMap((exercise) => exercise.sets).filter((set) => set.completed && !set.skipped);
  const memberMap = new Map<string, TrainingReportMemberView>();
  for (const set of completedSets) {
    const current = memberMap.get(set.memberId) ?? {
      completedSets: 0,
      memberId: set.memberId,
      memberName: set.memberName,
      totalReps: 0,
      totalVolume: 0,
    };
    current.completedSets += 1;
    current.totalReps += set.reps;
    current.totalVolume += set.weight * set.reps;
    memberMap.set(set.memberId, current);
  }
  const durationSeconds = getDurationSeconds(source);
  const calculatedTotalVolume = completedSets.reduce((sum, set) => sum + set.weight * set.reps, 0);
  const calculatedTotalReps = completedSets.reduce((sum, set) => sum + set.reps, 0);
  const intensityLevel = source.report?.intensityLevel ?? getTrainingIntensityLevel({
    durationSeconds,
    totalSets: completedSets.length,
    totalVolume: calculatedTotalVolume,
  });
  const calorieEstimate = estimateTrainingCalories({
    durationSeconds,
    intensity: intensityLevel,
    participantBodyweightsKg: source.participantBodyweights.map((participant) => participant.weightKg),
  });

  return {
    calorieEstimateUsedDefaultBodyweight: calorieEstimate.usedDefaultBodyweight,
    cycleName: source.cycleName,
    durationSeconds,
    estimatedCalories: source.report?.estimatedCalories ?? calorieEstimate.estimatedCalories,
    estimatedCaloriesMax: source.report?.estimatedCaloriesMax ?? calorieEstimate.estimatedCaloriesMax,
    estimatedCaloriesMin: source.report?.estimatedCaloriesMin ?? calorieEstimate.estimatedCaloriesMin,
    exerciseCount: source.report?.exerciseCount ?? exercises.filter((exercise) => exercise.completedSets > 0).length,
    exercises,
    finishedAt: source.finishedAt,
    groupId: source.groupId,
    intensityLevel,
    isHistoricalFallback: !source.hasReport,
    members: [...memberMap.values()],
    notes: source.report?.notes ?? source.notes,
    planCycleId: source.planCycleId,
    planId: source.planId,
    planName: source.planName,
    reportId: source.report?.id,
    sessionDate: source.sessionDate,
    sessionId: source.sessionId,
    sessionTitle: source.sessionTitle,
    sessionType: source.sessionType,
    startedAt: source.startedAt,
    totalReps: source.report?.totalReps ?? calculatedTotalReps,
    totalSets: source.report?.totalSets ?? completedSets.length,
    totalVolume: source.report?.totalVolume ?? calculatedTotalVolume,
    week: source.week,
    weekday: source.weekday,
  };
}
