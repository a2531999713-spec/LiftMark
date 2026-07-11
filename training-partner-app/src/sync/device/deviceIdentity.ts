import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'liftmark.installation.device-id.v1';
let memoryDeviceId: string | null = null;

export function createInstallationDeviceId(): string {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz-';
  let value = '';
  for (let index = 0; index < 24; index += 1) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `device_${value}`;
}

export async function getInstallationDeviceId(): Promise<string> {
  if (memoryDeviceId) return memoryDeviceId;
  const stored = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (stored) {
    memoryDeviceId = stored;
    return stored;
  }
  const created = createInstallationDeviceId();
  await SecureStore.setItemAsync(DEVICE_ID_KEY, created);
  memoryDeviceId = created;
  return created;
}

export function resetDeviceIdentityMemoryForTests(): void {
  memoryDeviceId = null;
}
