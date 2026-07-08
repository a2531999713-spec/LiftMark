import type { Group } from '@/domain/group/group.types';
import type { GroupMember, MemberProfile } from '@/domain/member/member.types';
import type {
  PlanCycle,
  PlanCycleSummary,
  PlanDay,
  PlanExercise,
  PlanPhase,
  PlanTemplate,
} from '@/domain/plan/plan.types';
import type { Exercise, ExerciseAlternative } from '@/domain/exercise/exercise.types';
import type {
  WorkoutExerciseRecord,
  WorkoutSession,
  WorkoutSet,
} from '@/domain/workout/workout.types';

export type GroupRow = {
  id: string;
  name: string;
  owner_user_id: string | null;
  active_plan_id: string;
  current_phase_type: Group['currentPhaseType'];
  current_week: number;
  friday_enabled: number;
  friday_strategy?: Group['fridayStrategy'] | null;
  created_at: string;
  updated_at: string;
};

export function mapGroup(row: GroupRow): Group {
  return {
    id: row.id,
    name: row.name,
    ownerUserId: row.owner_user_id ?? undefined,
    activePlanId: row.active_plan_id,
    currentPhaseType: row.current_phase_type,
    currentWeek: row.current_week,
    fridayEnabled: row.friday_enabled === 1,
    fridayStrategy: row.friday_strategy ?? (row.friday_enabled === 1 ? 'allow_weak' : 'default_rest'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type GroupMemberRow = {
  id: string;
  group_id: string;
  display_name: string;
  user_id?: string | null;
  member_type?: GroupMember['memberType'] | null;
  local_member_id?: string | null;
  role: GroupMember['role'];
  avatar_url: string | null;
  joined_at?: string | null;
  created_at: string;
  updated_at: string;
};

export function mapGroupMember(row: GroupMemberRow): GroupMember {
  return {
    id: row.id,
    groupId: row.group_id,
    displayName: row.display_name,
    userId: row.user_id ?? undefined,
    memberType: row.member_type ?? (row.user_id ? 'real' : 'local'),
    localMemberId: row.local_member_id ?? undefined,
    role: row.role,
    avatarUrl: row.avatar_url ?? undefined,
    joinedAt: row.joined_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type MemberProfileRow = {
  id: string;
  member_id: string;
  group_id: string;
  avatar_url?: string | null;
  avatar_thumb_url?: string | null;
  avatar_local_uri?: string | null;
  avatar_updated_at?: string | null;
  bodyweight: number | null;
  bench_1rm: number | null;
  squat_1rm: number | null;
  deadlift_1rm: number | null;
  overhead_press_1rm: number | null;
  pullup_reference_weight: number | null;
  barbell_increment: number;
  dumbbell_increment: number;
  created_at: string;
  updated_at: string;
};

export function mapMemberProfile(row: MemberProfileRow): MemberProfile {
  return {
    id: row.id,
    memberId: row.member_id,
    groupId: row.group_id,
    avatarUrl: row.avatar_url ?? undefined,
    avatarThumbUrl: row.avatar_thumb_url ?? undefined,
    avatarLocalUri: row.avatar_local_uri ?? undefined,
    avatarUpdatedAt: row.avatar_updated_at ?? undefined,
    bodyweight: row.bodyweight ?? undefined,
    bench1RM: row.bench_1rm ?? undefined,
    squat1RM: row.squat_1rm ?? undefined,
    deadlift1RM: row.deadlift_1rm ?? undefined,
    overheadPress1RM: row.overhead_press_1rm ?? undefined,
    pullupReferenceWeight: row.pullup_reference_weight ?? undefined,
    barbellIncrement: row.barbell_increment,
    dumbbellIncrement: row.dumbbell_increment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ExerciseRow = {
  id: string;
  name: string;
  source_id?: string | null;
  name_zh?: string | null;
  name_en?: string | null;
  aliases?: string | null;
  source?: Exercise['source'] | null;
  category: Exercise['category'];
  movement_pattern: Exercise['movementPattern'];
  force_type?: string | null;
  target_muscle: string;
  primary_muscle?: string | null;
  secondary_muscle: string | null;
  secondary_muscles?: string | null;
  equipment: Exercise['equipment'];
  difficulty: Exercise['difficulty'] | null;
  is_unilateral?: number | null;
  is_bodyweight?: number | null;
  default_unit?: string | null;
  instructions_zh?: string | null;
  instructions_en?: string | null;
  tips?: string | null;
  thumbnail_url?: string | null;
  gif_url?: string | null;
  video_url?: string | null;
  local_asset_path?: string | null;
  media_source?: string | null;
  media_license?: string | null;
  media_attribution?: string | null;
  media_usage_status?: string | null;
  icon_key?: string | null;
  heatmap_key?: string | null;
  muscle_activation_json?: string | null;
  is_system?: number | null;
  is_custom?: number | null;
  created_by_user_id?: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    sourceId: row.source_id ?? undefined,
    nameZh: row.name_zh ?? undefined,
    nameEn: row.name_en ?? undefined,
    aliases: row.aliases ?? undefined,
    source: row.source ?? 'system',
    category: row.category,
    movementPattern: row.movement_pattern,
    forceType: row.force_type ?? undefined,
    targetMuscle: row.target_muscle,
    primaryMuscle: row.primary_muscle ?? row.target_muscle,
    secondaryMuscle: row.secondary_muscle ?? undefined,
    secondaryMuscles: row.secondary_muscles ?? row.secondary_muscle ?? undefined,
    equipment: row.equipment,
    difficulty: row.difficulty ?? undefined,
    isUnilateral: row.is_unilateral === undefined || row.is_unilateral === null ? undefined : row.is_unilateral === 1,
    isBodyweight: row.is_bodyweight === undefined || row.is_bodyweight === null ? undefined : row.is_bodyweight === 1,
    defaultUnit: row.default_unit ?? undefined,
    instructionsZh: row.instructions_zh ?? undefined,
    instructionsEn: row.instructions_en ?? undefined,
    tips: row.tips ?? undefined,
    thumbnailUrl: row.thumbnail_url ?? undefined,
    gifUrl: row.gif_url ?? undefined,
    videoUrl: row.video_url ?? undefined,
    localAssetPath: row.local_asset_path ?? undefined,
    mediaSource: row.media_source ?? undefined,
    mediaLicense: row.media_license ?? undefined,
    mediaAttribution: row.media_attribution ?? undefined,
    mediaUsageStatus: row.media_usage_status ?? undefined,
    iconKey: row.icon_key ?? undefined,
    heatmapKey: row.heatmap_key ?? undefined,
    muscleActivationJson: row.muscle_activation_json ?? undefined,
    isSystem: row.is_system === undefined || row.is_system === null ? row.source === 'system' : row.is_system === 1,
    isCustom: row.is_custom === undefined || row.is_custom === null ? row.source === 'custom' : row.is_custom === 1,
    createdByUserId: row.created_by_user_id ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ExerciseAlternativeRow = {
  id: string;
  exercise_id: string;
  alternative_exercise_id: string;
  reason: string | null;
};

export function mapExerciseAlternative(row: ExerciseAlternativeRow): ExerciseAlternative {
  return {
    id: row.id,
    exerciseId: row.exercise_id,
    alternativeExerciseId: row.alternative_exercise_id,
    reason: row.reason ?? undefined,
  };
}

export type PlanTemplateRow = {
  id: string;
  name: string;
  creator_id: string | null;
  visibility: PlanTemplate['visibility'];
  goal: PlanTemplate['goal'];
  duration_weeks: number;
  frequency_per_week: number;
  description: string | null;
  source: PlanTemplate['source'];
  origin_scheme_id?: string | null;
  status?: PlanTemplate['status'] | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export function mapPlanTemplate(row: PlanTemplateRow): PlanTemplate {
  return {
    id: row.id,
    name: row.name,
    creatorId: row.creator_id ?? undefined,
    visibility: row.visibility,
    goal: row.goal,
    durationWeeks: row.duration_weeks,
    frequencyPerWeek: row.frequency_per_week,
    description: row.description ?? undefined,
    source: row.source,
    originSchemeId: row.origin_scheme_id ?? undefined,
    status: row.status ?? 'active',
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PlanCycleRow = {
  id: string;
  owner_user_id: string | null;
  group_id: string;
  plan_id: string;
  cycle_index: number;
  name: string;
  start_date: string;
  end_date: string | null;
  planned_weeks: number;
  actual_start_date: string | null;
  actual_end_date: string | null;
  status: PlanCycle['status'];
  completed_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapPlanCycle(row: PlanCycleRow): PlanCycle {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id ?? undefined,
    groupId: row.group_id,
    planId: row.plan_id,
    cycleIndex: row.cycle_index,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    plannedWeeks: row.planned_weeks,
    actualStartDate: row.actual_start_date ?? undefined,
    actualEndDate: row.actual_end_date ?? undefined,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PlanCycleSummaryRow = {
  id: string;
  owner_user_id: string | null;
  group_id: string;
  plan_id: string;
  plan_cycle_id: string;
  planned_workout_count: number;
  completed_workout_count: number;
  skipped_workout_count: number;
  completion_rate: number;
  total_volume: number;
  total_sets: number;
  total_reps: number;
  total_duration_seconds: number;
  estimated_calories: number;
  top_progress_exercises_json: string | null;
  weak_exercises_json: string | null;
  muscle_group_distribution_json: string | null;
  summary_text: string | null;
  created_at: string;
  updated_at: string;
};

export function mapPlanCycleSummary(row: PlanCycleSummaryRow): PlanCycleSummary {
  return {
    id: row.id,
    ownerUserId: row.owner_user_id ?? undefined,
    groupId: row.group_id,
    planId: row.plan_id,
    planCycleId: row.plan_cycle_id,
    plannedWorkoutCount: row.planned_workout_count,
    completedWorkoutCount: row.completed_workout_count,
    skippedWorkoutCount: row.skipped_workout_count,
    completionRate: row.completion_rate,
    totalVolume: row.total_volume,
    totalSets: row.total_sets,
    totalReps: row.total_reps,
    totalDurationSeconds: row.total_duration_seconds,
    estimatedCalories: row.estimated_calories,
    topProgressExercisesJson: row.top_progress_exercises_json ?? undefined,
    weakExercisesJson: row.weak_exercises_json ?? undefined,
    muscleGroupDistributionJson: row.muscle_group_distribution_json ?? undefined,
    summaryText: row.summary_text ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PlanPhaseRow = {
  id: string;
  plan_id: string;
  name: string;
  type: PlanPhase['type'];
  start_week: number;
  end_week: number;
  order_index: number;
};

export function mapPlanPhase(row: PlanPhaseRow): PlanPhase {
  return {
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    type: row.type,
    startWeek: row.start_week,
    endWeek: row.end_week,
    orderIndex: row.order_index,
  };
}

export type PlanDayRow = {
  id: string;
  plan_id: string;
  phase_id: string;
  week: number;
  weekday: PlanDay['weekday'];
  title: string;
  focus: string;
  notes: string | null;
};

export function mapPlanDay(row: PlanDayRow): PlanDay {
  return {
    id: row.id,
    planId: row.plan_id,
    phaseId: row.phase_id,
    week: row.week,
    weekday: row.weekday,
    title: row.title,
    focus: row.focus,
    notes: row.notes ?? undefined,
  };
}

export type PlanExerciseRow = {
  id: string;
  plan_day_id: string;
  exercise_id: string;
  priority: PlanExercise['priority'];
  order_index: number;
  sets: number | null;
  reps: number | null;
  rep_min: number | null;
  rep_max: number | null;
  intensity_type: PlanExercise['intensityType'];
  percent_1rm: number | null;
  rpe_target: number | null;
  rir_target: number | null;
  fixed_weight: number | null;
  reference_lift: PlanExercise['referenceLift'];
  rest_seconds: number | null;
  progression_rule_id: string | null;
  notes: string | null;
};

export function mapPlanExercise(row: PlanExerciseRow): PlanExercise {
  return {
    id: row.id,
    planDayId: row.plan_day_id,
    exerciseId: row.exercise_id,
    priority: row.priority,
    orderIndex: row.order_index,
    sets: row.sets ?? undefined,
    reps: row.reps ?? undefined,
    repMin: row.rep_min ?? undefined,
    repMax: row.rep_max ?? undefined,
    intensityType: row.intensity_type,
    percent1RM: row.percent_1rm ?? undefined,
    rpeTarget: row.rpe_target ?? undefined,
    rirTarget: row.rir_target ?? undefined,
    fixedWeight: row.fixed_weight ?? undefined,
    referenceLift: row.reference_lift,
    restSeconds: row.rest_seconds ?? undefined,
    progressionRuleId: row.progression_rule_id ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export type WorkoutSessionRow = {
  id: string;
  group_id: string;
  plan_id: string;
  plan_cycle_id?: string | null;
  plan_day_id?: string | null;
  phase_id: string | null;
  date: string;
  week: number;
  weekday: WorkoutSession['weekday'];
  title: string;
  status: WorkoutSession['status'];
  training_mode?: WorkoutSession['trainingMode'] | null;
  recorded_by_user_id?: string | null;
  source_device_id?: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export function mapWorkoutSession(row: WorkoutSessionRow): WorkoutSession {
  return {
    id: row.id,
    groupId: row.group_id,
    planId: row.plan_id,
    planCycleId: row.plan_cycle_id ?? undefined,
    planDayId: row.plan_day_id ?? undefined,
    phaseId: row.phase_id ?? undefined,
    date: row.date,
    week: row.week,
    weekday: row.weekday,
    title: row.title,
    status: row.status,
    trainingMode: row.training_mode ?? 'group_local',
    recordedByUserId: row.recorded_by_user_id ?? undefined,
    sourceDeviceId: row.source_device_id ?? undefined,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type WorkoutExerciseRecordRow = {
  id: string;
  session_id: string;
  plan_cycle_id?: string | null;
  plan_day_id?: string | null;
  plan_exercise_id: string | null;
  exercise_id: string;
  order_index: number;
  replaced_from_exercise_id: string | null;
  priority: WorkoutExerciseRecord['priority'];
  planned_sets: number | null;
  planned_reps: number | null;
  planned_rep_min: number | null;
  planned_rep_max: number | null;
  planned_rpe: number | null;
  planned_rir: number | null;
  planned_percent_1rm: number | null;
  planned_rest_seconds: number | null;
  notes: string | null;
};

export function mapWorkoutExerciseRecord(row: WorkoutExerciseRecordRow): WorkoutExerciseRecord {
  return {
    id: row.id,
    sessionId: row.session_id,
    planCycleId: row.plan_cycle_id ?? undefined,
    planDayId: row.plan_day_id ?? undefined,
    planExerciseId: row.plan_exercise_id ?? undefined,
    exerciseId: row.exercise_id,
    orderIndex: row.order_index,
    replacedFromExerciseId: row.replaced_from_exercise_id ?? undefined,
    priority: row.priority,
    plannedSets: row.planned_sets ?? undefined,
    plannedReps: row.planned_reps ?? undefined,
    plannedRepMin: row.planned_rep_min ?? undefined,
    plannedRepMax: row.planned_rep_max ?? undefined,
    plannedRpe: row.planned_rpe ?? undefined,
    plannedRir: row.planned_rir ?? undefined,
    plannedPercent1RM: row.planned_percent_1rm ?? undefined,
    plannedRestSeconds: row.planned_rest_seconds ?? undefined,
    notes: row.notes ?? undefined,
  };
}

export type WorkoutSetRow = {
  id: string;
  session_id: string;
  exercise_record_id: string;
  member_id: string;
  recorded_by_user_id?: string | null;
  source_device_id?: string | null;
  set_number: number;
  planned_weight: number | null;
  actual_weight: number | null;
  planned_reps: number | null;
  actual_reps: number | null;
  rpe: number | null;
  rir: number | null;
  actual_rest_seconds?: number | null;
  completed: number;
  skipped: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export function mapWorkoutSet(row: WorkoutSetRow): WorkoutSet {
  return {
    id: row.id,
    sessionId: row.session_id,
    exerciseRecordId: row.exercise_record_id,
    memberId: row.member_id,
    recordedByUserId: row.recorded_by_user_id ?? undefined,
    sourceDeviceId: row.source_device_id ?? undefined,
    setNumber: row.set_number,
    plannedWeight: row.planned_weight ?? undefined,
    actualWeight: row.actual_weight ?? undefined,
    plannedReps: row.planned_reps ?? undefined,
    actualReps: row.actual_reps ?? undefined,
    rpe: row.rpe ?? undefined,
    rir: row.rir ?? undefined,
    actualRestSeconds: row.actual_rest_seconds ?? undefined,
    completed: row.completed === 1,
    skipped: row.skipped === 1,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
