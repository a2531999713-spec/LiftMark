import { describe, expect, it, jest } from '@jest/globals';

import { SQLiteWorkoutRepository } from '@/data/local/repositories/workoutRepository';

jest.mock('@/domain/common/ids', () => ({
  createId: (prefix?: string) => `${prefix ?? 'id'}_test`,
}));

jest.mock('@/domain/common/time', () => ({
  nowIso: () => '2026-06-30T00:00:00.000Z',
}));

const planExerciseRow = {
  id: 'plan_exercise_selected',
  plan_day_id: 'plan_day_week_8_day_3',
  exercise_id: 'exercise_bench',
  priority: 'A',
  order_index: 1,
  sets: 3,
  reps: 5,
  rep_min: null,
  rep_max: null,
  intensity_type: 'manual',
  percent_1rm: null,
  rpe_target: null,
  rir_target: null,
  fixed_weight: null,
  reference_lift: undefined,
  rest_seconds: 120,
  progression_rule_id: null,
  notes: null,
};

const memberRow = {
  id: 'member_1',
  group_id: 'group_1',
  display_name: '成员一',
  role: 'owner',
  avatar_url: null,
  created_at: '2026-06-30T00:00:00.000Z',
  updated_at: '2026-06-30T00:00:00.000Z',
};

const exerciseRow = {
  id: 'exercise_bench',
  name: '杠铃卧推',
  source: 'system',
  category: 'strength',
  movement_pattern: 'horizontal_push',
  target_muscle: '胸',
  secondary_muscle: null,
  equipment: 'barbell',
  difficulty: 'beginner',
  notes: null,
  created_at: '2026-06-30T00:00:00.000Z',
  updated_at: '2026-06-30T00:00:00.000Z',
};

const openSessionRow = {
  id: 'session_open',
  group_id: 'group_1',
  plan_id: 'plan_current',
  phase_id: 'phase_strength',
  date: '2026-06-30',
  week: 8,
  weekday: 3,
  title: '第 8 周 Day 3',
  status: 'in_progress',
  training_mode: 'group_local',
  started_at: '2026-06-30T00:00:00.000Z',
  finished_at: null,
  created_at: '2026-06-30T00:00:00.000Z',
  updated_at: '2026-06-30T00:00:00.000Z',
};

