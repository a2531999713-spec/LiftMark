import { describe, expect, it } from '@jest/globals';

import { describeOneRmStatus, hasAnyConfiguredOneRm } from '@/domain/member/member.service';
import type { MemberProfile } from '@/domain/member/member.types';
import {
  canAddGroupMember,
  defaultMemberFormValues,
  MAX_GROUP_MEMBERS,
  memberFormSchema,
} from '@/domain/member/member.validation';

function createProfile(patch: Partial<MemberProfile> = {}): MemberProfile {
  return {
    id: 'profile_1',
    memberId: 'member_1',
    groupId: 'group_1',
    barbellIncrement: 2.5,
    dumbbellIncrement: 2,
    createdAt: '2026-06-09T00:00:00.000Z',
    updatedAt: '2026-06-09T00:00:00.000Z',
    ...patch,
  };
}

describe('member domain rules', () => {
  it('allows fewer than five members and blocks the sixth member', () => {
    expect(MAX_GROUP_MEMBERS).toBe(5);
    expect(canAddGroupMember(0)).toBe(true);
    expect(canAddGroupMember(MAX_GROUP_MEMBERS - 1)).toBe(true);
    expect(canAddGroupMember(MAX_GROUP_MEMBERS)).toBe(false);
  });

  it('allows saving a member without 1RM values', () => {
    const result = memberFormSchema.safeParse({
      ...defaultMemberFormValues,
      displayName: 'Alex',
    });

    expect(result.success).toBe(true);
    expect(defaultMemberFormValues.dumbbellIncrement).toBe(2.5);
  });

  it('rejects a missing display name', () => {
    const result = memberFormSchema.safeParse({
      ...defaultMemberFormValues,
      displayName: '   ',
    });

    expect(result.success).toBe(false);
  });

  it('detects whether at least one 1RM is configured', () => {
    expect(hasAnyConfiguredOneRm(createProfile())).toBe(false);
    expect(hasAnyConfiguredOneRm(createProfile({ bench1RM: 100 }))).toBe(true);
  });

  it('returns a display status for missing or configured 1RM values', () => {
    expect(describeOneRmStatus(null)).toBe('未设置 1RM');
    expect(describeOneRmStatus(createProfile({ squat1RM: 120 }))).toBe('已设置 1RM');
  });
});
