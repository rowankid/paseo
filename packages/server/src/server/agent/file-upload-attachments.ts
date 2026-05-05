import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import type { AgentAttachment } from "../../shared/messages.js";

type FileUploadAttachment = Extract<AgentAttachment, { type: "file_upload" }>;

interface MaterializeFileUploadAttachmentsInput {
  cwd: string;
  attachments: readonly AgentAttachment[] | undefined;
}

function sanitizeUploadFileName(input: string | null | undefined, index: number): string {
  const basename = path.basename(input?.trim() || `attachment-${index + 1}`);
  const cleaned = Array.from(basename, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code <= 31 || code === 127 ? "_" : char;
  })
    .join("")
    .trim();
  if (!cleaned || cleaned === "." || cleaned === "..") {
    return `attachment-${index + 1}`;
  }
  return cleaned;
}

function splitExtension(fileName: string): { stem: string; extension: string } {
  const extension = path.extname(fileName);
  const stem = extension ? fileName.slice(0, -extension.length) : fileName;
  return { stem: stem || "attachment", extension };
}

function assertPathInsideCwd(cwd: string, targetPath: string): void {
  const relative = path.relative(cwd, targetPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Upload target escapes cwd: ${targetPath}`);
  }
}

async function writeFileWithoutOverwrite(input: {
  cwd: string;
  fileName: string;
  bytes: Buffer;
}): Promise<{ relativePath: string; absolutePath: string }> {
  const { stem, extension } = splitExtension(input.fileName);
  for (let attempt = 0; attempt < 10_000; attempt += 1) {
    const candidate = attempt === 0 ? input.fileName : `${stem}-${attempt}${extension}`;
    const absolutePath = path.resolve(input.cwd, candidate);
    assertPathInsideCwd(input.cwd, absolutePath);

    try {
      const handle = await open(absolutePath, "wx");
      try {
        await handle.writeFile(input.bytes);
      } finally {
        await handle.close();
      }
      return { relativePath: candidate, absolutePath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Unable to allocate upload file name for ${input.fileName}`);
}

function renderUploadedFileAttachment(input: {
  attachment: FileUploadAttachment;
  relativePath: string;
  byteSize: number;
}): AgentAttachment {
  return {
    type: "text",
    mimeType: "text/plain",
    title: `File · ${input.relativePath}`,
    text: [
      `Uploaded file: ${input.relativePath}`,
      `MIME type: ${input.attachment.mimeType}`,
      `Size: ${input.byteSize} bytes`,
      "",
      "The file has been saved in the conversation working directory. Refer to it by path: " +
        input.relativePath,
    ].join("\n"),
  };
}

async function materializeOneFileUpload(input: {
  cwd: string;
  attachment: FileUploadAttachment;
  index: number;
}): Promise<AgentAttachment> {
  const bytes = Buffer.from(input.attachment.data, "base64");
  const fileName = sanitizeUploadFileName(input.attachment.fileName, input.index);
  const written = await writeFileWithoutOverwrite({ cwd: input.cwd, fileName, bytes });
  return renderUploadedFileAttachment({
    attachment: input.attachment,
    relativePath: written.relativePath,
    byteSize: bytes.byteLength,
  });
}

export async function materializeFileUploadAttachments({
  cwd,
  attachments,
}: MaterializeFileUploadAttachmentsInput): Promise<AgentAttachment[]> {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  await mkdir(cwd, { recursive: true });
  const resolvedCwd = path.resolve(cwd);
  return await Promise.all(
    attachments.map(async (attachment, index) => {
      if (attachment.type !== "file_upload") {
        return attachment;
      }
      return await materializeOneFileUpload({
        cwd: resolvedCwd,
        attachment,
        index,
      });
    }),
  );
}
