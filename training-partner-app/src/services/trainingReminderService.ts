import { createLocalRepositories } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { PlanCycle, PlanDay, PlanTemplate } from '@/domain/plan/plan.types';
import type { TrainingReminder, TrainingReminderSettings } from '@/domain/reminder/trainingReminder.types';

import {
  cancelTrainingReminderIds,
  scheduleTrainingReminder,
  sendTrainingReminderTestNotification,
} from './notificationService';

const REMINDER_TYPES = [
  { type: 'before_workout' as const, minutesBefore: 30, enabledKey: 'beforeThirtyMinutes' as const, title: '还有 30 分钟开始训练' },
  { type: 'before_workout' as const, minutesBefore: 10, enabledKey: 'beforeTenMinutes' as const, title: '训练即将开始' },
  { type: 'today_plan' as const, minutesBefore: 0, enabledKey: 'todayPlan' as const, title: '今天有训练计划' },
];

export const defaultTrainingReminderSettings: TrainingReminderSettings = {
  enabled: false, weekdays: [1, 3, 5], remindTime: '19:30', beforeThirtyMinutes: true, beforeTenMinutes: true, todayPlan: false,
};

function currentTimezone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Shanghai'; }
function uniqueWeekdays(days: number[]) { return [...new Set(days.filter((day) => Number.isInteger(day) && day >= 1 && day <= 7))].sort((a, b) => a - b); }

export function readTrainingReminderSettings(reminders: TrainingReminder[]): TrainingReminderSettings {
  if (reminders.length === 0) return defaultTrainingReminderSettings;
  const enabled = reminders.some((reminder) => reminder.enabled);
  const active = reminders.filter((reminder) => reminder.enabled);
  const source = active[0] ?? reminders[0];
  return {
    enabled,
    weekdays: uniqueWeekdays(active.map((reminder) => reminder.weekday ?? 0)),
    remindTime: source.remindTime ?? defaultTrainingReminderSettings.remindTime,
    beforeThirtyMinutes: active.some((reminder) => reminder.type === 'before_workout' && reminder.minutesBefore === 30),
    beforeTenMinutes: active.some((reminder) => reminder.type === 'before_workout' && reminder.minutesBefore === 10),
    todayPlan: active.some((reminder) => reminder.type === 'today_plan'),
  };
}

function reminderCopy(type: TrainingReminder['type'], minutesBefore: number, plan: PlanTemplate, day: PlanDay) {
  const planDay = day.title || day.focus || plan.name;
  if (type === 'before_workout' && minutesBefore === 30) return { title: '还有 30 分钟开始训练', body: `今日计划：${planDay}。准备好训练装备，按计划开始。` };
  if (type === 'before_workout') return { title: '训练即将开始', body: `今日计划：${planDay}。打开练刻查看今天的训练内容。` };
  return { title: '今天有训练计划', body: `${plan.name} · ${planDay}。按计划完成今天的训练。` };
}

export type SaveTrainingReminderSettingsInput = { group: Group; plan: PlanTemplate; cycle: PlanCycle; planDays: PlanDay[]; settings: TrainingReminderSettings };

