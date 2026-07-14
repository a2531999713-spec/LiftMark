import { describe, expect, it, jest } from '@jest/globals';

import { SQLiteTrainingReportRepository } from '@/data/local/repositories/trainingReportRepository';

jest.mock('@/data/local/accountScope', () => ({
  getGroupAccountScope: jest.fn(() => ({ params: ['account-a'], where: 'groups.owner_user_id = ?' })),
  getRequiredCurrentUserId: jest.fn(async () => 'account-a'),
}));

const sessionRow = {
  cycle_name: '周期 1',
  finished_at: '2026-07-11T11:00:00.000Z',
  group_id: 'group-a',
  has_manual_marker: 0,
  plan_cycle_id: 'cycle-a',
  plan_day_id: 'day-a',
  plan_id: 'plan-a',
  plan_name: '力量计划',
  report_created_at: '2026-07-11T11:00:00.000Z',
  report_date: '2026-07-11',
  report_duration_seconds: 3600,
  report_estimated_calories: 300,
  report_estimated_calories_max: 360,
  report_estimated_calories_min: 240,
  report_exercise_count: 1,
  report_id: 'report-a',
  report_intensity_level: 'medium',
  report_notes: null,
  report_total_reps: 10,
  report_total_sets: 2,
  report_total_volume: 800,
  report_updated_at: '2026-07-11T11:00:00.000Z',
  session_date: '2026-07-11',
  session_id: 'session-a',
  session_title: '上肢力量',
  started_at: '2026-07-11T10:00:00.000Z',
  week: 2,
  weekday: 3,
};

describe('SQLiteTrainingReportRepository', () => {
  it('reads a report only through the current owner and group scope', async () => {
    const calls: { params: unknown[]; sql: string }[] = [];
    const db = {
      getFirstAsync: jest.fn(async (sql: string, ...params: unknown[]) => {
        calls.push({ params, sql });
        return sessionRow;
      }),
      getAllAsync: jest.fn(async (sql: string) => {
        if (sql.includes('workout_exercise_records')) return [{
          actual_reps: 5,
          actual_weight: 80,
          completed: 1,
          exercise_id: 'exercise-a',
          exercise_name: '杠铃卧推',
          member_id: 'member-a',
          member_name: '成员甲',
          notes: null,
          planned_reps: 5,
          planned_weight: 80,
          record_id: 'record-a',
          replaced_from_exercise_name: null,
          set_number: 1,
          skipped: 0,
        }];
        return [{ bodyweight: 80, member_id: 'member-a', member_name: '成员甲' }];
      }),
    };
    const source = await new SQLiteTrainingReportRepository(async () => db as never).getTrainingReportSource('session-a');
    expect(source).toMatchObject({ hasReport: true, ownerUserId: 'account-a', sessionId: 'session-a' });
    expect(calls[0]?.sql).toContain('tr.owner_user_id = ?');
    expect(calls[0]?.sql).toContain('ws.owner_user_id = ?');
    expect(calls[0]?.sql).toContain('tr.estimated_calories_min AS report_estimated_calories_min');
    expect(calls[0]?.sql).toContain('tr.estimated_calories_max AS report_estimated_calories_max');
    expect(calls[0]?.params.filter((value) => value === 'account-a').length).toBeGreaterThanOrEqual(2);
    expect(source?.report).toMatchObject({
      estimatedCaloriesMax: 360,
      estimatedCaloriesMin: 240,
    });
  });

  it('returns a read-only source when an old session has no persisted report', async () => {
    const db = {
      getFirstAsync: jest.fn(async () => ({ ...sessionRow, report_id: null })),
      getAllAsync: jest.fn(async () => []),
    };
    const source = await new SQLiteTrainingReportRepository(async () => db as never).getTrainingReportSource('session-a');
    expect(source?.hasReport).toBe(false);
    expect(source?.report).toBeUndefined();
  });
});
