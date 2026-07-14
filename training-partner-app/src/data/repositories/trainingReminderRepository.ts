import type {
  TrainingReminder,
  TrainingReminderScheduleMetadata,
  UpsertTrainingReminderInput,
} from '@/domain/reminder/trainingReminder.types';

export interface TrainingReminderRepository {
  getEnabledByOwner(): Promise<TrainingReminder[]>;
  listByOwnerAndGroup(groupId: string): Promise<TrainingReminder[]>;
  upsert(input: UpsertTrainingReminderInput): Promise<TrainingReminder>;
  disableByOwnerAndGroup(groupId: string): Promise<TrainingReminder[]>;
  softDelete(id: string): Promise<void>;
  updateScheduleMetadata(id: string, metadata: TrainingReminderScheduleMetadata): Promise<void>;
  getScheduleMetadata(id: string): Promise<TrainingReminderScheduleMetadata>;
}
