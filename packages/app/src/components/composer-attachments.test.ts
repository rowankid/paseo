import { describe, expect, it } from "vitest";
import type { AttachmentMetadata, ComposerAttachment } from "@/attachments/types";
import { resolveComposerAttachmentsForSubmit } from "./composer-attachments";

function attachmentMetadata(input: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: input.id ?? "att-file",
    mimeType: input.mimeType ?? "text/plain",
    storageType: input.storageType ?? "web-indexeddb",
    storageKey: input.storageKey ?? "att-file",
    fileName: input.fileName ?? "notes.txt",
    byteSize: input.byteSize ?? 12,
    createdAt: input.createdAt ?? 1700000000000,
  };
}

describe("resolveComposerAttachmentsForSubmit", () => {
  it("keeps images on the image path and encodes files as structured prompt attachments", async () => {
    const image = attachmentMetadata({
      id: "img-1",
      mimeType: "image/png",
      fileName: "diagram.png",
    });
    const file = attachmentMetadata({
      id: "file-1",
      mimeType: "text/plain",
      fileName: "notes.txt",
    });
    const attachments: ComposerAttachment[] = [
      { kind: "image", metadata: image },
      { kind: "file", metadata: file },
    ];

    await expect(
      resolveComposerAttachmentsForSubmit(attachments, {
        encodeFiles: async (files) =>
          files.map((metadata) => ({
            type: "file_upload" as const,
            mimeType: metadata.mimeType,
            fileName: metadata.fileName,
            data: `encoded:${metadata.id}`,
            byteSize: metadata.byteSize,
          })),
      }),
    ).resolves.toEqual({
      images: [image],
      attachments: [
        {
          type: "file_upload",
          mimeType: "text/plain",
          fileName: "notes.txt",
          data: "encoded:file-1",
          byteSize: 12,
        },
      ],
    });
  });
});
