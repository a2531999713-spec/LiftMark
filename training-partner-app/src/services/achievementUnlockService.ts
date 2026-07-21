import * as SecureStore from 'expo-secure-store';
import type { AchievementCode, AchievementProgress, AchievementSnapshot } from '@liftmark/shared';

const listeners = new Map<string, Set<() => void>>();

function seenKey(userId: string): string {
  return `achievement_seen_codes:${userId}`;
}

function pendingKey(userId: string): string {
  return `achievement_pending_unlocks:${userId}`;
}

async function readCodes(userId: string): Promise<Set<AchievementCode>> {
  const raw = await SecureStore.getItemAsync(seenKey(userId));
  if (!raw) return new Set();
  try {
    return new Set(JSON.parse(raw) as AchievementCode[]);
  } catch {
    return new Set();
  }
}

async function writeCodes(userId: string, codes: Set<AchievementCode>): Promise<void> {
  await SecureStore.setItemAsync(seenKey(userId), JSON.stringify([...codes].sort()));
}

export function resolveNewlyUnlocked(
  before: AchievementSnapshot,
  after: AchievementSnapshot,
  seenCodes: ReadonlySet<AchievementCode>,
): AchievementProgress[] {
  const previouslyAchieved = new Set(before.achievements.filter((item) => item.achieved).map((item) => item.code));
  return after.achievements.filter(
    (item) => item.achieved && !previouslyAchieved.has(item.code) && !seenCodes.has(item.code),
  );
}

export async function queueNewAchievementUnlocks(input: {
  userId: string;
  before: AchievementSnapshot | null;
  after: AchievementSnapshot;
}): Promise<AchievementProgress[]> {
  const seen = await readCodes(input.userId);
  if (!input.before) {
    input.after.achievements.filter((item) => item.achieved).forEach((item) => seen.add(item.code));
    await writeCodes(input.userId, seen);
    return [];
  }

  input.before.achievements.filter((item) => item.achieved).forEach((item) => seen.add(item.code));
  const unlocked = resolveNewlyUnlocked(input.before, input.after, seen);
  unlocked.forEach((item) => seen.add(item.code));
  await writeCodes(input.userId, seen);
  if (unlocked.length > 0) {
    await SecureStore.setItemAsync(pendingKey(input.userId), JSON.stringify(unlocked));
    listeners.get(input.userId)?.forEach((listener) => listener());
  }
  return unlocked;
}

export async function consumePendingAchievementUnlocks(userId: string): Promise<AchievementProgress[]> {
  const key = pendingKey(userId);
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return [];
  await SecureStore.deleteItemAsync(key);
  try {
    return JSON.parse(raw) as AchievementProgress[];
  } catch {
    return [];
  }
}

export function subscribeToAchievementUnlocks(userId: string, listener: () => void): () => void {
  const userListeners = listeners.get(userId) ?? new Set<() => void>();
  userListeners.add(listener);
  listeners.set(userId, userListeners);
  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

