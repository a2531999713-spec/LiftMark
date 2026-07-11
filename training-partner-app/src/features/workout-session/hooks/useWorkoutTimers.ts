import { useEffect, useState } from 'react';

import { getRestTimerSnapshot } from '../services/workoutRestTimer.service';

export function useWorkoutTimer(startedAtMs: number | null, durationSeconds: number) {
  const [snapshot, setSnapshot] = useState(() =>
    startedAtMs ? getRestTimerSnapshot(startedAtMs, durationSeconds) : null,
  );

  useEffect(() => {
    if (!startedAtMs) {
      return;
    }
    const update = () => setSnapshot(getRestTimerSnapshot(startedAtMs, durationSeconds));
    const immediateTimer = setTimeout(update, 0);
    const timer = setInterval(update, 1000);
    return () => {
      clearTimeout(immediateTimer);
      clearInterval(timer);
    };
  }, [durationSeconds, startedAtMs]);

  return startedAtMs ? snapshot : null;
}
