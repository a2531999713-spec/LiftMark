import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import type { BodyMetricsRepository } from '@/data/repositories/bodyMetricsRepository';
import type { BodyMetric, BodyMetricGoal, UpsertBodyMetricGoalInput, UpsertBodyMetricInput } from '@/domain/body/body-metrics.types';

import type { DatabaseProvider } from './base';

type BodyMetricRow = {
  id: string;
  member_id: string;
  date: string;
  weight_kg: number | null;
  body_fat_percent: number | null;
  chest_cm: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  bicep_cm: number | null;
  thigh_cm: number | null;
  calf_cm: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type BodyMetricGoalRow = {
  id: string;
  member_id: string;
  goal_type: BodyMetricGoal['goalType'];
  target_weight_kg: number | null;
  target_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function mapBodyMetric(row: BodyMetricRow): BodyMetric {
  return {
    id: row.id,
    memberId: row.member_id,
    date: row.date,
    weightKg: row.weight_kg ?? undefined,
    bodyFatPercent: row.body_fat_percent ?? undefined,
    chestCm: row.chest_cm ?? undefined,
    waistCm: row.waist_cm ?? undefined,
    hipCm: row.hip_cm ?? undefined,
    bicepCm: row.bicep_cm ?? undefined,
    thighCm: row.thigh_cm ?? undefined,
    calfCm: row.calf_cm ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBodyMetricGoal(row: BodyMetricGoalRow): BodyMetricGoal {
  return {
    id: row.id,
    memberId: row.member_id,
    goalType: row.goal_type,
    targetWeightKg: row.target_weight_kg ?? undefined,
    targetDate: row.target_date ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SQLiteBodyMetricsRepository implements BodyMetricsRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async getGoal(memberId: string): Promise<BodyMetricGoal | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<BodyMetricGoalRow>(
      'SELECT * FROM body_metric_goals WHERE member_id = ? ORDER BY updated_at DESC LIMIT 1',
      memberId,
    );
    return row ? mapBodyMetricGoal(row) : null;
  }

  async getMetricForDate(memberId: string, date: string): Promise<BodyMetric | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<BodyMetricRow>(
      'SELECT * FROM body_metrics WHERE member_id = ? AND date = ? ORDER BY updated_at DESC LIMIT 1',
      memberId,
      date,
    );
    return row ? mapBodyMetric(row) : null;
  }

  async listMetrics(memberId: string, limit = 80): Promise<BodyMetric[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<BodyMetricRow>(
      'SELECT * FROM body_metrics WHERE member_id = ? ORDER BY date DESC, updated_at DESC LIMIT ?',
      memberId,
      limit,
    );
    return rows.map(mapBodyMetric);
  }

  async upsertGoal(input: UpsertBodyMetricGoalInput): Promise<BodyMetricGoal> {
    const db = await this.getDb();
    const now = nowIso();
    const existing = await this.getGoal(input.memberId);
    const goal: BodyMetricGoal = {
      id: existing?.id ?? createId('body_goal'),
      memberId: input.memberId,
      goalType: input.goalType,
      targetWeightKg: input.targetWeightKg,
      targetDate: input.targetDate?.trim() || undefined,
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO body_metric_goals (
        id, member_id, goal_type, target_weight_kg, target_date, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        goal_type = excluded.goal_type,
        target_weight_kg = excluded.target_weight_kg,
        target_date = excluded.target_date,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      goal.id,
      goal.memberId,
      goal.goalType,
      goal.targetWeightKg ?? null,
      goal.targetDate ?? null,
      goal.notes ?? null,
      goal.createdAt,
      goal.updatedAt,
    );

    return goal;
  }

  async upsertMetric(input: UpsertBodyMetricInput): Promise<BodyMetric> {
    const db = await this.getDb();
    const now = nowIso();
    const existing = await this.getMetricForDate(input.memberId, input.date);
    const metric: BodyMetric = {
      id: existing?.id ?? createId('body_metric'),
      memberId: input.memberId,
      date: input.date,
      weightKg: input.weightKg,
      bodyFatPercent: input.bodyFatPercent,
      chestCm: input.chestCm,
      waistCm: input.waistCm,
      hipCm: input.hipCm,
      bicepCm: input.bicepCm,
      thighCm: input.thighCm,
      calfCm: input.calfCm,
      notes: input.notes?.trim() || undefined,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    await db.runAsync(
      `INSERT INTO body_metrics (
        id, member_id, date, weight_kg, body_fat_percent, chest_cm, waist_cm,
        hip_cm, bicep_cm, thigh_cm, calf_cm, notes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        date = excluded.date,
        weight_kg = excluded.weight_kg,
        body_fat_percent = excluded.body_fat_percent,
        chest_cm = excluded.chest_cm,
        waist_cm = excluded.waist_cm,
        hip_cm = excluded.hip_cm,
        bicep_cm = excluded.bicep_cm,
        thigh_cm = excluded.thigh_cm,
        calf_cm = excluded.calf_cm,
        notes = excluded.notes,
        updated_at = excluded.updated_at`,
      metric.id,
      metric.memberId,
      metric.date,
      metric.weightKg ?? null,
      metric.bodyFatPercent ?? null,
      metric.chestCm ?? null,
      metric.waistCm ?? null,
      metric.hipCm ?? null,
      metric.bicepCm ?? null,
      metric.thighCm ?? null,
      metric.calfCm ?? null,
      metric.notes ?? null,
      metric.createdAt,
      metric.updatedAt,
    );

    return metric;
  }
}
