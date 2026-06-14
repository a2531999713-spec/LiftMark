import { createId } from '@/domain/common/ids';
import type { ActivationRepository, ActivationState } from '@/domain/activation/activation.types';

import type { DatabaseProvider } from '../repositories/base';

type ActivationRow = {
  id: string;
  is_activated: number;
  activation_code: string | null;
  activated_at: string | null;
  trial_started_at: string;
  trial_expires_at: string;
  device_id: string;
  app_version: string;
  created_at: string;
  updated_at: string;
};

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString();
}

function mapActivationState(row: ActivationRow): ActivationState {
  return {
    id: row.id,
    isActivated: row.is_activated === 1,
    activationCode: row.activation_code ?? undefined,
    activatedAt: row.activated_at ?? undefined,
    trialStartedAt: row.trial_started_at,
    trialExpiresAt: row.trial_expires_at,
    deviceId: row.device_id,
    appVersion: row.app_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class LocalActivationRepository implements ActivationRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getState(appVersion: string): Promise<ActivationState> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ActivationRow>(
      'SELECT * FROM activation_state ORDER BY created_at ASC LIMIT 1',
    );

    if (row) {
      return mapActivationState(row);
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const state: ActivationState = {
      id: 'activation_local',
      isActivated: false,
      trialStartedAt: nowIso,
      trialExpiresAt: addDays(now, 14),
      deviceId: createId('device'),
      appVersion,
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    return this.saveState(state);
  }

  async saveState(state: ActivationState): Promise<ActivationState> {
    const db = await this.getDb();

    await db.runAsync(
      `INSERT OR REPLACE INTO activation_state (
        id, is_activated, activation_code, activated_at, trial_started_at,
        trial_expires_at, device_id, app_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      state.id,
      state.isActivated ? 1 : 0,
      state.activationCode ?? null,
      state.activatedAt ?? null,
      state.trialStartedAt,
      state.trialExpiresAt,
      state.deviceId,
      state.appVersion,
      state.createdAt,
      state.updatedAt,
    );

    return state;
  }
}
