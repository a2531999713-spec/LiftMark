import { Platform } from 'react-native';

export function getPlatformName(): typeof Platform.OS {
  return Platform.OS;
}
