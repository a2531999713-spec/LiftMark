import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { WorkoutRepository } from '@/data/repositories/workoutRepository';
import { calculateSuggestedWeight } from '@/domain/weight/weight-calculator';
import { getPlanExerciseInitialReps, getPlanExerciseSetCount } from '@/domain/workout/workout.service';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
import type { SyncEntityType } from '@/sync/syncTypes';
import type {
  CreateSessionFromTodayPlanInput,
  CreateManualSessionInput,
  CreateManualSessionV2Input,
  AddWorkoutExerciseInput,
  AddWorkoutSetInput,
  ManualWorkoutExerciseInput,
  ListHistorySessionsByScopeInput,
  ListOpenWorkoutSessionsForDateInput,
  ListSessionsInput,
  SaveWorkoutSetInput,
  UpdateWorkoutSessionInput,
  WorkoutSessionAggregation,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSet,
  WorkoutSummary,
} from '@/domain/workout/workout.types';
import { validateWorkoutSetInput } from '@/domain/workout/workout.validation';

import { requireRow, type DatabaseProvider } from './base';
import { getCurrentAccountUserId, getGroupAccountScope, getOwnerUserIdForWrite } from '../accountScope';
import {
  mapExercise,
  mapGroupMember,
  mapMemberProfile,
  mapPlanExercise,
  mapWorkoutExerciseRecord,
  mapWorkoutSession,
  mapWorkoutSet,
  type ExerciseRow,
  type GroupMemberRow,
  type MemberProfileRow,
  type PlanExerciseRow,
  type WorkoutExerciseRecordRow,
  type WorkoutSessionRow,
  type WorkoutSetRow,
} from './mappers';

type DeletedEntity = {
  entityType: Extract<SyncEntityType, 'workoutSessions' | 'workoutExerciseRecords' | 'workoutSets'>;
  groupId?: string;
  localId: string;
  parentServerId?: string | null;
  remoteId?: string | null;
  sessionId?: string;
};

