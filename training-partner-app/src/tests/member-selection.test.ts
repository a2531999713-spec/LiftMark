import { describe, expect, it } from '@jest/globals';

import { resolveDefaultTrainingMember } from '@/domain/member/member-selection';
import type { GroupMember } from '@/domain/member/member.types';

function member(patch: Partial<GroupMember>): GroupMember {
  return {
    createdAt: '2026-07-06T00:00:00.000Z',
    displayName: 'member',
    groupId: 'group_1',
    id: 'member_1',
    memberType: 'local',
    role: 'member',
    updatedAt: '2026-07-06T00:00:00.000Z',
    ...patch,
  };
}

describe('resolveDefaultTrainingMember', () => {
  it('prefers the local training identity over the logged-in account member', () => {
    const zhw = member({ displayName: 'zhw', id: 'member_zhw', memberType: 'local' });
    const accountMember = member({
      displayName: '练刻3716',
      id: 'member_account',
      memberType: 'real',
      userId: 'user_176',
    });

    expect(resolveDefaultTrainingMember([accountMember, zhw], 'user_176')).toBe(zhw);
  });

  it('keeps a locally-bound real member as the training identity', () => {
    const zhw = member({
      displayName: 'zhw',
      id: 'member_zhw',
      localMemberId: 'member_zhw',
      memberType: 'real',
      userId: 'user_176',
    });
    const accountMember = member({
      displayName: '练刻3716',
      id: 'member_account',
      memberType: 'real',
      userId: 'user_176',
    });

    expect(resolveDefaultTrainingMember([accountMember, zhw], 'user_176')).toBe(zhw);
  });
});
