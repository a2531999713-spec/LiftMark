import type { AccessContext, AccessDecision, AuthMode, FeatureKey, MembershipTier } from './auth.types';

const LOGIN_REQUIRED_TITLE = '登录后开始记录训练';
const LOGIN_REQUIRED_MESSAGE =
  '训练记录会保存到账号中，换手机或重装后也能恢复数据。';

const PRO_REQUIRED_TITLE = '开通 Pro，解锁完整训练小组';
const PRO_REQUIRED_MESSAGE =
  'Pro 支持最多 4 人一起练、更多训练计划、完整计划编辑器、高级历史趋势、自动进阶建议、完整云同步和 2 个 Pro 小组。';

const guestAllowedFeatures = new Set<FeatureKey>();

const proOnlyFeatures = new Set<FeatureKey>([
  'advanced_history',
  'group_analytics',
  'online_training',
  'pro_group',
]);

export const LOGOUT_LOCAL_DATA_POLICY = {
  clearsLocalTrainingData: false,
  clearsSQLiteTrainingRecords: false,
  storesTrainingRecordsInAsyncStorage: false,
} as const;

export function deriveAuthMode(isLoggedIn: boolean, membershipTier: MembershipTier): AuthMode {
  if (!isLoggedIn) return 'guest_preview';
  if (membershipTier === 'lifetime') return 'logged_in_lifetime';
  if (membershipTier === 'pro') return 'logged_in_pro';
  return 'logged_in_free';
}

export function getMembershipTierFromAuthMode(authMode: AuthMode): MembershipTier {
  if (authMode === 'logged_in_lifetime') return 'lifetime';
  if (authMode === 'logged_in_pro') return 'pro';
  return 'free';
}

export function isLoggedInAuthMode(authMode: AuthMode) {
  return authMode !== 'guest_preview';
}

export function isProAuthMode(authMode: AuthMode) {
  return authMode === 'logged_in_pro' || authMode === 'logged_in_lifetime';
}

export function decideFeatureAccess(feature: FeatureKey, context: AccessContext): AccessDecision {
  if (context.authMode === 'guest_preview') {
    if (guestAllowedFeatures.has(feature)) {
      return { allowed: true };
    }

    return loginRequired();
  }

  if (feature === 'purchase_membership') {
    return comingSoon('购买入口', '支付系统正在开发中，后续版本开放。');
  }

  if (feature === 'add_member') {
    return decideMemberLimit(context);
  }

  if (feature === 'create_group') {
    return decideGroupLimit(context);
  }

  if (feature === 'create_plan') {
    return decidePlanLimit(context);
  }

  if (feature === 'edit_plan') {
    return decideEditablePlanLimit(context);
  }

  if (proOnlyFeatures.has(feature) && !isProAuthMode(context.authMode)) {
    return proRequired();
  }

  return { allowed: true };
}

function decideMemberLimit(context: AccessContext): AccessDecision {
  const memberCount = context.memberCount ?? 0;
  if (!isProAuthMode(context.authMode) && memberCount >= 2) {
    return proRequired('免费版最多支持 2 位训练成员。开通 Pro 后可扩展到 4 人小组。');
  }

  if (isProAuthMode(context.authMode) && memberCount >= 4) {
    return limitReached('小组人数已达上限', '当前会员权益最多支持 4 位训练成员。');
  }

  return { allowed: true };
}

function decideGroupLimit(context: AccessContext): AccessDecision {
  const groupCount = context.groupCount ?? 0;
  if (!isProAuthMode(context.authMode) && groupCount >= 1) {
    return proRequired('免费版最多支持 1 个基础训练小组。');
  }

  if (isProAuthMode(context.authMode) && groupCount >= 2) {
    return limitReached('Pro 小组已达上限', '当前权益最多可管理 2 个 Pro 小组。');
  }

  return { allowed: true };
}

function decidePlanLimit(context: AccessContext): AccessDecision {
  const userPlanCount = context.userPlanCount ?? 0;
  if (!isProAuthMode(context.authMode) && userPlanCount >= 3) {
    return proRequired('免费版最多保存 3 个我的计划。');
  }

  return { allowed: true };
}

function decideEditablePlanLimit(context: AccessContext): AccessDecision {
  const editablePlanCount = context.editablePlanCount ?? 0;
  if (!isProAuthMode(context.authMode) && editablePlanCount > 1) {
    return proRequired('免费版保留 1 个可编辑自定义训练方案。');
  }

  return { allowed: true };
}

function loginRequired(): AccessDecision {
  return {
    allowed: false,
    message: LOGIN_REQUIRED_MESSAGE,
    reason: 'login_required',
    title: LOGIN_REQUIRED_TITLE,
  };
}

function proRequired(message = PRO_REQUIRED_MESSAGE): AccessDecision {
  return {
    allowed: false,
    message,
    reason: 'pro_required',
    title: PRO_REQUIRED_TITLE,
  };
}

function limitReached(title: string, message: string): AccessDecision {
  return {
    allowed: false,
    message,
    reason: 'limit_reached',
    title,
  };
}

function comingSoon(title: string, message: string): AccessDecision {
  return {
    allowed: false,
    message,
    reason: 'coming_soon',
    title,
  };
}
