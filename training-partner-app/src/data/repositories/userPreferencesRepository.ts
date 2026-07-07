import type { UpsertUserPreferencesInput, UserPreferences } from '@/domain/preferences/user-preferences.types';

export interface UserPreferencesRepository {
  getPreferences(): Promise<UserPreferences>;
  upsertPreferences(input: UpsertUserPreferencesInput): Promise<UserPreferences>;
}
