import { getDatabase } from '../db';
import { SQLiteExerciseRepository } from './exerciseRepository';
import { SQLiteGroupRepository } from './groupRepository';
import { SQLiteMemberRepository } from './memberRepository';
import { SQLitePlanRepository } from './planRepository';
import { SQLiteProgressionRepository } from './progressionRepository';
import { SQLiteWorkoutRepository } from './workoutRepository';

export function createLocalRepositories() {
  return {
    exerciseRepository: new SQLiteExerciseRepository(getDatabase),
    groupRepository: new SQLiteGroupRepository(getDatabase),
    memberRepository: new SQLiteMemberRepository(getDatabase),
    planRepository: new SQLitePlanRepository(getDatabase),
    workoutRepository: new SQLiteWorkoutRepository(getDatabase),
    progressionRepository: new SQLiteProgressionRepository(getDatabase),
  };
}
