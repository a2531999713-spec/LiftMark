import type { ID } from '../common/ids';
import type { PhaseType } from '../plan/plan.types';

export type FridayStrategy = 'default_rest' | 'allow_weak' | 'allow_free';

export type Group = {
  id: ID;
  name: string;
  ownerUserId?: ID;
  activePlanId: ID;
  currentPhaseType: PhaseType;
  currentWeek: number;
  fridayEnabled: boolean;
  fridayStrategy: FridayStrategy;
  createdAt: string;
  updatedAt: string;
};

export type CreateGroupInput = {
  id?: ID;
  name: string;
  ownerUserId?: ID;
  activePlanId: ID;
  currentPhaseType: PhaseType;
  currentWeek?: number;
  fridayEnabled?: boolean;
  fridayStrategy?: FridayStrategy;
};
