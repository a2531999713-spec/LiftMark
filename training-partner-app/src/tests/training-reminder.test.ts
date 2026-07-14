/* eslint-disable import/first */
import { describe, expect, it, jest } from '@jest/globals';

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3 }, AndroidNotificationVisibility: { PUBLIC: 1 }, SchedulableTriggerInputTypes: { WEEKLY: 'weekly' },
  cancelScheduledNotificationAsync: jest.fn(), getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(), scheduleNotificationAsync: jest.fn(), setNotificationChannelAsync: jest.fn(), setNotificationHandler: jest.fn(),
}));

jest.mock('@/domain/common/ids', () => ({ createId: (prefix?: string) => `${prefix ?? 'id'}_test` }));
jest.mock('@/data/local/accountScope', () => ({ getRequiredCurrentUserId: jest.fn(async () => 'usr_reminder') }));
jest.mock('@/sync/syncQueue', () => ({ enqueueSyncCandidate: jest.fn(async () => undefined) }));

import { SQLiteTrainingReminderRepository } from '@/data/local/repositories/trainingReminderRepository';
import { resolveScheduledTime, toExpoWeekday } from '@/services/notificationService';
import { defaultTrainingReminderSettings, readTrainingReminderSettings } from '@/services/trainingReminderService';

describe('training reminder schedule rules', () => {
  it('converts plan weekdays to Expo weekdays', () => {
    expect(toExpoWeekday(1)).toBe(2);
    expect(toExpoWeekday(7)).toBe(1);
  });

  it('moves a 30-minute advance notification across the previous day boundary', () => {
    expect(resolveScheduledTime('00:20', 1, 30)).toEqual({ weekday: 7, hour: 23, minute: 50 });
    expect(resolveScheduledTime('00:05', 3, 10)).toEqual({ weekday: 2, hour: 23, minute: 55 });
  });

  it('keeps a disabled or empty reminder configuration off by default', () => {
    expect(readTrainingReminderSettings([])).toEqual(defaultTrainingReminderSettings);
  });
});

describe('SQLiteTrainingReminderRepository scope and metadata', () => {
  it('uses owner and group scope for list queries and excludes soft deleted reminders', async () => {
    const db = { getAllAsync: jest.fn(async () => []) };
    const repository = new SQLiteTrainingReminderRepository(async () => db as never);
    await repository.listByOwnerAndGroup('group_a');
    const [sql, owner, group] = db.getAllAsync.mock.calls[0] as unknown as [string, string, string];
    expect(sql).toContain('owner_user_id = ?');
    expect(sql).toContain('group_id = ?');
    expect(sql).toContain('deleted_at IS NULL');
    expect(owner).toBe('usr_reminder');
    expect(group).toBe('group_a');
  });

  it('persists device-only schedule ids without placing them in the sync payload', async () => {
    const db = { getFirstAsync: jest.fn(async () => ({ notification_ids_json: '["expo_1"]', last_scheduled_at: '2026-07-14T00:00:00.000Z' })), runAsync: jest.fn(async () => undefined) };
    const repository = new SQLiteTrainingReminderRepository(async () => db as never);
    await expect(repository.getScheduleMetadata('reminder_1')).resolves.toEqual({ notificationIds: ['expo_1'], lastScheduledAt: '2026-07-14T00:00:00.000Z' });
    await repository.updateScheduleMetadata('reminder_1', { notificationIds: ['expo_2'] });
    expect(String((db.runAsync.mock.calls[0] as unknown[])[0])).toContain('notification_ids_json');
  });
});
