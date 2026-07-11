import { describe, expect, it } from '@jest/globals';

import { getSyncEntityDefinition, syncEntityRegistry } from '@/sync/registry/syncEntityRegistry';
import { serializeLocalRow } from '@/sync/serialization/serializers/localRow.serializer';
import { createInstallationDeviceId } from '@/sync/device/deviceIdentity';

describe('sync registry and serializers', () => {
  it('registers every declared entity with an explicit deletion strategy', () => {
    expect(Object.values(syncEntityRegistry)).toHaveLength(20);
    expect(Object.values(syncEntityRegistry).every((definition) => definition.fields.length > 0)).toBe(true);
  });

  it('serializes complete plan structure fields without unknown columns', () => {
    const payload = serializeLocalRow('planPhases', {
      id: 'phase-a',
      owner_user_id: 'account-a',
      plan_id: 'plan-a',
      name: '力量阶段',
      type: 'strength',
      start_week: 1,
      end_week: 4,
      order_index: 0,
      ignored: 'not-sent',
    });
    expect(payload).toMatchObject({ plan_id: 'plan-a', type: 'strength', start_week: 1, end_week: 4, order_index: 0 });
    expect(payload).not.toHaveProperty('ignored');
  });

  it('uses dedicated endpoints for group identity structure', () => {
    expect(getSyncEntityDefinition('groups').deletionStrategy).toBe('dedicated-endpoint');
    expect(getSyncEntityDefinition('memberProfiles').deletionStrategy).toBe('dedicated-endpoint');
  });

  it('generates non-hardware installation identifiers', () => {
    const first = createInstallationDeviceId();
    const second = createInstallationDeviceId();
    expect(first).toMatch(/^device_[A-Za-z0-9_-]{24}$/);
    expect(second).not.toBe(first);
  });
});
