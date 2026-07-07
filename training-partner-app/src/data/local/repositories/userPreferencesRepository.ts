import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { UserPreferencesRepository } from '@/data/repositories/userPreferencesRepository';
import type {
  DefaultRecordTarget,
  DefaultTrainingMode,
  EffortDisplay,
  UpsertUserPreferencesInput,
  UserPreferences,
  WeightIncrement,
  WeightUnit,
} from '@/domain/preferences/user-preferences.types';

import type { DatabaseProvider } from './base';
import { getCurrentAccountUserId, getOwnerUserIdForWrite } from '../accountScope';

type UserPreferencesRow = {
  id: string;
  owner_user_id: string | null;
  weight_unit: WeightUnit;
  default_record_target: DefaultRecordTarget;
  rest_timer_enabled: number;
  default_training_mode: DefaultTrainingMode;
  weight_increment: WeightIncrement;
  effort_display: EffortDisplay;
  created_at: string;
  updated_at: string;
};

function mapPreferences(row: UserPreferencesRow): UserPreferences {
  return {
    id: row.id,
    weightUnit: row.weight_unit,
    defaultRecordTarget: row.default_record_target,
    restTimerEnabled: row.rest_timer_enabled === 1,
    defaultTrainingMode: row.default_training_mode,
    weightIncrement: row.weight_increment,
    effortDisplay: row.effort_display,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteUserPreferencesRepository implements UserPreferencesRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getPreferences(): Promise<UserPreferences> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const row = await db.getFirstAsync<UserPreferencesRow>(
      `SELECT * FROM user_preferences
       WHERE owner_user_id = ? OR owner_user_id IS NULL
       ORDER BY (owner_user_id IS NULL) ASC, updated_at DESC
       LIMIT 1`,
      userId ?? '',
    );
    return row ? mapPreferences(row) : {
      id: 'default',
      weightUnit: 'kg',
      defaultRecordTarget: 'group_members',
      restTimerEnabled: true,
      defaultTrainingMode: 'full',
      weightIncrement: '2.5kg',
      effortDisplay: 'none',
      createdAt: '',
      updatedAt: '',
    };
  }

  async upsertPreferences(input: UpsertUserPreferencesInput): Promise<UserPreferences> {
    const db = await this.getDb();
    const userId = await getCurrentAccountUserId();
    const ownerUserId = getOwnerUserIdForWrite(userId);
    const now = nowIso();

    // 查找当前账号已有偏好
    const existing = await db.getFirstAsync<UserPreferencesRow>(
      `SELECT * FROM user_preferences
       WHERE owner_user_id = ?
       LIMIT 1`,
      ownerUserId ?? '',
    );

    const id = existing?.id ?? createId('user_pref');
    const preferences: UserPreferences = {
      id,
      weightUnit: input.weightUnit,
      defaultRecordTarget: input.defaultRecordTarget,
      restTimerEnabled: input.restTimerEnabled,
      defaultTrainingMode: input.defaultTrainingMode,
      weightIncrement: input.weightIncrement,
      effortDisplay: input.effortDisplay,
      createdAt: existing?.created_at ?? now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO user_preferences (
        id, owner_user_id, weight_unit, default_record_target, rest_timer_enabled,
        default_training_mode, weight_increment, effort_display, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        weight_unit = excluded.weight_unit,
        default_record_target = excluded.default_record_target,
        rest_timer_enabled = excluded.rest_timer_enabled,
        default_training_mode = excluded.default_training_mode,
        weight_increment = excluded.weight_increment,
        effort_display = excluded.effort_display,
        updated_at = excluded.updated_at`,
      preferences.id,
      ownerUserId,
      preferences.weightUnit,
      preferences.defaultRecordTarget,
      preferences.restTimerEnabled ? 1 : 0,
      preferences.defaultTrainingMode,
      preferences.weightIncrement,
      preferences.effortDisplay,
      preferences.createdAt,
      preferences.updatedAt,
    );

    return preferences;
  }
}
