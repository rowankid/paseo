import type { AttachmentMetadata, ComposerAttachment } from "@/attachments/types";
import {
  isWorkspaceAttachment,
  workspaceAttachmentToSubmitAttachment,
} from "@/attachments/workspace-attachment-utils";
import type { AgentAttachment } from "@server/shared/messages";
import { buildGitHubAttachmentFromSearchItem } from "@/utils/review-attachments";

export type ImageAttachment = AttachmentMetadata;

export function splitComposerAttachmentsForSubmit(attachments: ComposerAttachment[]): {
  images: ImageAttachment[];
  attachments: AgentAttachment[];
  files: AttachmentMetadata[];
} {
  const images: ImageAttachment[] = [];
  const reviewAttachments: AgentAttachment[] = [];
  const files: AttachmentMetadata[] = [];

  for (const attachment of attachments) {
    if (attachment.kind === "image") {
      images.push(attachment.metadata);
      continue;
    }

    if (attachment.kind === "file") {
      files.push(attachment.metadata);
      continue;
    }

    if (isWorkspaceAttachment(attachment)) {
      const workspaceAttachment = workspaceAttachmentToSubmitAttachment(attachment);
      if (workspaceAttachment) {
        reviewAttachments.push(workspaceAttachment);
      }
      continue;
    }

    const reviewAttachment = buildGitHubAttachmentFromSearchItem(attachment.item);
    if (reviewAttachment) {
      reviewAttachments.push(reviewAttachment);
    }
  }

  return {
    images,
    attachments: reviewAttachments,
    files,
  };
}

export async function resolveComposerAttachmentsForSubmit(
  attachments: ComposerAttachment[],
  input: {
    encodeFiles: (files: AttachmentMetadata[]) => Promise<AgentAttachment[]>;
  },
): Promise<{
  images: ImageAttachment[];
  attachments: AgentAttachment[];
}> {
  const split = splitComposerAttachmentsForSubmit(attachments);
  const fileAttachments = await input.encodeFiles(split.files);
  return {
    images: split.images,
    attachments: [...split.attachments, ...fileAttachments],
  };
}
