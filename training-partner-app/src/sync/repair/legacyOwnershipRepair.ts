// Historical ownership repair is intentionally isolated from normal pull application.
// Business entity ownership may only be recovered from the authenticated account's
// authoritative cloud record; this module must never bulk-reassign plan/workout data.
export const LEGACY_OWNERSHIP_REPAIR_POLICY = 'cloud-record-only' as const;
