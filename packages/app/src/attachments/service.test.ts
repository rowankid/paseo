import { afterEach, describe, expect, it } from "vitest";
import type { AttachmentMetadata, AttachmentStore, SaveAttachmentInput } from "@/attachments/types";
import { __setAttachmentStoreForTests } from "./store";
import {
  encodeAttachmentsForSend,
  encodeFileAttachmentsForUpload,
  persistAttachmentFromBytes,
} from "./service";

function createAttachment(input: Partial<AttachmentMetadata> = {}): AttachmentMetadata {
  return {
    id: input.id ?? "att_1",
    mimeType: input.mimeType ?? "image/png",
    storageType: input.storageType ?? "web-indexeddb",
    storageKey: input.storageKey ?? "att_1",
    fileName: input.fileName,
    byteSize: input.byteSize,
    createdAt: input.createdAt ?? 1700000000000,
  };
}

function createRecordingStore(): AttachmentStore & {
  savedSources: SaveAttachmentInput[];
  releasedUrls: string[];
  encodedBase64ById: Map<string, string>;
} {
  const savedSources: SaveAttachmentInput[] = [];
  const releasedUrls: string[] = [];
  const encodedBase64ById = new Map<string, string>();

  return {
    storageType: "web-indexeddb",
    savedSources,
    releasedUrls,
    encodedBase64ById,
    async save(input) {
      savedSources.push(input);
      return createAttachment({
        id: input.id,
        mimeType: input.mimeType,
        fileName: input.fileName,
        byteSize: 4,
      });
    },
    async encodeBase64({ attachment }) {
      return encodedBase64ById.get(attachment.id) ?? `${attachment.id}:base64`;
    },
    async resolvePreviewUrl({ attachment }) {
      return `blob:${attachment.id}`;
    },
    async releasePreviewUrl({ url }) {
      releasedUrls.push(url);
    },
    async delete() {},
    async garbageCollect() {},
  };
}

describe("attachment service", () => {
  afterEach(() => {
    __setAttachmentStoreForTests(null);
  });

  it("persists raw bytes without requiring a base64 wrapper", async () => {
    const store = createRecordingStore();
    __setAttachmentStoreForTests(store);
    const bytes = new Uint8Array([0, 1, 2, 3]);

    const attachment = await persistAttachmentFromBytes({
      id: "att_bytes",
      bytes,
      mimeType: "image/png",
      fileName: "image.png",
    });

    expect(attachment).toEqual({
      id: "att_bytes",
      mimeType: "image/png",
      storageType: "web-indexeddb",
      storageKey: "att_1",
      fileName: "image.png",
      byteSize: 4,
      createdAt: 1700000000000,
    });
    expect(store.savedSources).toEqual([
      {
        id: "att_bytes",
        mimeType: "image/png",
        fileName: "image.png",
        source: { kind: "bytes", bytes },
      },
    ]);
  });

  it("keeps provider send output byte-compatible", async () => {
    const store = createRecordingStore();
    __setAttachmentStoreForTests(store);
    const attachment = createAttachment({ id: "att_send", mimeType: "image/jpeg" });

    await expect(encodeAttachmentsForSend([attachment])).resolves.toEqual([
      { data: "att_send:base64", mimeType: "image/jpeg" },
    ]);
  });

  it("encodes text files as upload attachments without inlining prompt text", async () => {
    const store = createRecordingStore();
    store.encodedBase64ById.set("att_file", Buffer.from("hello from file\n").toString("base64"));
    __setAttachmentStoreForTests(store);
    const attachment = createAttachment({
      id: "att_file",
      mimeType: "text/plain",
      fileName: "notes.txt",
      byteSize: 16,
    });

    await expect(encodeFileAttachmentsForUpload([attachment])).resolves.toEqual([
      {
        type: "file_upload",
        mimeType: "text/plain",
        fileName: "notes.txt",
        data: Buffer.from("hello from file\n").toString("base64"),
        byteSize: 16,
      },
    ]);
  });

  it("encodes large binary files as upload attachments", async () => {
    const store = createRecordingStore();
    const bytes = Buffer.alloc(300_000);
    bytes[0] = 0;
    bytes[1] = 255;
    bytes[299_999] = 127;
    store.encodedBase64ById.set("att_binary", bytes.toString("base64"));
    __setAttachmentStoreForTests(store);
    const attachment = createAttachment({
      id: "att_binary",
      mimeType: "application/octet-stream",
      fileName: "archive.bin",
      byteSize: bytes.byteLength,
    });

    await expect(encodeFileAttachmentsForUpload([attachment])).resolves.toEqual([
      {
        type: "file_upload",
        mimeType: "application/octet-stream",
        fileName: "archive.bin",
        data: bytes.toString("base64"),
        byteSize: bytes.byteLength,
      },
    ]);
  });
});
