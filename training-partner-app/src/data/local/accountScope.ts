import { readStoredSession } from '@/services/auth/tokenStorage';

export type AccountScope = {
  params: string[];
  where: string;
};

export async function getCurrentAccountUserId(): Promise<string | null> {
  const session = await readStoredSession();
  return session?.user.id ?? null;
}

export function getGroupAccountScope(userId: string | null, groupAlias = 'groups'): AccountScope {
  const groupPrefix = groupAlias ? `${groupAlias}.` : '';

  if (userId) {
    return {
      where: `(${groupPrefix}owner_user_id = ? OR EXISTS (
        SELECT 1 FROM group_members account_scope_member
        WHERE account_scope_member.group_id = ${groupPrefix}id
          AND account_scope_member.user_id = ?
      ))`,
      params: [userId, userId],
    };
  }

  return {
    where: `(${groupPrefix}owner_user_id IS NULL AND NOT EXISTS (
      SELECT 1 FROM group_members account_scope_member
      WHERE account_scope_member.group_id = ${groupPrefix}id
        AND account_scope_member.user_id IS NOT NULL
        AND account_scope_member.user_id <> ''
    ))`,
    params: [],
  };
}

export function getPlanAccountScope(userId: string | null, planAlias = 'plan_templates'): AccountScope {
  const planPrefix = planAlias ? `${planAlias}.` : '';

  if (userId) {
    return {
      where: `(${planPrefix}source = 'system'
        OR ${planPrefix}visibility = 'system'
        OR ${planPrefix}creator_id = ?
        OR ${planPrefix}owner_user_id = ?
        OR EXISTS (
          SELECT 1 FROM groups account_scope_group
          WHERE account_scope_group.active_plan_id = ${planPrefix}id
            AND (
              account_scope_group.owner_user_id = ?
              OR EXISTS (
                SELECT 1 FROM group_members account_scope_group_member
                WHERE account_scope_group_member.group_id = account_scope_group.id
                  AND account_scope_group_member.user_id = ?
              )
            )
        ))`,
      params: [userId, userId, userId, userId],
    };
  }

  return {
    where: `(${planPrefix}source = 'system'
      OR ${planPrefix}visibility = 'system'
      OR (
        ${planPrefix}creator_id IS NULL
        AND ${planPrefix}owner_user_id IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM groups account_scope_group
          WHERE account_scope_group.active_plan_id = ${planPrefix}id
            AND EXISTS (
              SELECT 1 FROM group_members account_scope_group_member
              WHERE account_scope_group_member.group_id = account_scope_group.id
                AND account_scope_group_member.user_id IS NOT NULL
                AND account_scope_group_member.user_id <> ''
            )
        )
      ))`,
    params: [],
  };
}

export function getOwnerUserIdForWrite(userId: string | null, requestedOwnerUserId?: string | null): string | null {
  if (userId) return userId;
  return requestedOwnerUserId ?? null;
}
