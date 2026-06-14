import * as DocumentPicker from 'expo-document-picker';
import { readAsStringAsync } from 'expo-file-system/legacy';

import {
  createImportedPlanDraft,
  parsePlanFile,
  type LiftMarkPlanFile,
} from './planFileService';

export type PickedPlanDocument = {
  draft: LiftMarkPlanFile;
  fileName: string;
};

export async function pickImportedPlanDocument(): Promise<PickedPlanDocument | null> {
  const result = await DocumentPicker.getDocumentAsync({
    base64: false,
    copyToCacheDirectory: true,
    multiple: false,
    type: ['application/json', 'text/json', 'text/plain', '*/*'],
  });

  if (result.canceled) {
    return null;
  }

  const asset = result.assets[0];
  if (!asset) {
    return null;
  }

  const json = await readAsStringAsync(asset.uri);

  return {
    draft: createImportedPlanDraft(parsePlanFile(json)),
    fileName: asset.name,
  };
}
