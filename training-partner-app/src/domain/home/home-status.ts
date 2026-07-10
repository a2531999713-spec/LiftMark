import type { AuthStatus } from '@/services/auth/authTypes';
import type { PlanTemplate } from '@/domain/plan/plan.types';

// 首页训练状态枚举。对应 AGENTS.md 要求的区分：
// noAccount / noGroup / noMember / noActivePlan / planCompleted / planArchived /
// planAbandoned / planNotReady / restDay / ready / error。
export type HomeStatus =
  | 'noAccount'
  | 'noGroup'
  | 'noMember'
  | 'noActivePlan'
  | 'planCompleted'
  | 'planArchived'
  | 'planAbandoned'
  | 'planNotReady'
  | 'restDay'
  | 'ready'
  | 'error';

export type ResolveHomeStatusInput = {
  /** 当前鉴权状态；未登录时直接归为 noAccount */
  authStatus?: AuthStatus;
  /** 当前账号可见的小组数量 */
  groupsCount: number;
  /** 当前小组成员数量 */
  membersCount: number;
  /** 小组 activePlanId 指向的原始计划（未做 active 过滤），用于识别 completed/archived/abandoned */
  rawActivePlan: PlanTemplate | null;
  /** 经过 isTrainablePlan 过滤后可用于训练的计划 */
  activePlan: PlanTemplate | null;
  /** 今日训练解析结果（null 表示解析失败，例如阶段不匹配） */
  todayPlanExists: boolean;
  /** 是否为休息日 / 无动作状态 */
  isRestState: boolean;
  /** 是否发生加载错误 */
  hasError: boolean;
};

function isSystemPlan(plan: PlanTemplate | null): boolean {
  return Boolean(plan && (plan.source === 'system' || plan.visibility === 'system'));
}

/**
 * 将首页数据收敛为一个明确的状态枚举，便于：
 * 1. UI 选择精准的空状态文案（而不是统一显示「计划未就绪」）。
 * 2. 单元测试覆盖各断点（无小组 / 无计划 / 计划归档 / 阶段不匹配等）。
 *
 * 判定顺序与 app/(tabs)/today.tsx 的渲染分支保持一致，避免引入行为回退。
 */
export function resolveHomeStatus(input: ResolveHomeStatusInput): HomeStatus {
  if (input.hasError) return 'error';

  if (input.authStatus && input.authStatus === 'unauthenticated') return 'noAccount';

  if (input.groupsCount === 0) return 'noGroup';

  // 计划不可训练：可能是没有 activePlanId，或指向的计划已完成/归档/放弃。
  if (!input.activePlan) {
    const raw = input.rawActivePlan;
    if (!isSystemPlan(raw) && raw?.status && raw.status !== 'active' && raw.status !== 'draft') {
      if (raw.status === 'completed') return 'planCompleted';
      if (raw.status === 'archived') return 'planArchived';
      if (raw.status === 'abandoned') return 'planAbandoned';
    }
    return 'noActivePlan';
  }

  // 与 today.tsx 一致：activePlan 存在时先判成员，再判今日计划。
  if (input.membersCount === 0) return 'noMember';

  if (input.isRestState) return 'restDay';

  // activePlan + 成员齐备，但今日计划解析失败（常见于阶段不匹配 / 计划结构缺失）。
  if (!input.todayPlanExists) return 'planNotReady';

  return 'ready';
}
