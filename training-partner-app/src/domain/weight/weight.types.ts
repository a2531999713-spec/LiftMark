import type { Equipment } from '../exercise/exercise.types';
import type { MemberProfile } from '../member/member.types';
import type { ReferenceLift } from '../plan/plan.types';

export type SuggestedWeightInput = {
  referenceLift: ReferenceLift;
  percent1RM?: number;
  equipment: Equipment;
  profile: MemberProfile;
};

export type SuggestedWeightResult =
  | {
      status: 'ready';
      weight: number;
    }
  | {
      status: 'missing_1rm' | 'manual';
      reason: string;
    };
