import { getDatabase } from '../db';
import { SQLiteBodyMetricsRepository } from './bodyMetricsRepository';
import { SQLiteExerciseRepository } from './exerciseRepository';
import { SQLiteGroupRepository } from './groupRepository';
import { SQLiteMemberRepository } from './memberRepository';
import { SQLitePlanRepository } from './planRepository';
import { SQLiteProgressionRepository } from './progressionRepository';
import { SQLiteUserPreferencesRepository } from './userPreferencesRepository';
import { SQLiteWorkoutRepository } from './workoutRepository';
import { SQLiteTrainingReportRepository } from './trainingReportRepository';
import { SQLiteTrainingReminderRepository } from './trainingReminderRepository';
import { SQLiteHistoryRepository } from './historyRepository';

export function createLocalRepositories() {
  return {
    bodyMetricsRepository: new SQLiteBodyMetricsRepository(getDatabase),
    exerciseRepository: new SQLiteExerciseRepository(getDatabase),
    groupRepository: new SQLiteGroupRepository(getDatabase),
    historyRepository: new SQLiteHistoryRepository(getDatabase),
    memberRepository: new SQLiteMemberRepository(getDatabase),
    planRepository: new SQLitePlanRepository(getDatabase),
    userPreferencesRepository: new SQLiteUserPreferencesRepository(getDatabase),
    workoutRepository: new SQLiteWorkoutRepository(getDatabase),
    progressionRepository: new SQLiteProgressionRepository(getDatabase),
    trainingReportRepository: new SQLiteTrainingReportRepository(getDatabase),
    trainingReminderRepository: new SQLiteTrainingReminderRepository(getDatabase),
  };
}