describe('SQLiteWorkoutRepository.createSessionFromTodayPlan', () => {
  it('uses the selected week and weekday when creating the workout session snapshot', async () => {
    const planDayQueryParams: unknown[][] = [];
    const insertedSessionParams: unknown[][] = [];
    const transaction = {
      getFirstAsync: jest.fn(async () => null),
      getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('FROM plan_exercises')) {
          planDayQueryParams.push(params);
          return [planExerciseRow];
        }

        if (sql.includes('FROM group_members')) {
          return [memberRow];
        }

        if (sql.includes('FROM member_profiles')) {
          return [];
        }

        if (sql.includes('FROM exercises')) {
          return [exerciseRow];
        }

        return [];
      }),
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('INSERT INTO workout_sessions')) {
          insertedSessionParams.push(params);
        }
      }),
    };
    const db = {
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    const session = await new SQLiteWorkoutRepository(async () => db as never).createSessionFromTodayPlan({
      date: '2026-06-30',
      groupId: 'group_1',
      phaseId: 'phase_strength',
      planId: 'plan_current',
      title: '第 8 周 Day 3',
      trainingMode: 'group_local',
      week: 8,
      weekday: 3,
    });

    expect(planDayQueryParams[0]).toEqual(['plan_current', 'phase_strength', 8, 3]);
    expect(session.week).toBe(8);
    expect(session.weekday).toBe(3);
    expect(insertedSessionParams[0][5]).toBe(8);
    expect(insertedSessionParams[0][6]).toBe(3);
  });

  it('uses selected plan exercise ids instead of falling back to a hardcoded plan day', async () => {
    const selectedIds: string[] = [];
    const transaction = {
      getFirstAsync: jest.fn(async () => null),
      getAllAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('SELECT * FROM plan_exercises WHERE id IN')) {
          selectedIds.push(...(params as string[]));
          return [planExerciseRow];
        }

        if (sql.includes('FROM group_members')) return [memberRow];
        if (sql.includes('FROM member_profiles')) return [];
        if (sql.includes('FROM exercises')) return [exerciseRow];
        return [];
      }),
      runAsync: jest.fn(async () => undefined),
    };
    const db = {
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    const session = await new SQLiteWorkoutRepository(async () => db as never).createSessionFromTodayPlan({
      date: '2026-06-30',
      groupId: 'group_1',
      phaseId: 'phase_strength',
      planExerciseIds: ['plan_exercise_selected'],
      planId: 'plan_current',
      title: '自选训练日',
      trainingMode: 'group_local',
      week: 8,
      weekday: 4,
    });

    expect(selectedIds).toEqual(['plan_exercise_selected']);
    expect(session.week).toBe(8);
    expect(session.weekday).toBe(4);
  });

  it('uses the latest completed weight when no suggested weight exists', async () => {
    const insertedSetParams: unknown[][] = [];
    const transaction = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM workout_sessions')) return null;
        if (sql.includes('ws.actual_weight AS actual_weight')) return { actual_weight: 72.5 };
        return null;
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM plan_exercises')) return [planExerciseRow];
        if (sql.includes('FROM group_members')) return [memberRow];
        if (sql.includes('FROM member_profiles')) return [];
        if (sql.includes('FROM exercises')) return [exerciseRow];
        return [];
      }),
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('INSERT INTO workout_sets')) {
          insertedSetParams.push(params);
        }
      }),
    };
    const db = {
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    await new SQLiteWorkoutRepository(async () => db as never).createSessionFromTodayPlan({
      date: '2026-06-30',
      groupId: 'group_1',
      phaseId: 'phase_strength',
      planId: 'plan_current',
      title: '第 8 周 Day 3',
      trainingMode: 'group_local',
      week: 8,
      weekday: 3,
    });

    expect(insertedSetParams[0][5]).toBe(72.5);
    expect(insertedSetParams[0][6]).toBe(72.5);
  });

  it('reuses an existing open session only when the selected plan, week, day, and mode match', async () => {
    const transaction = {
      getFirstAsync: jest.fn(async () => openSessionRow),
      getAllAsync: jest.fn(),
      runAsync: jest.fn(),
    };
    const db = {
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    const session = await new SQLiteWorkoutRepository(async () => db as never).createSessionFromTodayPlan({
      date: '2026-06-30',
      groupId: 'group_1',
      phaseId: 'phase_strength',
      planId: 'plan_current',
      title: '第 8 周 Day 3',
      trainingMode: 'group_local',
      week: 8,
      weekday: 3,
    });

    expect(session.id).toBe('session_open');
    expect(transaction.getAllAsync).not.toHaveBeenCalled();
    expect(transaction.runAsync).not.toHaveBeenCalled();
  });

  it('lists open sessions so the UI can resolve conflicting selections explicitly', async () => {
    const db = {
      getAllAsync: jest.fn(async () => [
        openSessionRow,
        {
          ...openSessionRow,
          id: 'session_other_day',
          title: '第 8 周 Day 4',
          weekday: 4,
        },
      ]),
    };

    const sessions = await new SQLiteWorkoutRepository(async () => db as never).listOpenSessionsForDate({
      date: '2026-06-30',
      groupId: 'group_1',
    });

    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.weekday)).toEqual([3, 4]);
    expect(db.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("status IN ('draft', 'in_progress')"), 'group_1', '2026-06-30');
  });
});

describe('SQLiteWorkoutRepository.createManualSession', () => {
  it('writes multiple manual exercises with independent set values', async () => {
    const exerciseRecordParams: unknown[][] = [];
    const setParams: unknown[][] = [];
    const transaction = {
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('INSERT INTO workout_exercise_records')) {
          exerciseRecordParams.push(params);
        }
        if (sql.includes('INSERT INTO workout_sets')) {
          setParams.push(params);
        }
      }),
    };
    const db = {
      withExclusiveTransactionAsync: jest.fn(async (callback: (txn: typeof transaction) => Promise<void>) => {
        await callback(transaction);
      }),
    };

    const session = await new SQLiteWorkoutRepository(async () => db as never).createManualSession({
      completed: true,
      date: '2026-06-30',
      exercises: [
        {
          exerciseId: 'exercise_bench',
          sets: [
            { reps: 5, weight: 100 },
            { reps: 4, weight: 105 },
          ],
        },
        {
          exerciseId: 'exercise_row',
          sets: [{ reps: 8, weight: 80 }],
        },
      ],
      groupId: 'group_1',
      memberId: 'member_1',
      planId: 'plan_current',
      title: '补录训练',
    });

    expect(session.status).toBe('completed');
    expect(exerciseRecordParams).toHaveLength(2);
    expect(exerciseRecordParams[0][3]).toBe('exercise_bench');
    expect(exerciseRecordParams[0][7]).toBe(2);
    expect(exerciseRecordParams[1][3]).toBe('exercise_row');
    expect(exerciseRecordParams[1][7]).toBe(1);
    expect(setParams).toHaveLength(3);
    expect(setParams.map((params) => [params[5], params[7]])).toEqual([
      [100, 5],
      [105, 4],
      [80, 8],
    ]);
  });
});

