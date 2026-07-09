import { initializeLocalDatabase, type createLocalRepositories } from '@/data/local';
import type { Group } from '@/domain/group/group.types';
import type { GroupMember } from '@/domain/member/member.types';
import type { PhaseType, PlanPhase, PlanTemplate } from '@/domain/plan/plan.types';
import { getRequiredCurrentUserId } from '@/data/local/accountScope';

type LocalRepositories = ReturnType<typeof createLocalRepositories>;

export type TrainingMainlineUser = {
  displayName?: string | null;
  userId?: string | null;
};

export type CreateTrainingGroupMainlineInput = TrainingMainlineUser & {
  baseGroup?: Group | null;
  name?: string;
};

export type EnsureTrainingGroupMainlineInput = TrainingMainlineUser & {
  groupName?: string;
  selectedGroupId?: string | null;
};

export type TrainingGroupMainlineResult = {
  createdGroup: boolean;
  createdMember: boolean;
  group: Group;
  member: GroupMember;
  members: GroupMember[];
};

export type ActivateTrainingPlanResult = {
  group: Group;
  phaseType: PhaseType;
};

function resolveDisplayName(input: TrainingMainlineUser, fallbackUserId: string): string {
  return input.displayName?.trim() || `LiftMark ${fallbackUserId.slice(-4)}`;
}

function resolvePhaseType(plan: PlanTemplate, phases: PlanPhase[]): PhaseType {
  const weekOnePhase = phases.find((phase) => phase.startWeek <= 1 && phase.endWeek >= 1);
  if (weekOnePhase) return weekOnePhase.type;
  if (phases[0]) return phases[0].type;
  if (plan.goal === 'strength') return 'strength';
  if (plan.goal === 'hypertrophy') return 'hypertrophy';
  return 'custom';
}

async function ensureOwnerMember(
  repositories: LocalRepositories,
  group: Group,
  input: TrainingMainlineUser,
): Promise<{ createdMember: boolean; member: GroupMember; members: GroupMember[] }> {
  const userId = input.userId?.trim() || await getRequiredCurrentUserId();
  const displayName = resolveDisplayName(input, userId);
  const members = await repositories.memberRepository.listMembers(group.id);
  const currentUserMember = members.find((member) => member.userId === userId);
  const ownerMember = members.find((member) => member.role === 'owner');

  if (currentUserMember) {
    const shouldBeOwner = !ownerMember || ownerMember.id === currentUserMember.id;
    if (currentUserMember.memberType !== 'real' || (shouldBeOwner && currentUserMember.role !== 'owner')) {
      const updated = await repositories.memberRepository.updateMember(currentUserMember.id, {
        localMemberId: currentUserMember.localMemberId ?? currentUserMember.id,
        memberType: 'real',
        role: shouldBeOwner ? 'owner' : currentUserMember.role,
        userId,
      });
      return {
        createdMember: false,
        member: updated,
        members: await repositories.memberRepository.listMembers(group.id),
      };
    }

    return { createdMember: false, member: currentUserMember, members };
  }

  if (ownerMember && (!ownerMember.userId || ownerMember.userId === userId)) {
    const updated = await repositories.memberRepository.updateMember(ownerMember.id, {
      displayName: ownerMember.displayName?.trim() || displayName,
      localMemberId: ownerMember.localMemberId ?? ownerMember.id,
      memberType: 'real',
      role: 'owner',
      userId,
    });
    return {
      createdMember: false,
      member: updated,
      members: await repositories.memberRepository.listMembers(group.id),
    };
  }

  const created = await repositories.memberRepository.createMember({
    displayName,
    groupId: group.id,
    memberType: 'real',
    role: members.length === 0 ? 'owner' : 'member',
    userId,
  });

  return {
    createdMember: true,
    member: created,
    members: await repositories.memberRepository.listMembers(group.id),
  };
}

export async function createTrainingGroupMainline(
  repositories: LocalRepositories,
  input: CreateTrainingGroupMainlineInput = {},
): Promise<TrainingGroupMainlineResult> {
  await initializeLocalDatabase();
  await getRequiredCurrentUserId();

  const baseGroup = input.baseGroup;
  const group = await repositories.groupRepository.createGroup({
    activePlanId: baseGroup?.activePlanId ?? '',
    currentPhaseType: baseGroup?.currentPhaseType ?? 'strength',
    currentWeek: baseGroup?.currentWeek ?? 1,
    fridayEnabled: baseGroup?.fridayEnabled ?? false,
    fridayStrategy: baseGroup?.fridayStrategy ?? 'default_rest',
    name: input.name?.trim() || '我的训练小组',
  });
  const memberResult = await ensureOwnerMember(repositories, group, input);

  return {
    createdGroup: true,
    createdMember: memberResult.createdMember,
    group,
    member: memberResult.member,
    members: memberResult.members,
  };
}

export async function ensureTrainingGroupMainline(
  repositories: LocalRepositories,
  input: EnsureTrainingGroupMainlineInput = {},
): Promise<TrainingGroupMainlineResult> {
  await initializeLocalDatabase();
  await getRequiredCurrentUserId();

  const groups = await repositories.groupRepository.listGroups();
  const group =
    (input.selectedGroupId ? groups.find((item) => item.id === input.selectedGroupId) : undefined) ??
    groups[0] ??
    null;

  if (!group) {
    return createTrainingGroupMainline(repositories, {
      displayName: input.displayName,
      name: input.groupName,
      userId: input.userId,
    });
  }

  const memberResult = await ensureOwnerMember(repositories, group, input);
  return {
    createdGroup: false,
    createdMember: memberResult.createdMember,
    group,
    member: memberResult.member,
    members: memberResult.members,
  };
}

export async function activateTrainingPlanForGroup(
  repositories: LocalRepositories,
  input: { group: Group; plan: PlanTemplate },
): Promise<ActivateTrainingPlanResult> {
  await initializeLocalDatabase();
  await getRequiredCurrentUserId();

  const phases = await repositories.planRepository.listPlanPhases(input.plan.id);
  const phaseType = resolvePhaseType(input.plan, phases);
  const group = await repositories.groupRepository.updateGroup(input.group.id, {
    activePlanId: input.plan.id,
    currentPhaseType: phaseType,
    currentWeek: 1,
  });

  return { group, phaseType };
}
