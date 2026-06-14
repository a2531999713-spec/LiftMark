import type { ActivationRepository, ActivationResult, ActivationState } from './activation.types';

export const TEST_ACTIVATION_CODES = ['LIFTMARK-TEST-2026'];
export const TRIAL_DAYS = 14;

export function getTrialDaysLeft(state: ActivationState, now = new Date()): number {
  const expiresAt = new Date(state.trialExpiresAt).getTime();
  const diff = expiresAt - now.getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

export class ActivationService {
  constructor(
    private readonly repository: ActivationRepository,
    private readonly appVersion: string,
  ) {}

  getState(): Promise<ActivationState> {
    return this.repository.getState(this.appVersion);
  }

  async activate(code: string): Promise<ActivationResult> {
    const state = await this.repository.getState(this.appVersion);
    const normalized = code.trim().toUpperCase();

    if (!TEST_ACTIVATION_CODES.includes(normalized)) {
      return {
        ok: false,
        state,
        message: '激活码无效，请检查后再试。',
      };
    }

    const now = new Date().toISOString();
    const nextState = await this.repository.saveState({
      ...state,
      isActivated: true,
      activationCode: normalized,
      activatedAt: now,
      appVersion: this.appVersion,
      updatedAt: now,
    });

    return {
      ok: true,
      state: nextState,
      message: '已激活完整测试功能。',
    };
  }
}