export async function saveTrainingReminderSettings(input: SaveTrainingReminderSettingsInput): Promise<void> {
  const repositories = createLocalRepositories();
  const existing = await repositories.trainingReminderRepository.listByOwnerAndGroup(input.group.id);
  for (const reminder of existing) {
    const metadata = await repositories.trainingReminderRepository.getScheduleMetadata(reminder.id);
    await cancelTrainingReminderIds(metadata.notificationIds);
    await repositories.trainingReminderRepository.updateScheduleMetadata(reminder.id, { notificationIds: [] });
  }

  const weekdays = uniqueWeekdays(input.settings.weekdays);
  const activeTypes = REMINDER_TYPES.filter((item) => input.settings.enabled && input.settings[item.enabledKey]);
  // A plan can contain the same weekday in multiple weeks/phases; a weekly Expo trigger
  // must be created once per weekday, using the first current-plan day as its copy source.
  const usableDays = weekdays
    .map((weekday) => input.planDays.find((day) => day.weekday === weekday))
    .filter((day): day is PlanDay => Boolean(day));
  if (input.settings.enabled && (weekdays.length === 0 || usableDays.length === 0 || activeTypes.length === 0)) {
    throw new Error('请选择当前计划包含的训练日和至少一种提醒方式。');
  }

  const currentKeys = new Set<string>();
  for (const day of usableDays) for (const kind of activeTypes) {
    const copy = reminderCopy(kind.type, kind.minutesBefore, input.plan, day);
    const existingReminder = existing.find((item) => item.weekday === day.weekday && item.type === kind.type && item.minutesBefore === kind.minutesBefore);
    const reminder = await repositories.trainingReminderRepository.upsert({
      id: existingReminder?.id, groupId: input.group.id, planId: input.plan.id, planCycleId: input.cycle.id,
      type: kind.type, enabled: true, weekday: day.weekday, remindTime: input.settings.remindTime,
      minutesBefore: kind.minutesBefore, timezone: currentTimezone(), titleTemplate: copy.title, bodyTemplate: copy.body,
      ownerUserId: undefined,
    });
    const result = await scheduleTrainingReminder(reminder);
    if (!result.ok || !result.notificationId) throw new Error(result.reason === 'permission_denied' ? '通知权限未开启。' : '提醒调度失败，请检查训练时间。');
    await repositories.trainingReminderRepository.updateScheduleMetadata(reminder.id, { notificationIds: [result.notificationId], lastScheduledAt: new Date().toISOString() });
    currentKeys.add(`${day.weekday}:${kind.type}:${kind.minutesBefore}`);
  }

  for (const reminder of existing) {
    const key = `${reminder.weekday}:${reminder.type}:${reminder.minutesBefore ?? 0}`;
    if (!currentKeys.has(key)) await repositories.trainingReminderRepository.upsert({ ...reminder, enabled: false });
  }
}

export async function disableTrainingRemindersForGroup(groupId: string): Promise<void> {
  const repositories = createLocalRepositories();
  const reminders = await repositories.trainingReminderRepository.listByOwnerAndGroup(groupId);
  for (const reminder of reminders) {
    const metadata = await repositories.trainingReminderRepository.getScheduleMetadata(reminder.id);
    await cancelTrainingReminderIds(metadata.notificationIds);
    await repositories.trainingReminderRepository.updateScheduleMetadata(reminder.id, { notificationIds: [] });
  }
  await repositories.trainingReminderRepository.disableByOwnerAndGroup(groupId);
}

/** Logout removes only this account's device schedules; synced business settings remain enabled. */
export async function cancelCurrentAccountTrainingReminderSchedules(): Promise<void> {
  const repositories = createLocalRepositories();
  const reminders = await repositories.trainingReminderRepository.getEnabledByOwner();
  for (const reminder of reminders) {
    const metadata = await repositories.trainingReminderRepository.getScheduleMetadata(reminder.id);
    await cancelTrainingReminderIds(metadata.notificationIds);
    await repositories.trainingReminderRepository.updateScheduleMetadata(reminder.id, { notificationIds: [] });
  }
}

export async function sendTrainingReminderTest(reminder: TrainingReminder): Promise<void> {
  await sendTrainingReminderTestNotification(reminder);
}

/** Run after a cloud restore or app relaunch: device-local IDs never travel through sync. */
export async function reconcileTrainingReminderSchedules(): Promise<void> {
  const repositories = createLocalRepositories();
  const reminders = await repositories.trainingReminderRepository.getEnabledByOwner();
  for (const reminder of reminders) {
    if (!reminder.groupId || !reminder.planId || !reminder.planCycleId) continue;
    const cycle = await repositories.planRepository.getActivePlanCycle({ groupId: reminder.groupId, planId: reminder.planId });
    if (!cycle || cycle.id !== reminder.planCycleId) {
      await disableTrainingRemindersForGroup(reminder.groupId);
      continue;
    }
    const metadata = await repositories.trainingReminderRepository.getScheduleMetadata(reminder.id);
    if (metadata.notificationIds.length > 0) continue;
    const result = await scheduleTrainingReminder(reminder);
    if (result.ok && result.notificationId) await repositories.trainingReminderRepository.updateScheduleMetadata(reminder.id, { notificationIds: [result.notificationId], lastScheduledAt: new Date().toISOString() });
  }
}
