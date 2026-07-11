export type RestTimerSnapshot = {
  elapsedSeconds: number;
  remainingSeconds: number;
  ready: boolean;
};

export function getRestTimerSnapshot(startedAtMs: number, durationSeconds: number, nowMs = Date.now()): RestTimerSnapshot {
  const elapsedSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  const remainingSeconds = Math.max(0, durationSeconds - elapsedSeconds);
  return { elapsedSeconds, remainingSeconds, ready: remainingSeconds === 0 };
}
