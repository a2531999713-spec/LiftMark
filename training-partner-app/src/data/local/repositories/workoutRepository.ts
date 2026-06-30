import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { WorkoutRepository } from '@/data/repositories/workoutRepository';
import { calculateSuggestedWeight } from '@/domain/weight/weight-calculator';
import { getPlanExerciseInitialReps, getPlanExerciseSetCount } from '@/domain/workout/workout.service';
import type {
  CreateSessionFromTodayPlanInput,
  CreateManualSessionInput,
  ListOpenWorkoutSessionsForDateInput,
  ListSessionsInput,
  SaveWorkoutSetInput,
  UpdateWorkoutSessionInput,
  WorkoutSession,
  WorkoutSessionDetail,
  WorkoutSet,
  WorkoutSummary,
} from '@/domain/workout/workout.types';
import { validateWorkoutSetInput } from '@/domain/workout/workout.validation';

import { requireRow, type DatabaseProvider } from './base';
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

export class SQLiteWorkoutRepository implements WorkoutRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async createSessionFromTodayPlan(input: CreateSessionFromTodayPlanInput): Promise<WorkoutSession> {
    const db = await this.getDb();
    const now = nowIso();
    const trainingMode = input.trainingMode ?? 'group_local';
    let session: WorkoutSession | null = null;

