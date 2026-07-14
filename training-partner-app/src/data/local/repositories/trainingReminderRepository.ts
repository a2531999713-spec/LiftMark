import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type {
  TrainingReminder,
  TrainingReminderScheduleMetadata,
  UpsertTrainingReminderInput,
} from '@/domain/reminder/trainingReminder.types';
import type { TrainingReminderRepository } from '@/data/repositories/trainingReminderRepository';
import { enqueueSyncCandidate } from '@/sync/syncQueue';

import { getRequiredCurrentUserId } from '../accountScope';
import type { DatabaseProvider } from './base';

type ReminderRow = {
  id: string; owner_user_id: string; group_id: string | null; plan_id: string | null; plan_cycle_id: string | null;
  type: TrainingReminder['type']; enabled: number; weekday: number | null; remind_time: string | null;
  minutes_before: number | null; timezone: string; title_template: string; body_template: string;
  last_scheduled_at: string | null; last_fired_at: string | null; created_at: string; updated_at: string;
};

function mapReminder(row: ReminderRow): TrainingReminder {
  return {
    id: row.id, ownerUserId: row.owner_user_id, groupId: row.group_id ?? undefined, planId: row.plan_id ?? undefined,
    planCycleId: row.plan_cycle_id ?? undefined, type: row.type, enabled: row.enabled === 1, weekday: row.weekday ?? undefined,
    remindTime: row.remind_time ?? undefined, minutesBefore: row.minutes_before ?? undefined, timezone: row.timezone,
    titleTemplate: row.title_template, bodyTemplate: row.body_template, lastScheduledAt: row.last_scheduled_at ?? undefined,
    lastFiredAt: row.last_fired_at ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

function parseNotificationIds(value?: string | null): string[] {
  try {
    const ids = JSON.parse(value ?? '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch { return []; }
}

export class SQLiteTrainingReminderRepository implements TrainingReminderRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getEnabledByOwner(): Promise<TrainingReminder[]> {
    const db = await this.getDb(); const ownerUserId = await getRequiredCurrentUserId();
    const rows = await db.getAllAsync<ReminderRow>(
      `SELECT * FROM training_reminders WHERE owner_user_id = ? AND enabled = 1 AND deleted_at IS NULL ORDER BY weekday, type`, ownerUserId);
    return rows.map(mapReminder);
  }

  async listByOwnerAndGroup(groupId: string): Promise<TrainingReminder[]> {
    const db = await this.getDb(); const ownerUserId = await getRequiredCurrentUserId();
    const rows = await db.getAllAsync<ReminderRow>(
      `SELECT * FROM training_reminders WHERE owner_user_id = ? AND group_id = ? AND deleted_at IS NULL ORDER BY weekday, type`, ownerUserId, groupId);
    return rows.map(mapReminder);
  }

  async upsert(input: UpsertTrainingReminderInput): Promise<TrainingReminder> {
    const db = await this.getDb(); const ownerUserId = await getRequiredCurrentUserId(); const now = nowIso();
    const existing = input.id ? await db.getFirstAsync<ReminderRow>(
      `SELECT * FROM training_reminders WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`, input.id, ownerUserId) : null;
    const reminder: TrainingReminder = {
      ...input, id: existing?.id ?? createId('training_reminder'), ownerUserId, createdAt: existing?.created_at ?? now, updatedAt: now,
    };
    await db.runAsync(
      `INSERT INTO training_reminders (id, owner_user_id, group_id, plan_id, plan_cycle_id, type, enabled, weekday, remind_time, minutes_before, timezone, title_template, body_template, last_scheduled_at, last_fired_at, sync_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET group_id=excluded.group_id, plan_id=excluded.plan_id, plan_cycle_id=excluded.plan_cycle_id, type=excluded.type, enabled=excluded.enabled, weekday=excluded.weekday, remind_time=excluded.remind_time, minutes_before=excluded.minutes_before, timezone=excluded.timezone, title_template=excluded.title_template, body_template=excluded.body_template, sync_status=excluded.sync_status, deleted_at=NULL, updated_at=excluded.updated_at`,
      reminder.id, ownerUserId, reminder.groupId ?? null, reminder.planId ?? null, reminder.planCycleId ?? null, reminder.type,
      reminder.enabled ? 1 : 0, reminder.weekday ?? null, reminder.remindTime ?? null, reminder.minutesBefore ?? null,
      reminder.timezone, reminder.titleTemplate, reminder.bodyTemplate, existing?.last_scheduled_at ?? null, existing?.last_fired_at ?? null,
      existing ? 'pending_update' : 'pending_create', reminder.createdAt, now,
    );
    await enqueueSyncCandidate({ entityType: 'trainingReminders', localId: reminder.id, operation: existing ? 'update' : 'create', ownerUserId, payload: reminder, status: existing ? 'pending_update' : 'pending_create', updatedAt: now });
    return reminder;
  }

  async disableByOwnerAndGroup(groupId: string): Promise<TrainingReminder[]> {
    const reminders = await this.listByOwnerAndGroup(groupId);
    return Promise.all(reminders.map((reminder) => this.upsert({ ...reminder, enabled: false })));
  }

  async softDelete(id: string): Promise<void> {
    const db = await this.getDb(); const ownerUserId = await getRequiredCurrentUserId(); const now = nowIso();
    await db.runAsync(`UPDATE training_reminders SET deleted_at = ?, enabled = 0, sync_status = 'pending_delete', updated_at = ? WHERE id = ? AND owner_user_id = ?`, now, now, id, ownerUserId);
    await enqueueSyncCandidate({ entityType: 'trainingReminders', localId: id, operation: 'delete', ownerUserId, payload: { id, ownerUserId, deletedAt: now }, status: 'pending_delete', updatedAt: now });
  }

  async updateScheduleMetadata(id: string, metadata: TrainingReminderScheduleMetadata): Promise<void> {
    const db = await this.getDb(); const ownerUserId = await getRequiredCurrentUserId();
    await db.runAsync(`UPDATE training_reminders SET notification_ids_json = ?, last_scheduled_at = ?, updated_at = ? WHERE id = ? AND owner_user_id = ?`, JSON.stringify(metadata.notificationIds), metadata.lastScheduledAt ?? null, nowIso(), id, ownerUserId);
  }

  async getScheduleMetadata(id: string): Promise<TrainingReminderScheduleMetadata> {
    const db = await this.getDb(); const ownerUserId = await getRequiredCurrentUserId();
    const row = await db.getFirstAsync<{ notification_ids_json: string | null; last_scheduled_at: string | null }>(`SELECT notification_ids_json, last_scheduled_at FROM training_reminders WHERE id = ? AND owner_user_id = ? AND deleted_at IS NULL`, id, ownerUserId);
    return { notificationIds: parseNotificationIds(row?.notification_ids_json), lastScheduledAt: row?.last_scheduled_at ?? undefined };
  }
}
