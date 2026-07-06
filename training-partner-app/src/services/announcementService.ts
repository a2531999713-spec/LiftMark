import { apiRequest } from './apiClient';
import { getDatabase } from '@/data/local/db';

const LAST_READ_ANNOUNCEMENT_KEY = 'last_read_announcement_id';

export type Announcement = {
  id: string;
  title: string;
  content: string;
  startsAt: string | null;
  endsAt: string | null;
};

type CurrentAnnouncementResponse = {
  announcement: Announcement | null;
};

export async function fetchCurrentAnnouncement(): Promise<Announcement | null> {
  try {
    const result = await apiRequest<CurrentAnnouncementResponse>('/announcements/current');
    return result.announcement;
  } catch (error) {
    console.warn('[announcement] fetch failed', error);
    return null;
  }
}

export async function getLastReadAnnouncementId(): Promise<string | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_state WHERE key = ?',
      LAST_READ_ANNOUNCEMENT_KEY,
    );
    return row?.value ?? null;
  } catch (error) {
    console.warn('[announcement] get last read failed', error);
    return null;
  }
}

export async function markAnnouncementRead(id: string): Promise<void> {
  try {
    const db = await getDatabase();
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_state (id, key, value, updated_at) VALUES (?, ?, ?, ?)',
      LAST_READ_ANNOUNCEMENT_KEY,
      LAST_READ_ANNOUNCEMENT_KEY,
      id,
      new Date().toISOString(),
    );
  } catch (error) {
    console.warn('[announcement] mark read failed', error);
  }
}

export async function shouldShowAnnouncement(announcement: Announcement): Promise<boolean> {
  const lastReadId = await getLastReadAnnouncementId();
  return lastReadId !== announcement.id;
}