    await db.withExclusiveTransactionAsync(async (txn) => {
      const existing = await txn.getFirstAsync<WorkoutSessionRow>(
        `SELECT * FROM workout_sessions
         WHERE group_id = ? AND date = ? AND plan_id = ? AND week = ? AND weekday = ?
           AND training_mode = ? AND status IN ('draft', 'in_progress')
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
          id, group_id, plan_id, phase_id, date, week, weekday, title,
          status, training_mode, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        createdSession.id,
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
            id, session_id, plan_exercise_id, exercise_id, order_index,
            replaced_from_exercise_id, priority, planned_sets, planned_reps,
            planned_rep_min, planned_rep_max, planned_rpe, planned_rir,
            planned_percent_1rm, planned_rest_seconds, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          recordId,
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
          const plannedWeight = suggestedWeight?.status === 'ready' ? suggestedWeight.weight : null;

          for (let setNumber = 1; setNumber <= setCount; setNumber += 1) {
            await txn.runAsync(
              `INSERT INTO workout_sets (
                id, session_id, exercise_record_id, member_id, set_number,
                planned_weight, actual_weight, planned_reps, actual_reps,
                rpe, rir, completed, skipped, notes, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              createId('set'),
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

  async createManualSession(input: CreateManualSessionInput): Promise<WorkoutSession> {
    const db = await this.getDb();
    const now = nowIso();
    const weekday = (new Date(`${input.date}T12:00:00`).getDay() || 7) as WorkoutSession['weekday'];
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
    const recordId = createId('exercise_record');
    const setCount = Math.max(1, Math.min(10, Math.round(input.setCount)));

    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync(
        `INSERT INTO workout_sessions (
          id, group_id, plan_id, phase_id, date, week, weekday, title,
          status, training_mode, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
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

      await txn.runAsync(
        `INSERT INTO workout_exercise_records (
          id, session_id, plan_exercise_id, exercise_id, order_index,
          replaced_from_exercise_id, priority, planned_sets, planned_reps,
          planned_rep_min, planned_rep_max, planned_rpe, planned_rir,
          planned_percent_1rm, planned_rest_seconds, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        recordId,
        session.id,
        null,
        input.exerciseId,
        1,
        null,
        'A',
        setCount,
        input.reps ?? null,
        null,
        null,
        null,
        null,
        null,
        input.restSeconds ?? null,
        '历史补录',
      );

      for (let setNumber = 1; setNumber <= setCount; setNumber += 1) {
        await txn.runAsync(
          `INSERT INTO workout_sets (
            id, session_id, exercise_record_id, member_id, set_number,
            planned_weight, actual_weight, planned_reps, actual_reps,
            rpe, rir, completed, skipped, notes, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createId('set'),
          session.id,
          recordId,
          input.memberId,
          setNumber,
          input.weight ?? null,
          input.weight ?? null,
          input.reps ?? null,
          input.reps ?? null,
          null,
          null,
          input.completed === false ? 0 : 1,
          0,
          null,
          now,
          now,
        );
      }
    });

    return session;
  }

  async getSession(sessionId: string): Promise<WorkoutSession | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<WorkoutSessionRow>(
      'SELECT * FROM workout_sessions WHERE id = ?',
      sessionId,
    );
    return row ? mapWorkoutSession(row) : null;
  }

  async getSessionDetail(sessionId: string): Promise<WorkoutSessionDetail> {
    const db = await this.getDb();
    const session = await requireRow(await this.getSession(sessionId), `未找到训练：${sessionId}`);
    const exerciseRows = await db.getAllAsync<WorkoutExerciseRecordRow>(
      'SELECT * FROM workout_exercise_records WHERE session_id = ? ORDER BY order_index ASC',
      sessionId,
    );
    const setRows = await db.getAllAsync<WorkoutSetRow>(
      `SELECT ws.* FROM workout_sets ws
       INNER JOIN workout_exercise_records wer ON wer.id = ws.exercise_record_id
       INNER JOIN group_members gm ON gm.id = ws.member_id
       WHERE ws.session_id = ?
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
    const rows = await db.getAllAsync<WorkoutSessionRow>(
      `SELECT * FROM workout_sessions
       WHERE group_id = ? AND date = ? AND status IN ('draft', 'in_progress')
       ORDER BY updated_at DESC, created_at DESC`,
      input.groupId,
      input.date,
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

  async updateExerciseRecordExercise(recordId: string, exerciseId: string): Promise<void> {
    const db = await this.getDb();
    await db.runAsync(
      `UPDATE workout_exercise_records
       SET exercise_id = ?
       WHERE id = ?`,
      exerciseId,
      recordId,
    );
  }

  async saveSet(input: SaveWorkoutSetInput): Promise<WorkoutSet> {
    validateWorkoutSetInput(input);

    const db = await this.getDb();
    const current = await requireRow(
      await db.getFirstAsync<WorkoutSetRow>('SELECT * FROM workout_sets WHERE id = ?', input.id),
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
           completed = ?, skipped = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      updated.actualWeight ?? null,
      updated.actualReps ?? null,
      updated.rpe ?? null,
      updated.rir ?? null,
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
    await db.runAsync('DELETE FROM workout_sets WHERE id = ?', setId);
  }

  async deleteExerciseRecord(recordId: string): Promise<void> {
    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM workout_sets WHERE exercise_record_id = ?', recordId);
      await txn.runAsync('DELETE FROM workout_exercise_records WHERE id = ?', recordId);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const db = await this.getDb();
    await db.withExclusiveTransactionAsync(async (txn) => {
      await txn.runAsync('DELETE FROM workout_sets WHERE session_id = ?', sessionId);
      await txn.runAsync('DELETE FROM workout_exercise_records WHERE session_id = ?', sessionId);
      await txn.runAsync('DELETE FROM workout_sessions WHERE id = ?', sessionId);
    });
  }

  async finishSession(sessionId: string): Promise<WorkoutSummary> {
    const db = await this.getDb();
    const now = nowIso();
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
       WHERE session_id = ?`,
      sessionId,
    );

    return {
      sessionId,
      completedSets: counts?.completed_sets ?? 0,
      totalSets: counts?.total_sets ?? 0,
    };
  }

  async listSessions(input: ListSessionsInput): Promise<WorkoutSession[]> {
    const db = await this.getDb();
    const limit = input.limit ?? 50;

    const clauses: string[] = [];
    const params: (number | string)[] = [];

    if (input.groupId) {
      clauses.push('ws.group_id = ?');
      params.push(input.groupId);
    }

    if (input.memberId) {
      clauses.push(`EXISTS (
        SELECT 1 FROM workout_sets member_sets
        WHERE member_sets.session_id = ws.id AND member_sets.member_id = ?
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

    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = await db.getAllAsync<WorkoutSessionRow>(
      `SELECT ws.* FROM workout_sessions ws
       ${where}
       ORDER BY ws.date DESC, ws.updated_at DESC
       LIMIT ?`,
      ...params,
      limit,
    );
    return rows.map(mapWorkoutSession);
  }
}
