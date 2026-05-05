import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { materializeFileUploadAttachments } from "./file-upload-attachments.js";
import type { AgentAttachment } from "../../shared/messages.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "paseo-file-upload-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("materializeFileUploadAttachments", () => {
  it("writes large binary uploads into the conversation cwd and returns a path prompt attachment", async () => {
    const cwd = await createTempDir();
    const bytes = Buffer.alloc(300_000);
    bytes[0] = 0;
    bytes[1] = 255;
    bytes[299_999] = 127;
    const attachments: AgentAttachment[] = [
      {
        type: "file_upload",
        mimeType: "application/octet-stream",
        fileName: "large.bin",
        data: bytes.toString("base64"),
        byteSize: bytes.byteLength,
      },
    ];

    const materialized = await materializeFileUploadAttachments({ cwd, attachments });

    await expect(readFile(join(cwd, "large.bin"))).resolves.toEqual(bytes);
    expect(materialized).toEqual([
      {
        type: "text",
        mimeType: "text/plain",
        title: "File · large.bin",
        text: [
          "Uploaded file: large.bin",
          "MIME type: application/octet-stream",
          "Size: 300000 bytes",
          "",
          "The file has been saved in the conversation working directory. Refer to it by path: large.bin",
        ].join("\n"),
      },
    ]);
  });

  it("uses a collision-safe basename inside cwd", async () => {
    const cwd = await createTempDir();
    await writeFile(join(cwd, "notes.txt"), "existing", "utf8");

    const materialized = await materializeFileUploadAttachments({
      cwd,
      attachments: [
        {
          type: "file_upload",
          mimeType: "text/plain",
          fileName: "../notes.txt",
          data: Buffer.from("new").toString("base64"),
          byteSize: 3,
        },
      ],
    });

    await expect(readFile(join(cwd, "notes.txt"), "utf8")).resolves.toBe("existing");
    await expect(readFile(join(cwd, "notes-1.txt"), "utf8")).resolves.toBe("new");
    expect(materialized[0]?.type).toBe("text");
    expect(materialized[0]?.text).toContain("Uploaded file: notes-1.txt");
  });
});
