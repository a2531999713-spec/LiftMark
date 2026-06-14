import type { ProgressionRepository } from '@/data/repositories/progressionRepository';
import type { ProgressionSuggestion } from '@/domain/progression/progression.types';

import type { DatabaseProvider } from './base';

type ProgressionSuggestionRow = {
  id: string;
  member_id: string;
  exercise_id: string;
  session_id: string;
  suggestion: ProgressionSuggestion['suggestion'];
  suggested_weight: number | null;
  reason: string;
  created_at: string;
};

function mapProgressionSuggestion(row: ProgressionSuggestionRow): ProgressionSuggestion {
  return {
    id: row.id,
    memberId: row.member_id,
    exerciseId: row.exercise_id,
    sessionId: row.session_id,
    suggestion: row.suggestion,
    suggestedWeight: row.suggested_weight ?? undefined,
    reason: row.reason,
    createdAt: row.created_at,
  };
}

export class SQLiteProgressionRepository implements ProgressionRepository {
  constructor(private readonly getDb: DatabaseProvider) {}

  async createSuggestionsForSession(sessionId: string): Promise<ProgressionSuggestion[]> {
    // The progression engine is implemented in Sprint 6. Keep the persistence boundary now.
    return this.listSuggestionsForSession(sessionId);
  }

  async listSuggestionsForMember(memberId: string): Promise<ProgressionSuggestion[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<ProgressionSuggestionRow>(
      'SELECT * FROM progression_suggestions WHERE member_id = ? ORDER BY created_at DESC',
      memberId,
    );
    return rows.map(mapProgressionSuggestion);
  }

  async getLatestSuggestion(
    memberId: string,
    exerciseId: string,
  ): Promise<ProgressionSuggestion | null> {
    const db = await this.getDb();
    const row = await db.getFirstAsync<ProgressionSuggestionRow>(
      `SELECT * FROM progression_suggestions
       WHERE member_id = ? AND exercise_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      memberId,
      exerciseId,
    );
    return row ? mapProgressionSuggestion(row) : null;
  }

  private async listSuggestionsForSession(sessionId: string): Promise<ProgressionSuggestion[]> {
    const db = await this.getDb();
    const rows = await db.getAllAsync<ProgressionSuggestionRow>(
      'SELECT * FROM progression_suggestions WHERE session_id = ? ORDER BY created_at DESC',
      sessionId,
    );
    return rows.map(mapProgressionSuggestion);
  }
}
