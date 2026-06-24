import type { Knex } from 'knex';

import { db } from '../../db/connection';
import { createId } from '../../utils/ids';
import { addDays } from '../../utils/security';

export type MembershipType = 'free' | 'pro' | 'lifetime';
export type MembershipSource = 'activation_code' | 'admin_grant' | 'payment_reserved';

export type MembershipGrant = {
  durationDays?: number | null;
  isLifetime?: boolean;
  proGroupLimit?: number;
  source: MembershipSource;
  type: MembershipType;
};

export async function getOrCreateMembership(userId: string, trx?: Knex.Transaction) {
  const database = trx ?? db;
  const existing = await database('memberships').where({ user_id: userId }).first();
  if (existing) return existing;

  const now = new Date();
  const row = {
    id: createId('mem'),
    user_id: userId,
    type: 'free',
    source: 'admin_grant',
    starts_at: now,
    expires_at: null,
    is_lifetime: false,
    pro_group_limit: 0,
    activated_pro_group_count: 0,
    created_at: now,
    updated_at: now,
  };
  await database('memberships').insert(row);
  return row;
}

export async function grantMembership(userId: string, grant: MembershipGrant, trx?: Knex.Transaction) {
  const database = trx ?? db;
  const now = new Date();
  const current = await getOrCreateMembership(userId, trx);
  const isLifetime = grant.isLifetime || grant.type === 'lifetime';
  const expiresAt = isLifetime ? null : addDays(now, grant.durationDays ?? 365);

  const patch = {
    type: isLifetime ? 'lifetime' : grant.type,
    source: grant.source,
    starts_at: current.starts_at ?? now,
    expires_at: expiresAt,
    is_lifetime: isLifetime,
    pro_group_limit: grant.proGroupLimit ?? (isLifetime ? 2 : 2),
    updated_at: now,
  };

  await database('memberships').where({ user_id: userId }).update(patch);
  return database('memberships').where({ user_id: userId }).first();
}

export function toMembershipDto(row: any) {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    source: row.source,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    isLifetime: row.is_lifetime,
    proGroupLimit: row.pro_group_limit,
    activatedProGroupCount: row.activated_pro_group_count,
  };
}

