export type MembershipTier = 'free' | 'pro' | 'lifetime';

export type AuthMode =
  | 'guest_preview'
  | 'logged_in_free'
  | 'logged_in_pro'
  | 'logged_in_lifetime';

export type FeatureKey =
  | 'view_explore'
  | 'view_system_plan'
  | 'view_plan_detail'
  | 'view_membership_benefits'
  | 'start_workout'
  | 'save_workout'
  | 'add_member'
  | 'create_group'
  | 'edit_group'
  | 'create_plan'
  | 'edit_plan'
  | 'import_plan'
  | 'share_plan'
  | 'view_real_history'
  | 'manual_history'
  | 'activate_code'
  | 'purchase_membership'
  | 'cloud_sync'
  | 'online_training'
  | 'advanced_history'
  | 'group_analytics'
  | 'pro_group';

export type AccessReason = 'login_required' | 'pro_required' | 'limit_reached' | 'coming_soon';

export type AccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      message: string;
      reason: AccessReason;
      title: string;
    };

export type BlockedAccessDecision = Extract<AccessDecision, { allowed: false }>;

export type AccessContext = {
  authMode: AuthMode;
  editablePlanCount?: number;
  groupCount?: number;
  memberCount?: number;
  userPlanCount?: number;
};
