import { useCallback, useRef } from "react";
import { Alert } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { isElectronRuntime } from "@/desktop/host";
import { isWeb } from "@/constants/platform";
import {
  normalizePickedFileAssets,
  openFilePathsWithDesktopDialog,
  type PickedFileAttachmentInput,
} from "@/hooks/file-attachment-picker";

interface UseFileAttachmentPickerResult {
  pickFiles: () => Promise<PickedFileAttachmentInput[] | null>;
}

export function useFileAttachmentPicker(): UseFileAttachmentPickerResult {
  const isPickingRef = useRef(false);

  const pickFiles = useCallback(async () => {
    if (isPickingRef.current) {
      return null;
    }

    isPickingRef.current = true;

    try {
      if (isWeb && isElectronRuntime()) {
        const selectedPaths = await openFilePathsWithDesktopDialog();
        if (selectedPaths.length === 0) {
          return null;
        }
        return selectedPaths.map((path) => ({
          source: { kind: "file_uri" as const, uri: path },
          mimeType: null,
          fileName: null,
        }));
      }

      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled) {
        return null;
      }

      return await normalizePickedFileAssets(result.assets);
    } catch (error) {
      console.error("[FileAttachmentPicker] Failed to pick file:", error);
      Alert.alert("Error", "Failed to select file");
      return null;
    } finally {
      isPickingRef.current = false;
    }
  }, []);

  return { pickFiles };
}
