import type { SyncEntityType } from '../../syncTypes';
import { getSyncEntityDefinition } from '../../registry/syncEntityRegistry';

export function serializeLocalRow(
  entityType: SyncEntityType,
  row: Record<string, unknown>,
): Record<string, unknown> {
  const definition = getSyncEntityDefinition(entityType);
  return Object.fromEntries(
    definition.fields.filter((field) => field in row).map((field) => [field, row[field]]),
  );
}
