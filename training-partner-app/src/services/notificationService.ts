import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { TrainingReminder } from '@/domain/reminder/trainingReminder.types';

const TRAINING_REMINDER_CHANNEL_ID = 'training-reminders';

export type NotificationPermissionState = 'granted' | 'undetermined' | 'denied';
type ScheduleTrainingReminderInput = TrainingReminder & { body?: string; title?: string };
type ScheduleTrainingReminderResult = { notificationId?: string; ok: boolean; reason?: 'disabled' | 'permission_denied' | 'invalid_time' | 'unsupported' };

let notificationHandlerConfigured = false;

function configureNotificationHandler() {
  if (notificationHandlerConfigured) return;
  Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });
  notificationHandlerConfigured = true;
}

export function parseReminderTime(remindTime?: string | null): { hour: number; minute: number } | null {
  const [hourRaw, minuteRaw] = (remindTime ?? '').split(':');
  const hour = Number(hourRaw); const minute = Number(minuteRaw);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 ? { hour, minute } : null;
}

/** Plan weekdays use Monday=1…Sunday=7, while Expo uses Sunday=1…Saturday=7. */
export function toExpoWeekday(weekday?: number | null): number | null {
  return weekday && weekday >= 1 && weekday <= 7 ? (weekday % 7) + 1 : null;
}

export function resolveScheduledTime(remindTime: string, weekday: number, minutesBefore = 0): { hour: number; minute: number; weekday: number } | null {
  const time = parseReminderTime(remindTime);
  if (!time || weekday < 1 || weekday > 7 || minutesBefore < 0) return null;
  const total = time.hour * 60 + time.minute - minutesBefore;
  const dayOffset = total < 0 ? -1 : 0;
  const normalized = ((total % 1440) + 1440) % 1440;
  return { hour: Math.floor(normalized / 60), minute: normalized % 60, weekday: ((weekday - 1 + dayOffset + 7) % 7) + 1 };
}

export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestTrainingNotificationPermission(): Promise<NotificationPermissionState> {
  const current = await getNotificationPermissionState();
  if (current !== 'undetermined') return current;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted ? 'granted' : requested.canAskAgain ? 'undetermined' : 'denied';
}

export async function openNotificationSettings(): Promise<void> {
  await Notifications.getPermissionsAsync();
  // Expo has no cross-platform settings opener. The UI presents the state; Android/iOS
  // users can change it from the OS notification settings without repeated prompts.
}

async function ensureTrainingReminderChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(TRAINING_REMINDER_CHANNEL_ID, { importance: Notifications.AndroidImportance.DEFAULT, lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC, name: '训练提醒', sound: 'default' });
}

export async function scheduleTrainingReminder(reminder: ScheduleTrainingReminderInput): Promise<ScheduleTrainingReminderResult> {
  if (!reminder.enabled) return { ok: false, reason: 'disabled' };
  configureNotificationHandler();
  if ((await getNotificationPermissionState()) !== 'granted') return { ok: false, reason: 'permission_denied' };
  const scheduled = resolveScheduledTime(reminder.remindTime ?? '', reminder.weekday ?? 0, reminder.minutesBefore ?? 0);
  if (!scheduled) return { ok: false, reason: 'invalid_time' };
  await ensureTrainingReminderChannel();
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: { title: reminder.title ?? reminder.titleTemplate, body: reminder.body ?? reminder.bodyTemplate, sound: 'default', data: { reminderId: reminder.id, groupId: reminder.groupId, planId: reminder.planId, planCycleId: reminder.planCycleId, type: reminder.type } },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, channelId: TRAINING_REMINDER_CHANNEL_ID, weekday: toExpoWeekday(scheduled.weekday)!, hour: scheduled.hour, minute: scheduled.minute },
  });
  return { ok: true, notificationId };
}

export async function sendTrainingReminderTestNotification(input: Pick<TrainingReminder, 'id' | 'groupId' | 'planId' | 'planCycleId' | 'type' | 'titleTemplate' | 'bodyTemplate'>): Promise<void> {
  configureNotificationHandler();
  if ((await getNotificationPermissionState()) !== 'granted') throw new Error('通知权限未开启。');
  await ensureTrainingReminderChannel();
  await Notifications.scheduleNotificationAsync({ content: { title: input.titleTemplate, body: input.bodyTemplate, sound: 'default', data: { reminderId: input.id, groupId: input.groupId, planId: input.planId, planCycleId: input.planCycleId, type: input.type } }, trigger: null });
}

export async function cancelTrainingReminder(notificationId?: string | null): Promise<void> {
  if (notificationId) await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelTrainingReminderIds(notificationIds: string[]): Promise<void> {
  await Promise.all(notificationIds.map(cancelTrainingReminder));
}
