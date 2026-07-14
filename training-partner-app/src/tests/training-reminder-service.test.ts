/* eslint-disable import/first */
import { describe, expect, it, jest } from '@jest/globals';

const mockReminderRepository = {
  getScheduleMetadata: jest.fn(async () => ({ notificationIds: [] })),
  listByOwnerAndGroup: jest.fn(async () => []),
  updateScheduleMetadata: jest.fn(async () => undefined),
  upsert: jest.fn(async (input: Record<string, unknown>) => ({ ...input, id: input.id ?? 'reminder_new' })),
};

jest.mock('@/services/notificationService', () => ({
  cancelTrainingReminderIds: jest.fn(async () => undefined),
  scheduleTrainingReminder: jest.fn(async () => ({ ok: true, notificationId: 'expo_new' })),
  sendTrainingReminderTestNotification: jest.fn(async () => undefined),
}));
jest.mock('@/data/local', () => ({ createLocalRepositories: jest.fn() }));

import { saveTrainingReminderSettings } from '@/services/trainingReminderService';
import { createLocalRepositories } from '@/data/local';
import { cancelTrainingReminderIds, scheduleTrainingReminder } from '@/services/notificationService';

describe('training reminder scheduling lifecycle', () => {
  const input = {
    group: { id: 'group_1' }, plan: { id: 'plan_1', name: '力量计划' }, cycle: { id: 'cycle_1' },
    planDays: [{ id: 'day_1', weekday: 1, title: '推', focus: '胸' }, { id: 'day_2', weekday: 3, title: '拉', focus: '背' }],
    settings: { enabled: true, weekdays: [1, 3], remindTime: '19:30', beforeThirtyMinutes: true, beforeTenMinutes: true, todayPlan: false },
  };

  it('replaces stored schedule ids before re-saving instead of accumulating duplicate notifications', async () => {
    (createLocalRepositories as jest.Mock).mockReturnValue({ trainingReminderRepository: mockReminderRepository });
    (mockReminderRepository.listByOwnerAndGroup as unknown as { mockResolvedValueOnce(value: unknown): void }).mockResolvedValueOnce([{ id: 'old_1', weekday: 1, type: 'before_workout', minutesBefore: 30 }]);
    (mockReminderRepository.getScheduleMetadata as unknown as { mockResolvedValueOnce(value: unknown): void }).mockResolvedValueOnce({ notificationIds: ['expo_old'] });
    await saveTrainingReminderSettings(input as never);
    expect(cancelTrainingReminderIds).toHaveBeenCalledWith(['expo_old']);
    expect(scheduleTrainingReminder).toHaveBeenCalledTimes(4);
    expect(mockReminderRepository.updateScheduleMetadata).toHaveBeenCalledWith('old_1', { notificationIds: [] });
  });

  it('does not schedule a disabled configuration', async () => {
    (createLocalRepositories as jest.Mock).mockReturnValue({ trainingReminderRepository: mockReminderRepository });
    (scheduleTrainingReminder as jest.Mock).mockClear(); (mockReminderRepository.listByOwnerAndGroup as unknown as { mockResolvedValueOnce(value: unknown): void }).mockResolvedValueOnce([]);
    await saveTrainingReminderSettings({ ...input, settings: { ...input.settings, enabled: false } } as never);
    expect(scheduleTrainingReminder).not.toHaveBeenCalled();
  });
});