describe('SQLiteWorkoutRepository.addSetToExerciseRecord', () => {
  it('appends a set after the member current max set number', async () => {
    const insertedSetParams: unknown[][] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string) => {
        if (sql.includes('FROM workout_exercise_records')) {
          return {
            id: 'record_1',
            session_id: 'session_1',
            plan_exercise_id: null,
            exercise_id: 'exercise_bench',
            order_index: 1,
            replaced_from_exercise_id: null,
            priority: 'A',
            planned_sets: 3,
            planned_reps: 5,
            planned_rep_min: null,
            planned_rep_max: null,
            planned_rpe: null,
            planned_rir: null,
            planned_percent_1rm: null,
            planned_rest_seconds: null,
            notes: null,
          };
        }
        if (sql.includes('MAX(set_number)')) {
          return { max_set_number: 3 };
        }
        return null;
      }),
      runAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        if (sql.includes('INSERT INTO workout_sets')) {
          insertedSetParams.push(params);
        }
      }),
    };

    const set = await new SQLiteWorkoutRepository(async () => db as never).addSetToExerciseRecord({
      completed: true,
      exerciseRecordId: 'record_1',
      memberId: 'member_1',
      reps: 6,
      sessionId: 'session_1',
      weight: 102.5,
    });

    expect(set.setNumber).toBe(4);
    expect(insertedSetParams[0][4]).toBe(4);
    expect(insertedSetParams[0][5]).toBe(102.5);
    expect(insertedSetParams[0][7]).toBe(6);
  });
});

describe('SQLiteWorkoutRepository.saveSet', () => {
  it('persists optional RPE, notes, and actual rest seconds', async () => {
    const setRow = {
      id: 'set_1',
      session_id: 'session_1',
      exercise_record_id: 'record_1',
      member_id: 'member_1',
      set_number: 1,
      planned_weight: null,
      actual_weight: 100,
      planned_reps: null,
      actual_reps: 5,
      rpe: null,
      rir: null,
      actual_rest_seconds: null,
      completed: 0,
      skipped: 0,
      notes: null,
      created_at: '2026-06-30T00:00:00.000Z',
      updated_at: '2026-06-30T00:00:00.000Z',
    };
    const db = {
      getFirstAsync: jest.fn(async () => setRow),
      runAsync: jest.fn(async () => undefined),
    };

    const saved = await new SQLiteWorkoutRepository(async () => db as never).saveSet({
      actualRestSeconds: 95,
      completed: true,
      id: 'set_1',
      notes: 'fast bar speed',
      rpe: 8,
    });

    expect(saved.rpe).toBe(8);
    expect(saved.notes).toBe('fast bar speed');
    expect(saved.actualRestSeconds).toBe(95);
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('actual_rest_seconds'),
      100,
      5,
      8,
      null,
      95,
      1,
      0,
      'fast bar speed',
      '2026-06-30T00:00:00.000Z',
      'set_1',
    );
  });

  it('rejects invalid RPE values before writing', async () => {
    const db = {
      getFirstAsync: jest.fn(),
      runAsync: jest.fn(),
    };

    await expect(
      new SQLiteWorkoutRepository(async () => db as never).saveSet({
        id: 'set_1',
        rpe: 11,
      }),
    ).rejects.toThrow('RPE must be an integer from 1 to 10.');
    expect(db.getFirstAsync).not.toHaveBeenCalled();
    expect(db.runAsync).not.toHaveBeenCalled();
  });
});

describe('SQLiteWorkoutRepository.updateExerciseRecordExercise', () => {
  it('keeps the original planned exercise when replacing the current exercise', async () => {
    const db = {
      runAsync: jest.fn(async () => undefined),
    };

    await new SQLiteWorkoutRepository(async () => db as never).updateExerciseRecordExercise(
      'record_1',
      'exercise_dumbbell_bench',
    );

    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('replaced_from_exercise_id = COALESCE(replaced_from_exercise_id, exercise_id)'),
      'exercise_dumbbell_bench',
      'record_1',
    );
  });
});
