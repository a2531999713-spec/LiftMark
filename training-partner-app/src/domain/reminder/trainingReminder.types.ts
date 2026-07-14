import type { ID } from '../common/ids';

export type TrainingReminderType =
  | 'fixed_time'
  | 'before_workout'
  | 'today_plan'
  | 'missed_workout'
  | 'cycle_review';

export type TrainingReminder = {
  id: ID;
  ownerUserId?: ID;
  groupId?: ID;
  planId?: ID;
  planCycleId?: ID;
  type: TrainingReminderType;
  enabled: boolean;
  weekday?: number;
  remindTime?: string;
  minutesBefore?: number;
  timezone: string;
  titleTemplate: string;
  bodyTemplate: string;
  lastScheduledAt?: string;
  lastFiredAt?: string;
  createdAt: string;
  updatedAt: string;
};

/** Expo identifiers are device-runtime state and deliberately never synced. */
export type TrainingReminderScheduleMetadata = {
  notificationIds: string[];
  lastScheduledAt?: string;
};

export type TrainingReminderSettings = {
  enabled: boolean;
  weekdays: number[];
  remindTime: string;
  beforeThirtyMinutes: boolean;
  beforeTenMinutes: boolean;
  todayPlan: boolean;
};

export type UpsertTrainingReminderInput = Omit<TrainingReminder, 'id' | 'createdAt' | 'updatedAt' | 'lastScheduledAt' | 'lastFiredAt'> & {
  id?: ID;
};

