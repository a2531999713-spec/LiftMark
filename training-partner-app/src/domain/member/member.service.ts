import type { MemberProfile } from './member.types';

export function hasAnyConfiguredOneRm(profile: MemberProfile): boolean {
  return Boolean(
    profile.bench1RM ??
      profile.squat1RM ??
      profile.deadlift1RM ??
      profile.overheadPress1RM ??
      profile.pullupReferenceWeight,
  );
}

export function describeOneRmStatus(profile: MemberProfile | null): string {
  if (!profile || !hasAnyConfiguredOneRm(profile)) {
    return '未设置 1RM';
  }

  return '已设置 1RM';
}
