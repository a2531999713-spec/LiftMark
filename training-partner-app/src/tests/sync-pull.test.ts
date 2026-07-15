import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { getCurrentAccountUserId } from '@/data/local/accountScope';
import { initializeLocalDatabase } from '@/data/local/db';
import { readStoredSession } from '@/services/auth/tokenStorage';
import { apiRequest } from '@/services/httpClient';
import { pullFromServer } from '@/sync/pullService';

jest.mock('@/data/local/db', () => ({
  __esModule: true,
  initializeLocalDatabase: jest.fn(),
}));

jest.mock('@/data/local/accountScope', () => ({
  __esModule: true,
  getCurrentAccountUserId: jest.fn(),
}));

jest.mock('@/services/auth/tokenStorage', () => ({
  __esModule: true,
  readStoredSession: jest.fn(),
}));

jest.mock('@/services/httpClient', () => ({
  __esModule: true,
  apiRequest: jest.fn(),
}));

const mockInitializeLocalDatabase = initializeLocalDatabase as jest.MockedFunction<typeof initializeLocalDatabase>;
const mockGetCurrentAccountUserId = getCurrentAccountUserId as jest.MockedFunction<typeof getCurrentAccountUserId>;
const mockReadStoredSession = readStoredSession as jest.MockedFunction<typeof readStoredSession>;
const mockApiRequest = apiRequest as jest.MockedFunction<typeof apiRequest>;

function createDbMock() {
  return {
    getFirstAsync: jest.fn<(...args: unknown[]) => Promise<unknown>>(),
    getAllAsync: jest.fn<(...args: unknown[]) => Promise<unknown[]>>(async () => []),
    runAsync: jest.fn<(...args: unknown[]) => Promise<{ changes: number }>>(async () => ({ changes: 1 })),
  };
}

function createServerRow(patch: Record<string, unknown> = {}) {
  return {
    actual_reps: null,
    actual_weight: null,
    client_id: 'session_local_1',
    client_updated_at: '2026-07-05T10:00:00.000Z',
    created_at: '2026-07-05T09:00:00.000Z',
    deleted_at: null,
    exercise_client_id: null,
    group_id: 'group_176',
    id: 'remote_session_176',
    member_client_id: null,
    name: null,
    parent_server_id: null,
    payload: {
      date: '2026-07-05',
      groupId: 'group_176',
      id: 'session_local_1',
      planId: 'plan_176',
      status: 'completed',
      title: 'Cloud session',
      trainingMode: 'solo_local',
      updatedAt: '2026-07-05T10:00:00.000Z',
      week: 1,
      weekday: 7,
    },
    status: 'completed',
    sync_version: 1,
    title: 'Cloud session',
    updated_at: '2026-07-05T10:00:00.000Z',
    user_id: 'user_176',
    ...patch,
  };
}

function createPlanRow(patch: Record<string, unknown> = {}) {
  return {
    client_id: 'plan_176',
    created_at: '2026-07-04T09:00:00.000Z',
    deleted_at: null,
    id: 'remote_plan_176',
    name: 'Cloud plan',
    payload: {
      durationWeeks: 4,
      frequencyPerWeek: 3,
      goal: 'strength',
      id: 'plan_176',
      name: 'Cloud plan',
      updatedAt: '2026-07-04T10:00:00.000Z',
      visibility: 'private',
    },
    updated_at: '2026-07-04T10:00:00.000Z',
    user_id: 'user_176',
    ...patch,
  };
}

function createPlanPhaseRow(patch: Record<string, unknown> = {}) {
  return {
    client_id: 'phase_176',
    created_at: '2026-07-04T09:00:00.000Z',
    deleted_at: null,
    id: 'remote_phase_176',
    name: 'Strength',
    payload: {
      endWeek: 4,
      id: 'phase_176',
      name: 'Strength',
      orderIndex: 1,
      planId: 'plan_176',
      startWeek: 1,
      type: 'strength',
      updatedAt: '2026-07-04T10:00:00.000Z',
    },
    updated_at: '2026-07-04T10:00:00.000Z',
    user_id: 'user_176',
    ...patch,
  };
}

function createPlanDayRow(patch: Record<string, unknown> = {}) {
  return {
    client_id: 'day_176',
    created_at: '2026-07-04T09:00:00.000Z',
    deleted_at: null,
    id: 'remote_day_176',
    payload: {
      focus: 'Squat',
      id: 'day_176',
      phaseId: 'phase_176',
      planId: 'plan_176',
      title: 'Lower',
      week: 1,
      weekday: 1,
    },
    updated_at: '2026-07-04T10:00:00.000Z',
    user_id: 'user_176',
    ...patch,
  };
}

