type PendingWrite = Promise<unknown>;

export class WorkoutAutosaveService {
  private chains = new Map<string, PendingWrite>();

  enqueue<T>(setId: string, write: () => Promise<T>): Promise<T> {
    const previous = this.chains.get(setId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(write);
    this.chains.set(setId, next);
    const clear = () => {
      if (this.chains.get(setId) === next) this.chains.delete(setId);
    };
    void next.then(clear, clear);
    return next;
  }

  async flush(): Promise<void> {
    await Promise.all([...this.chains.values()].map((write) => write.then(() => undefined)));
  }

  get pendingCount(): number {
    return this.chains.size;
  }
}
