// 计划结构兼容修复服务。
//
// 背景：新版 getTodayPlan() 对 plan_phases / plan_days / group.currentWeek / group.currentPhaseType
// 要求较严格。旧计划、导入计划、云端恢复计划可能存在以下结构问题，导致今日训练解析失败：
//   1. plan_phases 缺失（导入文件没有 phases / 云端恢复丢失）
//   2. plan_phases.type 与 group.currentPhaseType 不一致
//   3. group.currentWeek 超出 phase.startWeek/endWeek 范围
//   4. plan_days.phase_id 为空或指向不存在的 phase
//   5. plan_days.week 超出现有 phase 范围
//
// 本服务在不删除原始训练数据的前提下，对本地 SQLite 做非破坏性修复，让 getTodayPlan() 能正常解析。
// 对 176 主号只做本地 INSERT/UPDATE，不 DELETE；修复后入队 sync（planPhases/planDays/groups）。
import { createId } from '@/domain/common/ids';
import { nowIso } from '@/domain/common/time';
import { getDatabase } from '@/data/local/db';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';
import { enqueueSyncCandidate } from '@/sync/syncQueue';
import type { Group } from '@/domain/group/group.types';
import type { PhaseType, PlanDay, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import type { createLocalRepositories } from '@/data/local';

type LocalRepositories = ReturnType<typeof createLocalRepositories>;

type PhaseRow = {
  id: string;
  owner_user_id: string | null;
  plan_id: string;
  name: string;
  type: string;
  start_week: number;
  end_week: number;
  order_index: number;
};

type DayRow = {
  id: string;
  owner_user_id: string | null;
  plan_id: string;
  phase_id: string | null;
  week: number;
  weekday: number;
  title: string;
  focus: string;
  notes: string | null;
};

export type EnsurePlanStructureResult = {
  group: Group;
  plan: PlanTemplate;
  repaired: boolean;
  repairedItems: string[];
};

type UpdateGroupFn = LocalRepositories['groupRepository']['updateGroup'];

function inferPhaseTypeFromGoal(goal: PlanTemplate['goal']): PhaseType {
  if (goal === 'strength') return 'strength';
  if (goal === 'hypertrophy') return 'hypertrophy';
  if (goal === 'fat_loss') return 'conditioning';
  return 'custom';
}

function clampWeek(week: number, min: number, max: number): number {
  if (!Number.isFinite(week) || week < min) return min;
  if (week > max) return max;
  return Math.round(week);
}

function findPhaseCoveringWeek(phases: PlanPhase[], week: number): PlanPhase | null {
  return (
    phases.find((phase) => week >= phase.startWeek && week <= phase.endWeek) ?? null
  );
}

function findFirstPhaseByType(phases: PlanPhase[], type: PhaseType): PlanPhase | null {
  return phases.find((phase) => phase.type === type) ?? null;
}

/**
 * 修复本地计划结构，使其能被 getTodayPlan() 解析。
 *
 * 修复策略（非破坏性，仅 INSERT/UPDATE，不 DELETE）：
 * 1. plan_phases 为空但 plan_days 有 week → 创建默认 phase 覆盖全部 week 范围
 * 2. plan_days.phase_id 为空或悬空 → 按所属 week 找覆盖 phase 回填
 * 3. plan_days.week 超出现有 phase 范围 → 扩展第一个 phase 的 endWeek
 * 4. group.currentWeek 不在任何 phase 范围 → clamp 到可用范围
 * 5. group.currentPhaseType 找不到匹配 phase → 用覆盖 currentWeek 的 phase.type 更新
 *
 * 修复后入队 sync：planPhases(update)、planDays(update)、groups(update)。
 * 不入队 sync 的场景：无账号（getRequiredCurrentUserId 抛错时直接抛出，不执行修复）。
 */
export async function ensurePlanStructureCompatibleForGroup(input: {
  repositories: LocalRepositories;
  group: Group;
  plan: PlanTemplate;
}): Promise<EnsurePlanStructureResult> {
  const { repositories, group, plan } = input;
  // 必须有账号才能修复：owner_user_id 由 account scope 决定，且 sync queue 需要账号上下文
  const ownerUserId = await getRequiredCurrentUserId();
  const db = await getDatabase();

  const repairedItems: string[] = [];
  let currentGroup = group;
  let repaired = false;

  // 读取现有 phases（按 order_index）
  const phaseRows = await db.getAllAsync<PhaseRow>(
    `SELECT * FROM plan_phases WHERE plan_id = ? ORDER BY order_index ASC`,
    plan.id,
  );
  let phases: PlanPhase[] = phaseRows.map((row) => ({
    id: row.id,
    planId: row.plan_id,
    name: row.name,
    type: row.type as PhaseType,
    startWeek: row.start_week,
    endWeek: row.end_week,
    orderIndex: row.order_index,
  }));

  // 读取现有 days（按 week, weekday）
  const dayRows = await db.getAllAsync<DayRow>(
    `SELECT * FROM plan_days WHERE plan_id = ? ORDER BY week ASC, weekday ASC`,
    plan.id,
  );
  let days: PlanDay[] = dayRows.map((row) => ({
    id: row.id,
    planId: row.plan_id,
    phaseId: row.phase_id ?? '',
    week: row.week,
    weekday: row.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
    title: row.title,
    focus: row.focus,
    notes: row.notes ?? undefined,
  }));

  // --- 修复 1：plan_phases 为空但有 plan_days → 创建默认 phase ---
  if (phases.length === 0 && days.length > 0) {
    const weeks = days.map((day) => day.week).filter((w) => Number.isFinite(w));
    const minWeek = weeks.length > 0 ? Math.min(...weeks) : 1;
    const maxWeek = weeks.length > 0 ? Math.max(...weeks) : Math.max(1, plan.durationWeeks);
    const phaseType: PhaseType =
      group.currentPhaseType ?? inferPhaseTypeFromGoal(plan.goal);
    const phaseId = createId('phase_compat');
    const phaseName =
      phaseType === 'strength'
        ? '增力阶段'
        : phaseType === 'hypertrophy'
          ? '增肌阶段'
          : phaseType === 'deload'
            ? '减量周'
            : phaseType === 'conditioning'
              ? '体能阶段'
              : '训练阶段';

    await db.runAsync(
      `INSERT INTO plan_phases (
        id, owner_user_id, plan_id, name, type, start_week, end_week, order_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      phaseId,
      ownerUserId,
      plan.id,
      phaseName,
      phaseType,
      minWeek,
      maxWeek,
      1,
    );

    phases = [
      {
        id: phaseId,
        planId: plan.id,
        name: phaseName,
        type: phaseType,
        startWeek: minWeek,
        endWeek: maxWeek,
        orderIndex: 1,
      },
    ];
    repaired = true;
    repairedItems.push(`created default phase ${phaseId} (weeks ${minWeek}-${maxWeek}, type ${phaseType})`);

    await enqueueSyncCandidate({
      entityType: 'planPhases',
      localId: phaseId,
      operation: 'create',
      ownerUserId,
      status: 'pending_create',
      updatedAt: nowIso(),
    }).catch(() => undefined);
  }

  // --- 修复 2：plan_days.phase_id 为空或悬空 → 按所属 week 回填 ---
  if (phases.length > 0 && days.length > 0) {
    const phaseIds = new Set(phases.map((phase) => phase.id));
    const daysToFix: DayRow[] = [];
    for (const day of dayRows) {
      const phaseIdMissing = !day.phase_id || !phaseIds.has(day.phase_id);
      if (phaseIdMissing) {
        daysToFix.push(day);
      }
    }

    if (daysToFix.length > 0) {
      for (const day of daysToFix) {
        const coveringPhase = findPhaseCoveringWeek(phases, day.week) ?? phases[0];
        if (!coveringPhase) continue;
        await db.runAsync(
          `UPDATE plan_days SET phase_id = ? WHERE id = ?`,
          coveringPhase.id,
          day.id,
        );
        await enqueueSyncCandidate({
          entityType: 'planDays',
          localId: day.id,
          operation: 'update',
          ownerUserId,
          status: 'pending_update',
          updatedAt: nowIso(),
        }).catch(() => undefined);
      }
      repaired = true;
      repairedItems.push(`backfilled phase_id for ${daysToFix.length} plan_days`);
      // 重新读取 days 以反映修复
      const refreshedDayRows = await db.getAllAsync<DayRow>(
        `SELECT * FROM plan_days WHERE plan_id = ? ORDER BY week ASC, weekday ASC`,
        plan.id,
      );
      days = refreshedDayRows.map((row) => ({
        id: row.id,
        planId: row.plan_id,
        phaseId: row.phase_id ?? '',
        week: row.week,
        weekday: row.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        title: row.title,
        focus: row.focus,
        notes: row.notes ?? undefined,
      }));
    }
  }

  // --- 修复 3：plan_days.week 超出现有 phase 范围 → 扩展第一个 phase 的 endWeek ---
  if (phases.length > 0 && days.length > 0) {
    const firstPhase = phases[0];
    const maxDayWeek = Math.max(...days.map((day) => day.week));
    if (maxDayWeek > firstPhase.endWeek) {
      const newEndWeek = Math.max(firstPhase.endWeek, maxDayWeek);
      await db.runAsync(
        `UPDATE plan_phases SET end_week = ? WHERE id = ?`,
        newEndWeek,
        firstPhase.id,
      );
      await enqueueSyncCandidate({
        entityType: 'planPhases',
        localId: firstPhase.id,
        operation: 'update',
        ownerUserId,
        status: 'pending_update',
        updatedAt: nowIso(),
      }).catch(() => undefined);
      phases = phases.map((phase) =>
        phase.id === firstPhase.id ? { ...phase, endWeek: newEndWeek } : phase,
      );
      repaired = true;
      repairedItems.push(`extended phase ${firstPhase.id} endWeek to ${newEndWeek}`);
    }
  }

  // --- 修复 4 & 5：group.currentWeek / currentPhaseType 与 phases 不匹配 ---
  if (phases.length > 0) {
    const minPhaseWeek = Math.min(...phases.map((phase) => phase.startWeek));
    const maxPhaseWeek = Math.max(...phases.map((phase) => phase.endWeek));
    let nextWeek = currentGroup.currentWeek;
    let nextPhaseType = currentGroup.currentPhaseType;
    let groupNeedsUpdate = false;

    // currentWeek clamp
    if (!Number.isFinite(nextWeek) || nextWeek < minPhaseWeek || nextWeek > maxPhaseWeek) {
      const clamped = clampWeek(nextWeek, minPhaseWeek, maxPhaseWeek);
      if (clamped !== nextWeek) {
        nextWeek = clamped;
        groupNeedsUpdate = true;
        repairedItems.push(`clamped group.currentWeek ${currentGroup.currentWeek} -> ${nextWeek}`);
      }
    }

    // currentPhaseType 必须能匹配某个覆盖 currentWeek 的 phase
    const coveringPhase = findPhaseCoveringWeek(phases, nextWeek);
    const typeMatchedPhase =
      findFirstPhaseByType(phases, nextPhaseType) ??
      (coveringPhase ? findFirstPhaseByType(phases, coveringPhase.type) : null) ??
      phases[0];
    if (typeMatchedPhase && typeMatchedPhase.type !== nextPhaseType) {
      nextPhaseType = typeMatchedPhase.type;
      groupNeedsUpdate = true;
      repairedItems.push(`updated group.currentPhaseType ${currentGroup.currentPhaseType} -> ${nextPhaseType}`);
    }

    if (groupNeedsUpdate) {
      const updatedGroup = await (repositories.groupRepository.updateGroup as UpdateGroupFn)(
        currentGroup.id,
        {
          currentWeek: nextWeek,
          currentPhaseType: nextPhaseType,
        },
      );
      await enqueueSyncCandidate({
        entityType: 'groups',
        localId: currentGroup.id,
        operation: 'update',
        ownerUserId,
        status: 'pending_update',
        updatedAt: nowIso(),
      }).catch(() => undefined);
      currentGroup = { ...updatedGroup };
      repaired = true;
    }
  }

  return {
    group: currentGroup,
    plan,
    repaired,
    repairedItems,
  };
}

/**
 * 判断计划是否有训练日。用于首页区分「计划结构缺失可修复」与「计划确实没有训练日」。
 */
export function planHasTrainingDays(days: PlanDay[]): boolean {
  return days.length > 0;
}
