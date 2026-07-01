import { z } from 'zod';

import { LOCAL_GROUP_LIMITS } from '@/config/appLimits';
import { DEFAULT_BARBELL_INCREMENT, DEFAULT_DUMBBELL_INCREMENT } from '@/domain/weight/weight-calculator';

export const MIN_GROUP_MEMBERS = LOCAL_GROUP_LIMITS.minMembersPerGroup;
export const MAX_GROUP_MEMBERS = LOCAL_GROUP_LIMITS.maxMembersPerGroup;

const optionalPositiveNumber = z
  .number('请输入数字。')
  .positive('必须大于 0。')
  .finite()
  .optional();

export const memberFormSchema = z.object({
  displayName: z.string().trim().min(1, '请输入昵称。').max(40, '昵称太长。'),
  bodyweight: optionalPositiveNumber,
  bench1RM: optionalPositiveNumber,
  squat1RM: optionalPositiveNumber,
  deadlift1RM: optionalPositiveNumber,
  overheadPress1RM: optionalPositiveNumber,
  pullupReferenceWeight: optionalPositiveNumber,
  barbellIncrement: z
    .number('请输入数字。')
    .positive('必须大于 0。')
    .max(20, '加重单位过大。'),
  dumbbellIncrement: z
    .number('请输入数字。')
    .positive('必须大于 0。')
    .max(20, '加重单位过大。'),
});

export type MemberFormValues = z.infer<typeof memberFormSchema>;

export const defaultMemberFormValues: MemberFormValues = {
  displayName: '',
  bodyweight: undefined,
  bench1RM: undefined,
  squat1RM: undefined,
  deadlift1RM: undefined,
  overheadPress1RM: undefined,
  pullupReferenceWeight: undefined,
  barbellIncrement: DEFAULT_BARBELL_INCREMENT,
  dumbbellIncrement: DEFAULT_DUMBBELL_INCREMENT,
};

export function canAddGroupMember(currentMemberCount: number): boolean {
  return currentMemberCount < MAX_GROUP_MEMBERS;
}
