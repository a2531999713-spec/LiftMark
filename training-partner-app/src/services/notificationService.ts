import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { TrainingReminder } from '@/domain/reminder/trainingReminder.types';

const TRAINING_REMINDER_CHANNEL_ID = 'training-reminders';

type ScheduleTrainingReminderInput = Partial<TrainingReminder> & {
  body?: string;
  title?: string;
};

type ScheduleTrainingReminderResult = {
  notificationId?: string;
  ok: boolean;
  reason?: 'disabled' | 'permission_denied' | 'invalid_time' | 'unsupported';
};

let notificationHandlerConfigured = false;

function configureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
  notificationHandlerConfigured = true;
}

async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureTrainingReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TRAINING_REMINDER_CHANNEL_ID, {
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    name: 'Training reminders',
    sound: 'default',
  });
}

function parseReminderTime(remindTime?: string | null): { hour: number; minute: number } | null {
  const [hourRaw, minuteRaw] = (remindTime ?? '20:00').split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function toExpoWeekday(weekday?: number | null): number | null {
  if (!weekday) return null;
  if (weekday < 1 || weekday > 7) return null;
  return (weekday % 7) + 1;
}

export async function scheduleTrainingReminder(
  reminder: ScheduleTrainingReminderInput = {},
): Promise<ScheduleTrainingReminderResult> {
  if (reminder.enabled === false) {
    return { ok: false, reason: 'disabled' };
  }

  configureNotificationHandler();
  const granted = await ensureNotificationPermission();
  if (!granted) {
    return { ok: false, reason: 'permission_denied' };
  }
  await ensureTrainingReminderChannel();

  const time = parseReminderTime(reminder.remindTime);
  if (!time) {
    return { ok: false, reason: 'invalid_time' };
  }

  const weekday = toExpoWeekday(reminder.weekday);
  const trigger = weekday
    ? {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        channelId: TRAINING_REMINDER_CHANNEL_ID,
        weekday,
        hour: time.hour,
        minute: time.minute,
      }
    : {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        channelId: TRAINING_REMINDER_CHANNEL_ID,
        hour: time.hour,
        minute: time.minute,
      };

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: reminder.title ?? reminder.titleTemplate ?? 'Training reminder',
      body: reminder.body ?? reminder.bodyTemplate ?? 'Your planned workout is ready.',
      data: {
        reminderId: reminder.id,
        groupId: reminder.groupId,
        planId: reminder.planId,
        planCycleId: reminder.planCycleId,
        type: reminder.type,
      },
      sound: 'default',
    },
    trigger,
  });

  return { ok: true, notificationId };
}

export async function cancelTrainingReminder(notificationId?: string | null): Promise<void> {
  if (!notificationId) return;
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllTrainingReminders(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}
