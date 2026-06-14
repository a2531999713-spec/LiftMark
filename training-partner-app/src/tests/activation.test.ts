import { describe, expect, it } from '@jest/globals';

import { ActivationService, getTrialDaysLeft, TEST_ACTIVATION_CODES } from '@/domain/activation/activation.service';
import type { ActivationRepository, ActivationState } from '@/domain/activation/activation.types';

class MemoryActivationRepository implements ActivationRepository {
  state: ActivationState = {
    id: 'activation_local',
    isActivated: false,
    trialStartedAt: '2026-06-01T00:00:00.000Z',
    trialExpiresAt: '2026-06-15T00:00:00.000Z',
    deviceId: 'device_test',
    appVersion: '0.1.0',
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
  };

  async getState(): Promise<ActivationState> {
    return this.state;
  }

  async saveState(state: ActivationState): Promise<ActivationState> {
    this.state = state;
    return state;
  }
}

describe('activation service', () => {
  it('calculates trial days left without negative values', () => {
    const repository = new MemoryActivationRepository();

    expect(getTrialDaysLeft(repository.state, new Date('2026-06-10T00:00:00.000Z'))).toBe(5);
    expect(getTrialDaysLeft(repository.state, new Date('2026-06-20T00:00:00.000Z'))).toBe(0);
  });

  it('rejects invalid activation codes', async () => {
    const service = new ActivationService(new MemoryActivationRepository(), '0.1.0');
    const result = await service.activate('bad-code');

    expect(result.ok).toBe(false);
    expect(result.state.isActivated).toBe(false);
  });

  it('activates with the local test code', async () => {
    const service = new ActivationService(new MemoryActivationRepository(), '0.1.0');
    const result = await service.activate(TEST_ACTIVATION_CODES[0]);

    expect(result.ok).toBe(true);
    expect(result.state.isActivated).toBe(true);
    expect(result.state.activationCode).toBe(TEST_ACTIVATION_CODES[0]);
  });
});
