import { readStoredSession } from '@/services/auth/tokenStorage';

export type AccountScope = {
  params: string[];
  where: string;
};

export type CurrentAccountScope =
  | {
      status: 'authenticated';
      userId: string;
    }
  | {
      status: 'noAccount';
      userId: null;
    };

export const NO_ACCOUNT_ERROR_MESSAGE = 'No authenticated account is available.';

export async function getCurrentAccountUserId(): Promise<string | null> {
  const session = await readStoredSession();
  return session?.user.id ?? null;
}

export async function getCurrentAccountScope(): Promise<CurrentAccountScope> {
  const userId = await getCurrentAccountUserId();
  return userId ? { status: 'authenticated', userId } : { status: 'noAccount', userId: null };
}

export async function getRequiredCurrentUserId(): Promise<string> {
  const userId = await getCurrentAccountUserId();
  if (!userId) {
    throw new Error(NO_ACCOUNT_ERROR_MESSAGE);
  }
  return userId;
}

export function getCurrentGroupScope(userId: string | null, groupAlias = 'groups'): AccountScope {
  return getGroupAccountScope(userId, groupAlias);
}

export function assertOwnerUser(entity: { ownerUserId?: string | null; owner_user_id?: string | null }, currentUserId: string): void {
  const ownerUserId = entity.ownerUserId ?? entity.owner_user_id ?? null;
  if (ownerUserId && ownerUserId !== currentUserId) {
    throw new Error('Entity is not owned by the current account.');
  }
}

export function assertGroupBelongsToUser(
  group: { ownerUserId?: string | null; owner_user_id?: string | null; memberUserIds?: string[] },
  currentUserId: string,
): void {
  const ownerUserId = group.ownerUserId ?? group.owner_user_id ?? null;
  if (ownerUserId === currentUserId) return;
  if (group.memberUserIds?.includes(currentUserId)) return;
  throw new Error('Group is not visible for the current account.');
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
    where: '1 = 0',
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
    where: `(${planPrefix}source = 'system' OR ${planPrefix}visibility = 'system')`,
    params: [],
  };
}

export function getOwnerUserIdForWrite(userId: string | null, requestedOwnerUserId?: string | null): string | null {
  if (userId) return userId;
  return requestedOwnerUserId ?? null;
}
