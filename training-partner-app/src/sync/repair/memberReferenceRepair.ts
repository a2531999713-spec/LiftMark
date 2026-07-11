export type MemberReferenceRepairResult = { repairedCount: number };

export function createMemberReferenceRepairResult(repairedCount: number): MemberReferenceRepairResult {
  return { repairedCount: Math.max(0, Math.trunc(repairedCount)) };
}
