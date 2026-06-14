export type Result<T, E = Error> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err(error: Error): Result<never> {
  return { ok: false, error };
}
