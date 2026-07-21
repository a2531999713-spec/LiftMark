import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ACHIEVEMENT_CATALOG } from '@liftmark/shared';

import {
  calculateCurrentWeekStreak,
  calculateLongestWeekStreak,
  calculateMetricsFromRows,
  getMondayWeekKey,
} from './achievements.metrics';

function session(id: string, status: string, date: string, trainingMode = 'solo_local', patch: Record<string, unknown> = {}) {
  return { id: `server-${id}`, client_id: id, status, payload: { date, trainingMode }, ...patch };
}

function set(id: string, sessionId: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    client_id: id,
    parent_server_id: sessionId,
    actual_weight: 100,
    actual_reps: 5,
    payload: { completed: true, skipped: false },
    ...patch,
  };
}

describe('achievement server metrics', () => {
  it('uses the stable 11-code catalog without the daily streak', () => {
    assert.equal(ACHIEVEMENT_CATALOG.length, 11);
    assert.equal(ACHIEVEMENT_CATALOG.some((item) => (item.code as string) === 'streak_3_days'), false);
  });

  it('counts only completed sessions with at least one valid set and distinct sessions', () => {
    const metrics = calculateMetricsFromRows({
      sessions: [
        session('draft', 'draft', '2026-07-01'),
        session('progress', 'in_progress', '2026-07-02'),
        session('cancelled', 'cancelled', '2026-07-03'),
        session('empty', 'completed', '2026-07-04'),
        session('valid', 'completed', '2026-07-06'),
        session('deleted', 'completed', '2026-07-07', 'solo_local', { deleted_at: '2026-07-08' }),
      ],
      sets: [
        set('valid-1', 'valid'),
        set('valid-2', 'valid', { actual_weight: 50, actual_reps: 10 }),
        set('empty-skipped', 'empty', { payload: { completed: true, skipped: true } }),
        set('deleted-set', 'deleted'),
      ],
      cycles: [],
      recoveryLogs: [],
    }, '2026-07-06');
    assert.equal(metrics.completedWorkouts, 1);
    assert.equal(metrics.totalVolume, 1000);
  });

  it('excludes skipped, unfinished and deleted sets from volume but keeps zero-weight sessions valid', () => {
    const metrics = calculateMetricsFromRows({
      sessions: [session('bodyweight', 'completed', '2026-07-06'), session('weights', 'completed', '2026-07-07')],
      sets: [
        set('bodyweight', 'bodyweight', { actual_weight: 0, actual_reps: 10 }),
        set('payload-fallback', 'weights', { actual_weight: null, actual_reps: null, payload: { completed: true, skipped: false, plannedWeight: 20, plannedReps: 8 } }),
        set('skipped', 'weights', { payload: { completed: true, skipped: true } }),
        set('unfinished', 'weights', { payload: { completed: false, skipped: false } }),
        set('deleted', 'weights', { deleted_at: '2026-07-08' }),
      ],
      cycles: [],
      recoveryLogs: [],
    });
    assert.equal(metrics.completedWorkouts, 2);
    assert.equal(metrics.totalVolume, 160);
  });

  it('recognizes group_local only, regardless of group context', () => {
    const metrics = calculateMetricsFromRows({
      sessions: [session('solo', 'completed', '2026-07-06', 'solo_local', { group_id: 'group-a' }), session('group', 'completed', '2026-07-07', 'group_local')],
      sets: [set('solo-set', 'solo'), set('group-set', 'group')],
      cycles: [],
      recoveryLogs: [],
    });
    assert.equal(metrics.groupWorkouts, 1);
  });

  it('deduplicates completed cycles and recovery member-date records', () => {
    const metrics = calculateMetricsFromRows({
      sessions: [],
      sets: [],
      cycles: [
        { id: 'c1', client_id: 'c1', status: 'completed' },
        { id: 'c2', client_id: 'c2', status: 'archived' },
        { id: 'c3', client_id: 'c3', status: 'active' },
      ],
      recoveryLogs: [
        { id: 'r1', client_id: 'r1', member_client_id: 'm1', payload: { date: '2026-07-06' } },
        { id: 'r2', client_id: 'r2', member_client_id: 'm1', payload: { date: '2026-07-06' } },
        { id: 'r3', client_id: 'r3', member_client_id: 'm2', payload: { date: '2026-07-06' } },
      ],
    });
    assert.equal(metrics.completedCycles, 2);
    assert.equal(metrics.recoveryCheckins, 2);
  });

  it('calculates Monday active weeks across years and preserves last week during the current week', () => {
    assert.equal(getMondayWeekKey('2026-01-01'), '2025-12-29');
    assert.equal(calculateLongestWeekStreak(['2025-12-29', '2026-01-05', '2026-01-12']), 3);
    assert.equal(calculateCurrentWeekStreak(['2025-12-29', '2026-01-05'], '2026-01-14'), 2);
    assert.equal(calculateCurrentWeekStreak(['2025-12-29'], '2026-01-14'), 0);
  });
});