function createPlanExerciseRow(patch: Record<string, unknown> = {}) {
  return {
    client_id: 'plan_exercise_176',
    created_at: '2026-07-04T09:00:00.000Z',
    deleted_at: null,
    id: 'remote_plan_exercise_176',
    payload: {
      exerciseId: 'exercise_squat',
      id: 'plan_exercise_176',
      orderIndex: 1,
      planDayId: 'day_176',
      priority: 'A',
      repMax: 5,
      repMin: 5,
      sets: 5,
    },
    updated_at: '2026-07-04T10:00:00.000Z',
    user_id: 'user_176',
    ...patch,
  };
}

function createRecoveryRow(patch: Record<string, unknown> = {}) {
  return {
    client_id: 'recovery_local_176',
    created_at: '2026-07-15T07:00:00.000Z',
    deleted_at: null,
    id: 'recovery_remote_176',
    member_client_id: 'member_176',
    payload: {
      appetiteScore: 4,
      date: '2026-07-15',
      fatigueScore: 2,
      id: 'recovery_local_176',
      jointPainScore: 1,
      memberId: 'member_176',
      motivationScore: 4,
      recommendation: 'normal',
      sleepScore: 5,
      sorenessScore: 2,
      totalScore: 26,
      updatedAt: '2026-07-15T08:00:00.000Z',
    },
    updated_at: '2026-07-15T08:00:00.000Z',
    user_id: 'user_176',
    ...patch,
  };
}

