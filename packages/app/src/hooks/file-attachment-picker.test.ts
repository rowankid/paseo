import { afterEach, describe, expect, it, vi } from "vitest";
import {
  normalizePickedFileAssets,
  openFilePathsWithDesktopDialog,
} from "./file-attachment-picker";

const desktopHostState = vi.hoisted(() => ({
  api: null as null | {
    dialog?: { open?: (options?: unknown) => Promise<string | string[] | null> };
  },
}));

vi.mock("@/desktop/host", () => ({
  getDesktopHost: () => desktopHostState.api,
}));

describe("normalizePickedFileAssets", () => {
  it("uses browser File blobs when available", async () => {
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });

    await expect(
      normalizePickedFileAssets([
        {
          uri: "blob://notes",
          name: "notes.txt",
          mimeType: "text/plain",
          file,
        },
      ]),
    ).resolves.toEqual([
      {
        source: { kind: "blob", blob: file },
        mimeType: "text/plain",
        fileName: "notes.txt",
      },
    ]);
  });

  it("keeps native and desktop file URIs as file sources", async () => {
    await expect(
      normalizePickedFileAssets([
        {
          uri: "/Users/me/report.md",
          name: "report.md",
          mimeType: "text/markdown",
        },
      ]),
    ).resolves.toEqual([
      {
        source: { kind: "file_uri", uri: "/Users/me/report.md" },
        mimeType: "text/markdown",
        fileName: "report.md",
      },
    ]);
  });
});

describe("openFilePathsWithDesktopDialog", () => {
  afterEach(() => {
    desktopHostState.api = null;
  });

  it("opens a multi-select file dialog without extension filters", async () => {
    const open = vi.fn(async () => ["/tmp/a.txt", "/tmp/b.json"]);
    desktopHostState.api = { dialog: { open } };

    await expect(openFilePathsWithDesktopDialog()).resolves.toEqual(["/tmp/a.txt", "/tmp/b.json"]);
    expect(open).toHaveBeenCalledWith({
      directory: false,
      multiple: true,
      title: "Attach files",
    });
  });
});
