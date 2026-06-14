import type { RemoteActivationProvider } from '@/domain/activation/activation.types';

export class ReservedRemoteActivationProvider implements RemoteActivationProvider {
  async verifyCode(): Promise<boolean> {
    return false;
  }
}
