export type ActivationState = {
  id: string;
  isActivated: boolean;
  activationCode?: string;
  activatedAt?: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  deviceId: string;
  appVersion: string;
  createdAt: string;
  updatedAt: string;
};

export type ActivationResult =
  | {
      ok: true;
      state: ActivationState;
      message: string;
    }
  | {
      ok: false;
      state: ActivationState;
      message: string;
    };

export interface ActivationRepository {
  getState(appVersion: string): Promise<ActivationState>;
  saveState(state: ActivationState): Promise<ActivationState>;
}

export interface RemoteActivationProvider {
  verifyCode(code: string, deviceId: string): Promise<boolean>;
}
