import Constants from 'expo-constants';

import { ActivationService } from '@/domain/activation/activation.service';
import { getDatabase } from '@/data/local';
import { LocalActivationRepository } from '@/data/local/activation/LocalActivationRepository';

export function createActivationService() {
  return new ActivationService(
    new LocalActivationRepository(getDatabase),
    Constants.expoConfig?.version ?? '0.1.0',
  );
}