export class SQLiteWorkoutRepository implements WorkoutRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  private async getVisibleGroupOwnerUserId(groupId: string): Promise<string | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<{ owner_user_id: string | null }>(
      `SELECT owner_user_id FROM groups
       WHERE id = ?
         AND ${scope.where}
         AND deleted_at IS NULL
       LIMIT 1`,
      groupId,
      ...scope.params,
    );
    if (!row) {
      throw new Error(`Group not visible for current account: ${groupId}`);
    }
    return getOwnerUserIdForWrite(userId, row.owner_user_id);
  }

  private async getOwnedSessionRow(sessionId: string): Promise<WorkoutSessionRow | null> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    return db.getFirstAsync<WorkoutSessionRow>(
      `SELECT ws.* FROM workout_sessions ws
       INNER JOIN groups ON groups.id = ws.group_id
       WHERE ws.id = ?
         AND ${scope.where}
         AND ws.deleted_at IS NULL
         AND groups.deleted_at IS NULL`,
      sessionId,
      ...scope.params,
    );
  }

  private async enqueueDeletedEntities(entities: DeletedEntity[], updatedAt: string): Promise<void> {
    await Promise.all(
      entities.map((entity) =>
        enqueueSyncCandidate({
          entityType: entity.entityType,
          localId: entity.localId,
          operation: 'delete',
          payload: {
            groupId: entity.groupId,
            parentServerId: entity.parentServerId ?? entity.sessionId,
            sessionId: entity.sessionId,
          },
          remoteId: entity.remoteId ?? undefined,
          status: 'pending_delete',
          updatedAt,
        }).catch(() => undefined),
      ),
    );
  }

  private normalizeManualExercises(input: CreateManualSessionInput): ManualWorkoutExerciseInput[] {
    if (input.exercises?.length) {
      return input.exercises.map((exercise, index) => ({
        exerciseId: exercise.exerciseId,
        notes: exercise.notes,
        priority: exercise.priority ?? (index === 0 ? 'A' : index <= 2 ? 'B' : 'C'),
        restSeconds: exercise.restSeconds ?? input.restSeconds ?? null,
        sets: exercise.sets.length > 0
          ? exercise.sets
          : [{ completed: input.completed !== false, reps: input.reps, weight: input.weight }],
      }));
    }

    if (!input.exerciseId) {
      throw new Error('请至少选择一个动作。');
    }

    const setCount = Math.max(1, Math.min(20, Math.round(input.setCount ?? 1)));
    return [
      {
        exerciseId: input.exerciseId,
        priority: 'A',
        restSeconds: input.restSeconds ?? null,
        sets: Array.from({ length: setCount }, () => ({
          completed: input.completed !== false,
          reps: input.reps,
          weight: input.weight,
        })),
      },
    ];
  }

  async createSessionFromTodayPlan(input: CreateSessionFromTodayPlanInput): Promise<WorkoutSession> {
    const db = await this.getDb();
    const ownerUserId = await this.getVisibleGroupOwnerUserId(input.groupId);
    const now = nowIso();
    const trainingMode = input.trainingMode ?? 'group_local';
    let session: WorkoutSession | null = null;

    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await txn.getFirstAsync<WorkoutSessionRow>(
        `SELECT * FROM workout_sessions
         WHERE group_id = ? AND date = ? AND plan_id = ? AND week = ? AND weekday = ?
           AND training_mode = ? AND status IN ('draft', 'in_progress')
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 1`,
        input.groupId,
        input.date,
        input.planId,
        input.week,
        input.weekday,
        trainingMode,
      );

      if (existing) {
        session = mapWorkoutSession(existing);
        return;
      }

      let planExerciseRows: PlanExerciseRow[] = [];

      if (input.planExerciseIds?.length) {
        const placeholders = input.planExerciseIds.map(() => '?').join(', ');
        const rows = await txn.getAllAsync<PlanExerciseRow>(
          `SELECT * FROM plan_exercises WHERE id IN (${placeholders})`,
          ...input.planExerciseIds,
        );
        const byId = new Map(rows.map((row) => [row.id, row]));
        planExerciseRows = input.planExerciseIds
          .map((id) => byId.get(id))
          .filter((row): row is PlanExerciseRow => Boolean(row));
      } else {
        planExerciseRows = await txn.getAllAsync<PlanExerciseRow>(
          `SELECT pe.* FROM plan_exercises pe
           INNER JOIN plan_days pd ON pd.id = pe.plan_day_id
           WHERE pd.plan_id = ? AND pd.phase_id = ? AND pd.week = ? AND pd.weekday = ?
           ORDER BY pe.order_index ASC`,
          input.planId,
          input.phaseId ?? '',
          input.week,
          input.weekday,
        );
      }

      const planExercises = planExerciseRows.map(mapPlanExercise);
      if (planExercises.length === 0) {
        throw new Error('没有计划动作，无法创建训练。');
      }

      const memberRows = await txn.getAllAsync<GroupMemberRow>(
        'SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC',
        input.groupId,
      );
      const members = memberRows.map(mapGroupMember);
      const requestedParticipantIds = input.participantMemberIds?.length
        ? new Set(input.participantMemberIds)
        : null;
      const participantMembers = requestedParticipantIds
        ? members.filter((member) => requestedParticipantIds.has(member.id))
        : trainingMode === 'solo_local'
          ? members.slice(0, 1)
          : members;

      if (participantMembers.length === 0) {
        throw new Error('没有成员，无法创建训练。');
      }

      const profileRows = await txn.getAllAsync<MemberProfileRow>(
        'SELECT * FROM member_profiles WHERE group_id = ?',
        input.groupId,
      );
      const profilesByMemberId = new Map(
        profileRows.map((row) => [row.member_id, mapMemberProfile(row)]),
      );

      const exerciseIds = [...new Set(planExercises.map((exercise) => exercise.exerciseId))];
      const exercisePlaceholders = exerciseIds.map(() => '?').join(', ');
      const exerciseRows = await txn.getAllAsync<ExerciseRow>(
        `SELECT * FROM exercises WHERE id IN (${exercisePlaceholders})`,
        ...exerciseIds,
      );
      const exerciseById = new Map(exerciseRows.map((row) => [row.id, mapExercise(row)]));

      const createdSession: WorkoutSession = {
        id: createId('session'),
        groupId: input.groupId,
        planId: input.planId,
        phaseId: input.phaseId,
        date: input.date,
        week: input.week,
        weekday: input.weekday,
        title: input.title,
        status: 'in_progress',
        trainingMode,
        startedAt: now,
        createdAt: now,
        updatedAt: now,
      };

      await txn.runAsync(
        `INSERT INTO workout_sessions (
          id, owner_user_id, group_id, plan_id, phase_id, date, week, weekday, title,
          status, training_mode, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createdSession.id,
        ownerUserId,
        createdSession.groupId,
        createdSession.planId,
        createdSession.phaseId ?? null,
        createdSession.date,
        createdSession.week,
        createdSession.weekday,
        createdSession.title,
        createdSession.status,
        createdSession.trainingMode,
        createdSession.startedAt ?? null,
        null,
        createdSession.createdAt,
        createdSession.updatedAt,
      );

      for (const [index, planExercise] of planExercises.entries()) {
        const recordId = createId('exercise_record');
        await txn.runAsync(
          `INSERT INTO workout_exercise_records (
            id, owner_user_id, session_id, plan_exercise_id, exercise_id, order_index,
            replaced_from_exercise_id, priority, planned_sets, planned_reps,
            planned_rep_min, planned_rep_max, planned_rpe, planned_rir,
            planned_percent_1rm, planned_rest_seconds, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          recordId,
          ownerUserId,
          createdSession.id,
          planExercise.id,
          planExercise.exerciseId,
          index + 1,
          null,
          planExercise.priority,
          planExercise.sets ?? null,
          planExercise.reps ?? null,
          planExercise.repMin ?? null,
          planExercise.repMax ?? null,
          null,
          null,
          planExercise.percent1RM ?? null,
          planExercise.restSeconds ?? null,
          planExercise.notes ?? null,
        );

        const exercise = exerciseById.get(planExercise.exerciseId);
        const plannedReps = getPlanExerciseInitialReps(planExercise) ?? null;
        const setCount = getPlanExerciseSetCount(planExercise);

        for (const member of participantMembers) {
          const profile = profilesByMemberId.get(member.id);
          const suggestedWeight =
            profile && exercise
              ? calculateSuggestedWeight({
                  referenceLift: planExercise.referenceLift,
                  percent1RM: planExercise.percent1RM,
                  repMax: planExercise.repMax,
                  repMin: planExercise.repMin,
                  reps: planExercise.reps,
                  equipment: exercise.equipment,
                  profile,
                })
              : null;
          const suggestedPlannedWeight = suggestedWeight?.status === 'ready' ? suggestedWeight.weight : null;
          const latestWeightRow =
            suggestedPlannedWeight === null
              ? await txn.getFirstAsync<{ actual_weight: number | null }>(
                  `SELECT ws.actual_weight AS actual_weight
                   FROM workout_sets ws
                   INNER JOIN workout_exercise_records wer ON wer.id = ws.exercise_record_id
                   WHERE ws.member_id = ?
                     AND wer.exercise_id = ?
                     AND ws.completed = 1
                     AND ws.actual_weight IS NOT NULL
                     AND ws.deleted_at IS NULL
                     AND wer.deleted_at IS NULL
                   ORDER BY ws.updated_at DESC, ws.created_at DESC
                   LIMIT 1`,
                  member.id,
                  planExercise.exerciseId,
                )
              : null;
          const latestActualWeight =
            latestWeightRow?.actual_weight !== null &&
            latestWeightRow?.actual_weight !== undefined &&
            Number.isFinite(latestWeightRow.actual_weight)
              ? latestWeightRow.actual_weight
              : null;
          const plannedWeight = suggestedPlannedWeight ?? latestActualWeight;

          for (let setNumber = 1; setNumber <= setCount; setNumber += 1) {
            await txn.runAsync(
              `INSERT INTO workout_sets (
                id, owner_user_id, session_id, exercise_record_id, member_id, set_number,
                planned_weight, actual_weight, planned_reps, actual_reps,
                rpe, rir, actual_rest_seconds, completed, skipped, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              createId('set'),
              ownerUserId,
              createdSession.id,
              recordId,
              member.id,
              setNumber,
              plannedWeight,
              plannedWeight,
              plannedReps,
              plannedReps,
              null,
              null,
              null,
              0,
              0,
              null,
              now,
              now,
            );
          }
        }
      }

      session = createdSession;
    });

    if (!session) {
      throw new Error('训练未能创建。');
    }

    return session;
  }

  async createManualSessionV2(input: CreateManualSessionV2Input): Promise<WorkoutSession> {
    const db = await this.getDb();
    const ownerUserId = await this.getVisibleGroupOwnerUserId(input.groupId);
    const now = nowIso();
    const weekday = (new Date(`${input.date}T12:00:00`).getDay() || 7) as WorkoutSession['weekday'];
    const participantIds = [...new Set(input.participantMemberIds)];

    if (participantIds.length === 0) {
      throw new Error('请至少选择一位参与成员。');
    }

    if (input.exercises.length === 0) {
      throw new Error('请至少选择一个动作。');
    }

    const session: WorkoutSession = {
      id: createId('session'),
      groupId: input.groupId,
      planId: input.sourcePlanId ?? input.planId,
      date: input.date,
      week: 1,
      weekday,
      title: input.title.trim() || '补录训练',
      status: input.completed === false ? 'in_progress' : 'completed',
      trainingMode: input.trainingMode,
      startedAt: now,
      finishedAt: input.completed === false ? undefined : now,
      createdAt: now,
      updatedAt: now,
    };

    await db.withExclusiveTransactionAsync(async (txn) => {
      const memberRows = await txn.getAllAsync<{ id: string }>(
        `SELECT id FROM group_members
         WHERE group_id = ? AND deleted_at IS NULL`,
        input.groupId,
      );
      const visibleMemberIds = new Set(memberRows.map((member) => member.id));
      const invalidMemberId = participantIds.find((memberId) => !visibleMemberIds.has(memberId));
      if (invalidMemberId) {
        throw new Error(`成员不属于当前小组：${invalidMemberId}`);
      }

      await txn.runAsync(
        `INSERT INTO workout_sessions (
          id, owner_user_id, group_id, plan_id, phase_id, date, week, weekday, title,
          status, training_mode, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        ownerUserId,
        session.groupId,
        session.planId,
        null,
        session.date,
        session.week,
        session.weekday,
        session.title,
        session.status,
        session.trainingMode,
        session.startedAt ?? null,
        session.finishedAt ?? null,
        session.createdAt,
        session.updatedAt,
      );

      for (const [exerciseIndex, exercise] of input.exercises.entries()) {
        const recordId = createId('exercise_record');
        const setsByParticipant = exercise.memberSets.filter((memberSet) => participantIds.includes(memberSet.memberId));
        const plannedSets =
          exercise.plannedSets ??
          setsByParticipant.reduce((max, memberSet) => Math.max(max, memberSet.sets.length), 0);
        const firstSetWithReps = setsByParticipant.flatMap((memberSet) => memberSet.sets).find((set) => set.reps !== undefined);
        const plannedReps = exercise.plannedReps ?? firstSetWithReps?.reps ?? null;

        await txn.runAsync(
          `INSERT INTO workout_exercise_records (
            id, owner_user_id, session_id, plan_exercise_id, exercise_id, order_index,
            replaced_from_exercise_id, priority, planned_sets, planned_reps,
            planned_rep_min, planned_rep_max, planned_rpe, planned_rir,
            planned_percent_1rm, planned_rest_seconds, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          recordId,
          ownerUserId,
          session.id,
          null,
          exercise.exerciseId,
          exerciseIndex + 1,
          null,
          exercise.priority ?? (exerciseIndex === 0 ? 'A' : exerciseIndex <= 2 ? 'B' : 'C'),
          plannedSets || null,
          plannedReps,
          exercise.plannedRepMin ?? null,
          exercise.plannedRepMax ?? null,
          null,
          null,
          null,
          exercise.plannedRestSeconds ?? null,
          exercise.notes ?? input.notes ?? '历史补录',
        );

        for (const memberSet of setsByParticipant) {
          for (const [setIndex, set] of memberSet.sets.entries()) {
            const skipped = set.skipped === true;
            const completed = skipped ? false : set.completed !== false;
            await txn.runAsync(
              `INSERT INTO workout_sets (
                id, owner_user_id, session_id, exercise_record_id, member_id, set_number,
                planned_weight, actual_weight, planned_reps, actual_reps,
                rpe, rir, actual_rest_seconds, completed, skipped, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              createId('set'),
              ownerUserId,
              session.id,
              recordId,
              memberSet.memberId,
              set.setIndex ?? setIndex + 1,
              set.weight ?? null,
              set.weight ?? null,
              set.reps ?? null,
              set.reps ?? null,
              set.rpe ?? null,
              set.rir ?? null,
              null,
              completed ? 1 : 0,
              skipped ? 1 : 0,
              set.notes ?? null,
              now,
              now,
            );
          }
        }
      }
    });

    return session;
  }

  async createManualSession(input: CreateManualSessionInput): Promise<WorkoutSession> {
    const db = await this.getDb();
    const ownerUserId = await this.getVisibleGroupOwnerUserId(input.groupId);
    const now = nowIso();
    const weekday = (new Date(`${input.date}T12:00:00`).getDay() || 7) as WorkoutSession['weekday'];
    const manualExercises = this.normalizeManualExercises(input);
    const session: WorkoutSession = {
      id: createId('session'),
      groupId: input.groupId,
      planId: input.planId,
      date: input.date,
      week: 1,
      weekday,
      title: input.title.trim() || '补录训练',
      status: input.completed === false ? 'in_progress' : 'completed',
      trainingMode: 'solo_local',
      startedAt: now,
      finishedAt: input.completed === false ? undefined : now,
      createdAt: now,
      updatedAt: now,
    };

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO workout_sessions (
          id, owner_user_id, group_id, plan_id, phase_id, date, week, weekday, title,
          status, training_mode, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        ownerUserId,
        session.groupId,
        session.planId,
        null,
        session.date,
        session.week,
        session.weekday,
        session.title,
        session.status,
        session.trainingMode,
        session.startedAt ?? null,
        session.finishedAt ?? null,
        session.createdAt,
        session.updatedAt,
      );

      for (const [exerciseIndex, exercise] of manualExercises.entries()) {
        const recordId = createId('exercise_record');
        const plannedReps = exercise.sets[0]?.reps ?? input.reps ?? null;
        await txn.runAsync(
          `INSERT INTO workout_exercise_records (
            id, owner_user_id, session_id, plan_exercise_id, exercise_id, order_index,
            replaced_from_exercise_id, priority, planned_sets, planned_reps,
            planned_rep_min, planned_rep_max, planned_rpe, planned_rir,
            planned_percent_1rm, planned_rest_seconds, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          recordId,
          ownerUserId,
          session.id,
          null,
          exercise.exerciseId,
          exerciseIndex + 1,
          null,
          exercise.priority ?? 'A',
          exercise.sets.length,
          plannedReps,
          null,
          null,
          null,
          null,
          null,
          exercise.restSeconds ?? null,
          exercise.notes ?? '历史补录',
        );

        for (const [setIndex, set] of exercise.sets.entries()) {
          const skipped = set.skipped === true;
          const completed = skipped ? false : set.completed !== false;
          await txn.runAsync(
            `INSERT INTO workout_sets (
              id, owner_user_id, session_id, exercise_record_id, member_id, set_number,
              planned_weight, actual_weight, planned_reps, actual_reps,
              rpe, rir, actual_rest_seconds, completed, skipped, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            createId('set'),
            ownerUserId,
            session.id,
            recordId,
            input.memberId,
            setIndex + 1,
            set.weight ?? null,
            set.weight ?? null,
            set.reps ?? null,
            set.reps ?? null,
            set.rpe ?? null,
            set.rir ?? null,
            null,
            completed ? 1 : 0,
            skipped ? 1 : 0,
            set.notes ?? null,
            now,
            now,
          );
        }
      }
    });

    return session;
  }

  async getSession(sessionId: string): Promise<WorkoutSession | null> {
    const row = await this.getOwnedSessionRow(sessionId);
    return row ? mapWorkoutSession(row) : null;
  }

  async getSessionDetail(sessionId: string): Promise<WorkoutSessionDetail> {
    const db = await this.getDb();
    const session = await requireRow(await this.getSession(sessionId), `未找到训练：${sessionId}`);
    const exerciseRows = await db.getAllAsync<WorkoutExerciseRecordRow>(
      'SELECT * FROM workout_exercise_records WHERE session_id = ? AND deleted_at IS NULL ORDER BY order_index ASC',
      sessionId,
    );
    const setRows = await db.getAllAsync<WorkoutSetRow>(
      `SELECT ws.* FROM workout_sets ws
       INNER JOIN workout_exercise_records wer ON wer.id = ws.exercise_record_id
       INNER JOIN group_members gm ON gm.id = ws.member_id
       WHERE ws.session_id = ?
         AND ws.deleted_at IS NULL
         AND wer.deleted_at IS NULL
       ORDER BY wer.order_index ASC, gm.created_at ASC, ws.set_number ASC`,
      sessionId,
    );

    return {
      session,
      exercises: exerciseRows.map(mapWorkoutExerciseRecord),
      sets: setRows.map(mapWorkoutSet),
    };
  }

  async listOpenSessionsForDate(input: ListOpenWorkoutSessionsForDateInput): Promise<WorkoutSession[]> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const rows = await db.getAllAsync<WorkoutSessionRow>(
      `SELECT ws.* FROM workout_sessions ws
       INNER JOIN groups ON groups.id = ws.group_id
       WHERE ws.group_id = ? AND ws.date = ? AND ws.status IN ('draft', 'in_progress')
         AND ${scope.where}
         AND ws.deleted_at IS NULL
         AND groups.deleted_at IS NULL
       ORDER BY ws.updated_at DESC, ws.created_at DESC`,
      input.groupId,
      input.date,
      ...scope.params,
    );
    return rows.map(mapWorkoutSession);
  }

  async updateSession(input: UpdateWorkoutSessionInput): Promise<WorkoutSession> {
    const db = await this.getDb();
    const current = await requireRow(await this.getSession(input.id), `未找到训练：${input.id}`);
    const nextDate = input.date ?? current.date;
    const nextWeekday = (new Date(`${nextDate}T12:00:00`).getDay() || 7) as WorkoutSession['weekday'];
    const updated: WorkoutSession = {
      ...current,
      ...input,
      date: nextDate,
      weekday: nextWeekday,
      updatedAt: nowIso(),
    };

    await db.runAsync(
      `UPDATE workout_sessions
       SET date = ?, weekday = ?, title = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      updated.date,
      updated.weekday,
      updated.title,
      updated.status,
      updated.updatedAt,
      updated.id,
    );

    return updated;
  }

  async addExerciseToSession(input: AddWorkoutExerciseInput): Promise<WorkoutSessionDetail> {
    const db = await this.getDb();
    const session = await requireRow(await this.getSession(input.sessionId), `未找到训练：${input.sessionId}`);
    const now = nowIso();
    const ownerUserId = await this.getVisibleGroupOwnerUserId(session.groupId);
    const sets = input.sets?.length ? input.sets : [{ completed: true }];
    const memberIds = input.memberIds?.length ? input.memberIds : [input.memberId];

    await db.withExclusiveTransactionAsync(async (txn) => {
      const orderRow = await txn.getFirstAsync<{ max_order: number | null }>(
        'SELECT MAX(order_index) AS max_order FROM workout_exercise_records WHERE session_id = ?',
        input.sessionId,
      );
      const recordId = createId('exercise_record');
      const plannedReps = sets[0]?.reps ?? null;
      const nextOrderIndex = input.insertOrderIndex
        ? Math.max(1, Math.round(input.insertOrderIndex))
        : (orderRow?.max_order ?? 0) + 1;

      if (input.insertOrderIndex) {
        await txn.runAsync(
          `UPDATE workout_exercise_records
           SET order_index = order_index + 1
           WHERE session_id = ? AND order_index >= ?`,
          input.sessionId,
          nextOrderIndex,
        );
      }

      await txn.runAsync(
        `INSERT INTO workout_exercise_records (
          id, owner_user_id, session_id, plan_exercise_id, exercise_id, order_index,
          replaced_from_exercise_id, priority, planned_sets, planned_reps,
          planned_rep_min, planned_rep_max, planned_rpe, planned_rir,
          planned_percent_1rm, planned_rest_seconds, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        recordId,
        ownerUserId,
        session.id,
        null,
        input.exerciseId,
        nextOrderIndex,
        null,
        input.priority ?? 'B',
        sets.length,
        plannedReps,
        null,
        null,
        null,
        null,
        null,
        null,
        input.notes ?? '编辑记录新增动作',
      );

      for (const memberId of memberIds) {
        for (const [index, set] of sets.entries()) {
          await txn.runAsync(
            `INSERT INTO workout_sets (
              id, owner_user_id, session_id, exercise_record_id, member_id, set_number,
              planned_weight, actual_weight, planned_reps, actual_reps,
              rpe, rir, actual_rest_seconds, completed, skipped, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            createId('set'),
            ownerUserId,
            session.id,
            recordId,
            memberId,
            index + 1,
            set.weight ?? null,
            set.weight ?? null,
            set.reps ?? null,
            set.reps ?? null,
            null,
            null,
            null,
            set.completed === false ? 0 : 1,
            0,
            set.notes ?? null,
            now,
            now,
          );
        }
      }
    });

    return this.getSessionDetail(input.sessionId);
  }

  async addSetToExerciseRecord(input: AddWorkoutSetInput): Promise<WorkoutSet> {
    const db = await this.getDb();
    const now = nowIso();
    const session = await requireRow(await this.getSession(input.sessionId), `Workout session not visible: ${input.sessionId}`);
    const ownerUserId = await this.getVisibleGroupOwnerUserId(session.groupId);
    const record = await requireRow(
      await db.getFirstAsync<WorkoutExerciseRecordRow>(
        'SELECT * FROM workout_exercise_records WHERE id = ? AND session_id = ? AND deleted_at IS NULL',
        input.exerciseRecordId,
        input.sessionId,
      ),
      `未找到动作记录：${input.exerciseRecordId}`,
    );
    const setNumberRow = await db.getFirstAsync<{ max_set_number: number | null }>(
      'SELECT MAX(set_number) AS max_set_number FROM workout_sets WHERE exercise_record_id = ? AND member_id = ? AND deleted_at IS NULL',
      input.exerciseRecordId,
      input.memberId,
    );
    const setRow: WorkoutSetRow = {
      id: createId('set'),
      session_id: input.sessionId,
      exercise_record_id: record.id,
      member_id: input.memberId,
      set_number: (setNumberRow?.max_set_number ?? 0) + 1,
      planned_weight: input.weight ?? null,
      actual_weight: input.weight ?? null,
      planned_reps: input.reps ?? null,
      actual_reps: input.reps ?? null,
      rpe: null,
      rir: null,
      actual_rest_seconds: null,
      completed: input.completed === false ? 0 : 1,
      skipped: 0,
      notes: input.notes ?? null,
      created_at: now,
      updated_at: now,
    };

    await db.runAsync(
      `INSERT INTO workout_sets (
        id, owner_user_id, session_id, exercise_record_id, member_id, set_number,
        planned_weight, actual_weight, planned_reps, actual_reps,
        rpe, rir, actual_rest_seconds, completed, skipped, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      setRow.id,
      ownerUserId,
      setRow.session_id,
      setRow.exercise_record_id,
      setRow.member_id,
      setRow.set_number,
      setRow.planned_weight,
      setRow.actual_weight,
      setRow.planned_reps,
      setRow.actual_reps,
      null,
      null,
      null,
      setRow.completed,
      0,
      setRow.notes,
      now,
      now,
    );

    return mapWorkoutSet(setRow);
  }

  async updateExerciseRecordExercise(recordId: string, exerciseId: string, notes?: string): Promise<void> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const record = await db.getFirstAsync<{ id: string }>(
      `SELECT record.id FROM workout_exercise_records record
       INNER JOIN workout_sessions session ON session.id = record.session_id
       INNER JOIN groups ON groups.id = session.group_id
       WHERE record.id = ?
         AND ${scope.where}
         AND record.deleted_at IS NULL
         AND session.deleted_at IS NULL
         AND groups.deleted_at IS NULL
       LIMIT 1`,
      recordId,
      ...scope.params,
    );
    if (!record) {
      throw new Error(`Workout exercise record not visible for current account: ${recordId}`);
    }
    await db.runAsync(
      `UPDATE workout_exercise_records
       SET exercise_id = ?,
            replaced_from_exercise_id = COALESCE(replaced_from_exercise_id, exercise_id),
            notes = COALESCE(?, notes)
       WHERE id = ?`,
      exerciseId,
      notes ?? null,
      recordId,
    );
  }

  async saveSet(input: SaveWorkoutSetInput): Promise<WorkoutSet> {
    validateWorkoutSetInput(input);

    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const current = await requireRow(
      await db.getFirstAsync<WorkoutSetRow>(
        `SELECT ws.* FROM workout_sets ws
         INNER JOIN workout_sessions session ON session.id = ws.session_id
         INNER JOIN groups ON groups.id = session.group_id
         WHERE ws.id = ?
           AND ${scope.where}
           AND ws.deleted_at IS NULL
           AND session.deleted_at IS NULL
           AND groups.deleted_at IS NULL`,
        input.id,
        ...scope.params,
      ),
      `未找到训练组：${input.id}`,
    );
    const updated = {
      ...mapWorkoutSet(current),
      ...input,
      id: current.id,
      sessionId: current.session_id,
      exerciseRecordId: current.exercise_record_id,
      memberId: current.member_id,
      setNumber: current.set_number,
      createdAt: current.created_at,
      updatedAt: nowIso(),
    };

    await db.runAsync(
      `UPDATE workout_sets
       SET actual_weight = ?, actual_reps = ?, rpe = ?, rir = ?,
           actual_rest_seconds = ?, completed = ?, skipped = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      updated.actualWeight ?? null,
      updated.actualReps ?? null,
      updated.rpe ?? null,
      updated.rir ?? null,
      updated.actualRestSeconds ?? null,
      updated.completed ? 1 : 0,
      updated.skipped ? 1 : 0,
      updated.notes ?? null,
      updated.updatedAt,
      input.id,
    );

    return updated;
  }

  async deleteSet(setId: string): Promise<void> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const row = await db.getFirstAsync<{
      exercise_record_id: string;
      group_id: string;
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT ws.id, ws.remote_id, ws.session_id, ws.exercise_record_id, session.group_id
       FROM workout_sets ws
       INNER JOIN workout_sessions session ON session.id = ws.session_id
       INNER JOIN groups ON groups.id = session.group_id
       WHERE ws.id = ?
         AND ${scope.where}
         AND ws.deleted_at IS NULL
         AND session.deleted_at IS NULL
         AND groups.deleted_at IS NULL`,
      setId,
      ...scope.params,
    );

    if (!row) {
      return;
    }

    const now = nowIso();
    await db.runAsync(
      `UPDATE workout_sets
       SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
       WHERE id = ?`,
      now,
      now,
      setId,
    );

    await this.enqueueDeletedEntities(
      [{
        entityType: 'workoutSets',
        groupId: row.group_id,
        localId: row.id,
        parentServerId: row.session_id,
        remoteId: row.remote_id,
        sessionId: row.session_id,
      }],
      now,
    );
    await this.cleanupEmptyExerciseRecords(row.session_id);
  }

  async deleteMemberSet(setId: string, memberId: string): Promise<void> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM workout_sets WHERE id = ? AND member_id = ? AND deleted_at IS NULL',
      setId,
      memberId,
    );

    if (!row) {
      return;
    }

    await this.deleteSet(setId);
  }

  async deleteExerciseRecord(recordId: string): Promise<void> {
    const db = await this.getDb();
    const now = nowIso();
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');
    const record = await db.getFirstAsync<{
      group_id: string;
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT record.id, record.remote_id, record.session_id, session.group_id
       FROM workout_exercise_records record
       INNER JOIN workout_sessions session ON session.id = record.session_id
       INNER JOIN groups ON groups.id = session.group_id
       WHERE record.id = ?
         AND ${scope.where}
         AND record.deleted_at IS NULL
         AND session.deleted_at IS NULL
         AND groups.deleted_at IS NULL`,
      recordId,
      ...scope.params,
    );
    if (!record) {
      return;
    }

    const setRows = await db.getAllAsync<{
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT id, remote_id, session_id
       FROM workout_sets
       WHERE exercise_record_id = ? AND deleted_at IS NULL`,
      recordId,
    );

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE workout_sets
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE exercise_record_id = ? AND deleted_at IS NULL`,
        now,
        now,
        recordId,
      );
      await txn.runAsync(
        `UPDATE workout_exercise_records
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE id = ?`,
        now,
        now,
        recordId,
      );
    });

    await this.enqueueDeletedEntities(
      [
        ...setRows.map((set) => ({
          entityType: 'workoutSets' as const,
          groupId: record.group_id,
          localId: set.id,
          parentServerId: record.session_id,
          remoteId: set.remote_id,
          sessionId: set.session_id,
        })),
        {
          entityType: 'workoutExerciseRecords',
          groupId: record.group_id,
          localId: record.id,
          parentServerId: record.session_id,
          remoteId: record.remote_id,
          sessionId: record.session_id,
        },
      ],
      now,
    );
    await this.cleanupEmptyExerciseRecords(record.session_id);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.deleteSessionCascade(sessionId);
  }

  async deleteMemberSetsInSession(sessionId: string, memberId: string): Promise<void> {
    const db = await this.getDb();
    const now = nowIso();
    const visibleSession = await this.getSession(sessionId);
    if (!visibleSession) {
      return;
    }
    const setRows = await db.getAllAsync<{
      group_id: string;
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT ws.id, ws.remote_id, ws.session_id, session.group_id
       FROM workout_sets ws
       INNER JOIN workout_sessions session ON session.id = ws.session_id
       WHERE ws.session_id = ? AND ws.member_id = ? AND ws.deleted_at IS NULL`,
      sessionId,
      memberId,
    );

    if (setRows.length === 0) {
      return;
    }

    await db.runAsync(
      `UPDATE workout_sets
       SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
       WHERE session_id = ? AND member_id = ? AND deleted_at IS NULL`,
      now,
      now,
      sessionId,
      memberId,
    );

    await this.enqueueDeletedEntities(
      setRows.map((set) => ({
        entityType: 'workoutSets',
        groupId: set.group_id,
        localId: set.id,
        parentServerId: sessionId,
        remoteId: set.remote_id,
        sessionId,
      })),
      now,
    );
    await this.cleanupEmptyExerciseRecords(sessionId);
  }

  async deleteSessionCascade(sessionId: string): Promise<void> {
    const db = await this.getDb();
    const now = nowIso();
    const visibleSession = await this.getSession(sessionId);
    if (!visibleSession) {
      return;
    }
    const session = await db.getFirstAsync<{
      group_id: string;
      id: string;
      remote_id: string | null;
    }>(
      `SELECT id, remote_id, group_id
       FROM workout_sessions
       WHERE id = ? AND deleted_at IS NULL`,
      sessionId,
    );
    if (!session) {
      return;
    }

    const recordRows = await db.getAllAsync<{
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT id, remote_id, session_id
       FROM workout_exercise_records
       WHERE session_id = ? AND deleted_at IS NULL`,
      sessionId,
    );
    const setRows = await db.getAllAsync<{
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT id, remote_id, session_id
       FROM workout_sets
       WHERE session_id = ? AND deleted_at IS NULL`,
      sessionId,
    );

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `UPDATE workout_sets
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE session_id = ? AND deleted_at IS NULL`,
        now,
        now,
        sessionId,
      );
      await txn.runAsync(
        `UPDATE workout_exercise_records
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE session_id = ? AND deleted_at IS NULL`,
        now,
        now,
        sessionId,
      );
      await txn.runAsync(
        `UPDATE workout_sessions
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE id = ?`,
        now,
        now,
        sessionId,
      );
    });

    await this.enqueueDeletedEntities(
      [
        ...setRows.map((set) => ({
          entityType: 'workoutSets' as const,
          groupId: session.group_id,
          localId: set.id,
          parentServerId: sessionId,
          remoteId: set.remote_id,
          sessionId,
        })),
        ...recordRows.map((record) => ({
          entityType: 'workoutExerciseRecords' as const,
          groupId: session.group_id,
          localId: record.id,
          parentServerId: sessionId,
          remoteId: record.remote_id,
          sessionId,
        })),
        {
          entityType: 'workoutSessions',
          groupId: session.group_id,
          localId: session.id,
          remoteId: session.remote_id,
          sessionId,
        },
      ],
      now,
    );
  }

  async cleanupEmptyExerciseRecords(sessionId: string): Promise<void> {
    const db = await this.getDb();
    const now = nowIso();
    const visibleSession = await this.getSession(sessionId);
    if (!visibleSession) {
      return;
    }
    const session = await db.getFirstAsync<{
      group_id: string;
      id: string;
      remote_id: string | null;
    }>(
      `SELECT id, remote_id, group_id
       FROM workout_sessions
       WHERE id = ? AND deleted_at IS NULL`,
      sessionId,
    );
    if (!session) {
      return;
    }

    const emptyRecords = await db.getAllAsync<{
      id: string;
      remote_id: string | null;
      session_id: string;
    }>(
      `SELECT record.id, record.remote_id, record.session_id
       FROM workout_exercise_records record
       WHERE record.session_id = ?
         AND record.deleted_at IS NULL
         AND NOT EXISTS (
           SELECT 1 FROM workout_sets ws
           WHERE ws.exercise_record_id = record.id
             AND ws.deleted_at IS NULL
         )`,
      sessionId,
    );

    if (emptyRecords.length > 0) {
      const placeholders = emptyRecords.map(() => '?').join(', ');
      await db.runAsync(
        `UPDATE workout_exercise_records
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE id IN (${placeholders})`,
        now,
        now,
        ...emptyRecords.map((record) => record.id),
      );
      await this.enqueueDeletedEntities(
        emptyRecords.map((record) => ({
          entityType: 'workoutExerciseRecords',
          groupId: session.group_id,
          localId: record.id,
          parentServerId: sessionId,
          remoteId: record.remote_id,
          sessionId,
        })),
        now,
      );
    }

    const remainingSets = await db.getFirstAsync<{ count: number }>(
      `SELECT COUNT(*) AS count
       FROM workout_sets
       WHERE session_id = ? AND deleted_at IS NULL`,
      sessionId,
    );

    if ((remainingSets?.count ?? 0) === 0) {
      await db.runAsync(
        `UPDATE workout_sessions
         SET deleted_at = ?, sync_status = 'pending_delete', updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`,
        now,
        now,
        sessionId,
      );
      await this.enqueueDeletedEntities(
        [{
          entityType: 'workoutSessions',
          groupId: session.group_id,
          localId: session.id,
          remoteId: session.remote_id,
          sessionId,
        }],
        now,
      );
    }
  }

  async getSessionAggregation(sessionId: string): Promise<WorkoutSessionAggregation> {
    const db = await this.getDb();
    const visibleSession = await this.getSession(sessionId);
    if (!visibleSession) {
      throw new Error(`Workout session not visible for current account: ${sessionId}`);
    }
    const rows = await db.getAllAsync<{
      completed_sets: number;
      member_id: string;
      session_count: number;
      total_sets: number;
      volume: number;
    }>(
      `SELECT
        member_id,
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_sets,
        COUNT(*) AS total_sets,
        COUNT(DISTINCT session_id) AS session_count,
        SUM(
          CASE
            WHEN completed = 1 THEN
              COALESCE(actual_weight, planned_weight, 0) * COALESCE(actual_reps, planned_reps, 0)
            ELSE 0
          END
        ) AS volume
       FROM workout_sets
       WHERE session_id = ? AND deleted_at IS NULL
       GROUP BY member_id`,
      sessionId,
    );

    const memberContributions = rows.map((row) => ({
      completedSets: row.completed_sets ?? 0,
      memberId: row.member_id,
      sessionCount: row.session_count ?? 0,
      totalSets: row.total_sets ?? 0,
      volume: row.volume ?? 0,
    }));

    return {
      completedSets: memberContributions.reduce((sum, item) => sum + item.completedSets, 0),
      memberContributions,
      participantCount: memberContributions.filter((item) => item.completedSets > 0).length,
      sessionId,
      totalSets: memberContributions.reduce((sum, item) => sum + item.totalSets, 0),
      totalVolume: memberContributions.reduce((sum, item) => sum + item.volume, 0),
    };
  }

  async finishSession(sessionId: string): Promise<WorkoutSummary> {
    const db = await this.getDb();
    const now = nowIso();
    const visibleSession = await this.getSession(sessionId);
    if (!visibleSession) {
      throw new Error(`Workout session not visible for current account: ${sessionId}`);
    }
    await db.runAsync(
      `UPDATE workout_sessions
       SET status = ?, finished_at = ?, updated_at = ?
       WHERE id = ?`,
      'completed',
      now,
      now,
      sessionId,
    );
    const counts = await db.getFirstAsync<{ completed_sets: number; total_sets: number }>(
      `SELECT
        SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) AS completed_sets,
        COUNT(*) AS total_sets
       FROM workout_sets
       WHERE session_id = ? AND deleted_at IS NULL`,
      sessionId,
    );

    return {
      sessionId,
      completedSets: counts?.completed_sets ?? 0,
      totalSets: counts?.total_sets ?? 0,
    };
  }

  async listHistorySessionsByScope(input: ListHistorySessionsByScopeInput): Promise<WorkoutSession[]> {
    return this.listSessions({
      fromDate: input.fromDate,
      groupId: input.groupId,
      limit: input.limit,
      memberId: input.scope === 'personal' ? input.memberId : undefined,
      toDate: input.toDate,
    });
  }

  async listSessions(input: ListSessionsInput): Promise<WorkoutSession[]> {
    const db = await this.getDb();
    const limit = input.limit ?? 50;
    const userId = await getCurrentAccountUserId();
    const scope = getGroupAccountScope(userId, 'groups');

    const clauses: string[] = [];
    const params: (number | string)[] = [];

    if (input.groupId) {
      clauses.push('ws.group_id = ?');
      params.push(input.groupId);
    }

    if (input.memberId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM workout_sets member_sets
        WHERE member_sets.session_id = ws.id
          AND member_sets.member_id = ?
          AND member_sets.deleted_at IS NULL
      )`);
      params.push(input.memberId);
    }

    if (input.fromDate) {
      clauses.push('ws.date >= ?');
      params.push(input.fromDate);
    }

    if (input.toDate) {
      clauses.push('ws.date <= ?');
      params.push(input.toDate);
    }

    clauses.push('ws.deleted_at IS NULL');
    clauses.push('groups.deleted_at IS NULL');
    clauses.push(scope.where);
    params.push(...scope.params);

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<WorkoutSessionRow>(
      `SELECT ws.* FROM workout_sessions ws
       INNER JOIN groups ON groups.id = ws.group_id
       ${where}
       ORDER BY ws.date DESC, ws.updated_at DESC
       LIMIT ?`,
      ...params,
      limit,
    );
    return rows.map(mapWorkoutSession);
  }
}
