export type AppScope = {
  userId: string;
  groupId: string | null;
  memberId: string | null;
  activePlanId: string | null;
  activePlanCycleId: string | null;
};

export type AppScopeState =
  | { status: 'loading'; scope: null }
  | { status: 'noAccount'; scope: null }
  | { status: 'ready'; scope: AppScope }
  | { status: 'error'; scope: AppScope | null; message: string };

export const createEmptyAppScope = (userId: string): AppScope => ({
  userId,
  groupId: null,
  memberId: null,
  activePlanId: null,
  activePlanCycleId: null,
});

export function isSessionVisibleInScope(
  scope: AppScope,
  session: { groupId: string; ownerUserId?: string | null; planCycleId?: string | null; planId?: string | null },
): boolean {
  if (session.ownerUserId && session.ownerUserId !== scope.userId) return false;
  if (scope.groupId && session.groupId !== scope.groupId) return false;
  if (scope.activePlanId && session.planId && session.planId !== scope.activePlanId) return false;
  if (scope.activePlanCycleId && session.planCycleId && session.planCycleId !== scope.activePlanCycleId) return false;
  return true;
}
