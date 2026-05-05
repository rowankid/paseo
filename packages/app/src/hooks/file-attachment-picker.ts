import { getDesktopHost } from "@/desktop/host";
import { isAbsolutePath } from "@/utils/path";

export type PickedFileSource = { kind: "file_uri"; uri: string } | { kind: "blob"; blob: Blob };

export interface PickedFileAttachmentInput {
  source: PickedFileSource;
  mimeType?: string | null;
  fileName?: string | null;
}

export interface DocumentPickerAssetLike {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  file?: File | null;
}

function shouldTreatAsFileUri(uri: string): boolean {
  return uri.startsWith("file://") || isAbsolutePath(uri);
}

async function blobFromUri(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read picked file from '${uri}'.`);
  }
  return await response.blob();
}

export async function normalizePickedFileAssets(
  assets: readonly DocumentPickerAssetLike[],
): Promise<PickedFileAttachmentInput[]> {
  return await Promise.all(
    assets.map(async (asset) => {
      if (asset.file instanceof Blob) {
        return {
          source: { kind: "blob", blob: asset.file },
          mimeType: asset.mimeType ?? asset.file.type ?? null,
          fileName: asset.name ?? asset.file.name ?? null,
        };
      }

      if (shouldTreatAsFileUri(asset.uri)) {
        return {
          source: { kind: "file_uri", uri: asset.uri },
          mimeType: asset.mimeType ?? null,
          fileName: asset.name ?? null,
        };
      }

      const blob = await blobFromUri(asset.uri);
      return {
        source: { kind: "blob", blob },
        mimeType: asset.mimeType ?? blob.type ?? null,
        fileName: asset.name ?? null,
      };
    }),
  );
}

function normalizeDesktopDialogSelection(selection: string | string[] | null): string[] {
  if (!selection) {
    return [];
  }
  return Array.isArray(selection) ? selection : [selection];
}

export async function openFilePathsWithDesktopDialog(): Promise<string[]> {
  const desktop = getDesktopHost();
  const dialogOpen = desktop?.dialog?.open;
  if (typeof dialogOpen !== "function") {
    throw new Error("Desktop dialog API is not available.");
  }

  return normalizeDesktopDialogSelection(
    await dialogOpen({
      directory: false,
      multiple: true,
      title: "Attach files",
    }),
  );
}
