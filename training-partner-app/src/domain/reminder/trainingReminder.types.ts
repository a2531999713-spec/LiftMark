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