describe('pullFromServer account isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentAccountUserId.mockResolvedValue('user_176');
    mockReadStoredSession.mockResolvedValue({
      accessToken: 'token_176',
      refreshToken: 'refresh_176',
      user: { displayName: '176', id: 'user_176', liftmarkId: 'LM176' },
    });
  });

  it('stores and reads the pull cursor per account', async () => {
    const db = createDbMock();
    const cursorParams: unknown[][] = [];
    db.getFirstAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql, ...params] = args;
      if (String(sql).includes('sync_state')) {
        cursorParams.push(params);
        return { value: '2026-07-01T00:00:00.000Z' };
      }
      return null;
    });
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: {},
      serverTime: '2026-07-05T11:00:00.000Z',
    });

    await pullFromServer();

    expect(cursorParams[0]).toEqual(['last_pull_at:user_176']);
    expect(mockApiRequest).toHaveBeenCalledWith(
      expect.stringContaining(encodeURIComponent('2026-07-01T00:00:00.000Z')),
      { accessToken: 'token_176' },
    );
    expect(db.runAsync).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_state'),
      'sync_state_last_pull_at:user_176',
      'last_pull_at:user_176',
      '2026-07-05T11:00:00.000Z',
      expect.any(String),
    );
  });

  it('reclaims a pulled row when the same local id was assigned to another account', async () => {
    const db = createDbMock();
    db.getFirstAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql, ...params] = args;
      if (String(sql).includes('FROM workout_sessions') && String(sql).includes('WHERE remote_id = ?')) {
        expect(params).toEqual(['remote_session_176']);
        return null;
      }
      if (String(sql).includes('FROM workout_sessions') && String(sql).includes('WHERE id = ?')) {
        expect(params).toEqual(['session_local_1']);
        return {
          id: 'session_local_1',
          owner_user_id: 'user_188',
          remote_id: null,
          sync_status: 'synced',
          updated_at: '2026-07-04T10:00:00.000Z',
        };
      }
      return null;
    });
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: {
        workoutSessions: [createServerRow()],
      },
      serverTime: '2026-07-05T11:00:00.000Z',
    });

    const result = await pullFromServer({ fullPull: true });

    const reclaimCall = db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes('UPDATE workout_sessions') && String(sql).includes('owner_user_id'),
    );
    expect(result.pulled).toBe(1);
    expect(reclaimCall).toBeTruthy();
    expect(reclaimCall).toEqual([
      expect.stringContaining('UPDATE workout_sessions'),
      'group_176',
      'plan_176',
      null,
      null,
      null,
      '2026-07-05',
      1,
      7,
      'Cloud session',
      'completed',
      'solo_local',
      null,
      null,
      null,
      null,
      '2026-07-05T10:00:00.000Z',
      'user_176',
      'synced',
      '2026-07-05T10:00:00.000Z',
      'remote_session_176',
      'session_local_1',
    ]);
  });

  it('applies plan phases during full restore before dependent plan rows', async () => {
    const db = createDbMock();
    db.getFirstAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql] = args;
      const query = String(sql);
      if (query.includes('SELECT COUNT(*) AS count')) {
        if (query.includes('FROM plan_templates')) return { count: 1 };
        if (query.includes('FROM plan_phases')) return { count: 1 };
        if (query.includes('FROM plan_days')) return { count: 1 };
        if (query.includes('FROM plan_exercises')) return { count: 1 };
        return { count: 0 };
      }
      return null;
    });
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: {
        trainingPlans: [createPlanRow()],
        planPhases: [createPlanPhaseRow()],
        planDays: [createPlanDayRow()],
        planExercises: [createPlanExerciseRow()],
      },
      serverTime: '2026-07-05T11:00:00.000Z',
    });

    const result = await pullFromServer({ fullPull: true });

    const insertTables = db.runAsync.mock.calls
      .map(([sql]) => String(sql))
      .filter((sql) => sql.includes('INSERT INTO'))
      .map((sql) => {
        const match = sql.match(/INSERT INTO\s+(\w+)/);
        return match?.[1] ?? '';
      });
    expect(result.ok).toBe(true);
    expect(result.remoteCounts?.planPhases).toBe(1);
    expect(result.localCounts?.planPhases).toBe(1);
    expect(insertTables.indexOf('plan_phases')).toBeGreaterThan(insertTables.indexOf('plan_templates'));
    expect(insertTables.indexOf('plan_days')).toBeGreaterThan(insertTables.indexOf('plan_phases'));
    expect(insertTables.indexOf('plan_exercises')).toBeGreaterThan(insertTables.indexOf('plan_days'));
  });

  it('does not advance the pull cursor when applying a server row fails', async () => {
    const db = createDbMock();
    db.getFirstAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql] = args;
      if (String(sql).includes('FROM workout_sessions')) return null;
      return null;
    });
    db.runAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql] = args;
      if (String(sql).includes('INSERT INTO workout_sessions')) {
        throw new Error('primary key conflict');
      }
      return { changes: 1 };
    });
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: {
        workoutSessions: [createServerRow()],
      },
      serverTime: '2026-07-05T11:00:00.000Z',
    });

    const result = await pullFromServer({ fullPull: true });

    expect(result.ok).toBe(false);
    expect(result.message).toContain('云端数据拉取未完全应用');
    expect(db.runAsync).not.toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO sync_state'),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('pulls recovery logs only through an exact visible member mapping', async () => {
    const db = createDbMock();
    db.getFirstAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql] = args;
      const query = String(sql);
      if (query.includes('FROM group_members gm') && query.includes('gm.local_member_id')) {
        return { id: 'member_local_176' };
      }
      return null;
    });
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: { recoveryLogs: [createRecoveryRow()] },
      serverTime: '2026-07-15T09:00:00.000Z',
    });

    const result = await pullFromServer({ fullPull: true });

    const recoveryInsert = db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO recovery_logs'),
    );
    expect(result.pulled).toBe(1);
    expect(recoveryInsert).toBeTruthy();
    expect(recoveryInsert).toEqual(expect.arrayContaining([
      expect.stringContaining('INSERT INTO recovery_logs'),
      'recovery_local_176',
      'user_176',
      'member_local_176',
      '2026-07-15',
    ]));
  });

  it('reuses the existing local daily id when another device pulls the same member and date', async () => {
    const db = createDbMock();
    db.getFirstAsync.mockImplementation(async (...args: unknown[]) => {
      const [sql] = args;
      const query = String(sql);
      if (query.includes('FROM group_members gm') && query.includes('gm.local_member_id')) {
        return { id: 'member_local_176' };
      }
      if (query.includes('FROM recovery_logs') && query.includes('ORDER BY updated_at DESC')) {
        return { id: 'recovery_existing_daily' };
      }
      return null;
    });
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: { recoveryLogs: [createRecoveryRow()] },
      serverTime: '2026-07-15T09:00:00.000Z',
    });

    await pullFromServer({ fullPull: true });

    const recoveryInsert = db.runAsync.mock.calls.find(([sql]) =>
      String(sql).includes('INSERT INTO recovery_logs'),
    );
    expect(recoveryInsert?.[1]).toBe('recovery_existing_daily');
  });

  it('does not attach a pulled recovery log when its member is outside visible account groups', async () => {
    const db = createDbMock();
    db.getFirstAsync.mockResolvedValue(null);
    mockInitializeLocalDatabase.mockResolvedValue(db as never);
    mockApiRequest.mockResolvedValue({
      changes: {
        recoveryLogs: [
          createRecoveryRow({
            member_client_id: 'member_other_group',
            payload: {
              ...(createRecoveryRow().payload as Record<string, unknown>),
              memberId: 'member_other_group',
            },
          }),
        ],
      },
      serverTime: '2026-07-15T09:00:00.000Z',
    });

    const result = await pullFromServer({ fullPull: true });

    expect(result.pulled).toBe(0);
    expect(
      db.runAsync.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO recovery_logs')),
    ).toBe(false);
  });
});
