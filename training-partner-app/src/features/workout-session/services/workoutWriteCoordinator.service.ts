import type {
  SaveWorkoutSetInput,
  SaveWorkoutSetPatch,
  WorkoutSet,
} from '@/domain/workout/workout.types';

type PendingSetPatch = {
  patch: SaveWorkoutSetPatch;
  revision: number;
  setId: string;
};

export type WorkoutWriteDiagnostics = {
  frozen: boolean;
  inFlight: boolean;
  pendingPatchCount: number;
  pendingWriteKeyCount: number;
  queuedRevisionCount: number;
};

type BatchWriter = (patches: SaveWorkoutSetInput[]) => Promise<WorkoutSet[]>;

/**
 * Coalesces workout edits into the newest patch per set.
 *
 * There is at most one active batch and one merged pending patch for each set.
 * Failed snapshots are restored so callers can retry without losing local input.
 */
export class WorkoutWriteCoordinator {
  private activeBatch: Promise<WorkoutSet[]> | null = null;
  private frozen = false;
  private pending = new Map<string, PendingSetPatch>();
  private revisionBySet = new Map<string, number>();

  constructor(private readonly writeBatch: BatchWriter) {}

  schedulePatch(setId: string, patch: SaveWorkoutSetPatch): number {
    if (this.frozen) {
      throw new Error('Workout writes are frozen.');
    }
    const revision = (this.revisionBySet.get(setId) ?? 0) + 1;
    this.revisionBySet.set(setId, revision);
    const current = this.pending.get(setId);
    this.pending.set(setId, {
      patch: { ...current?.patch, ...patch },
      revision,
      setId,
    });
    return revision;
  }

  discardSet(setId: string): void {
    this.pending.delete(setId);
    this.revisionBySet.delete(setId);
  }

  freeze(): void {
    this.frozen = true;
  }

  resume(): void {
    this.frozen = false;
  }

  async waitForInFlight(): Promise<void> {
    if (this.activeBatch) {
      await this.activeBatch;
    }
  }

  takePendingPatches(): SaveWorkoutSetInput[] {
    const patches = [...this.pending.values()].map(({ patch, setId }) => ({ id: setId, ...patch }));
    this.pending.clear();
    return patches;
  }

  restorePatches(patches: SaveWorkoutSetInput[]): void {
    for (const { id, ...patch } of patches) {
      const current = this.pending.get(id);
      const revision = Math.max(current?.revision ?? 0, this.revisionBySet.get(id) ?? 0);
      this.pending.set(id, {
        patch: { ...patch, ...current?.patch },
        revision,
        setId: id,
      });
    }
  }

  async flushSet(setId: string): Promise<WorkoutSet | null> {
    let saved: WorkoutSet[] = [];
    do {
      saved = [...saved, ...(await this.drainOnce())];
    } while (this.pending.has(setId));
    return saved.findLast((set) => set.id === setId) ?? null;
  }

  async flushSession(): Promise<WorkoutSet[]> {
    const saved: WorkoutSet[] = [];
    while (this.activeBatch || this.pending.size > 0) {
      saved.push(...(await this.drainOnce()));
    }
    return saved;
  }

  getDiagnostics(): WorkoutWriteDiagnostics {
    return {
      frozen: this.frozen,
      inFlight: this.activeBatch !== null,
      pendingPatchCount: this.pending.size,
      pendingWriteKeyCount: this.pending.size + (this.activeBatch ? 1 : 0),
      queuedRevisionCount: [...this.pending.values()].reduce(
        (sum, item) => sum + item.revision,
        0,
      ),
    };
  }

  private async drainOnce(): Promise<WorkoutSet[]> {
    if (this.activeBatch) {
      return this.activeBatch;
    }
    if (this.pending.size === 0) {
      return [];
    }

    const snapshot = [...this.pending.values()];
    this.pending.clear();
    const patches = snapshot.map(({ patch, setId }) => ({ id: setId, ...patch }));
    const write = this.writeBatch(patches).catch((error: unknown) => {
      this.restorePatches(patches);
      throw error;
    });
    this.activeBatch = write;
    try {
      return await write;
    } finally {
      if (this.activeBatch === write) {
        this.activeBatch = null;
      }
    }
  }
}
