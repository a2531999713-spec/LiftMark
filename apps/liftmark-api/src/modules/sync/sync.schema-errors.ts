export function isUndefinedTableError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === '42P01');
}
