import type { Agent } from "@/stores/session-store";
import { normalizeWorkspacePath } from "@/utils/workspace-identity";

export interface SidebarCodexSession {
  id: string;
  title: string | null;
  status: Agent["status"];
  lastActivityAt: Date;
  createdAt: Date;
}

export function buildSidebarCodexSessionsForWorkspace(input: {
  agents: Iterable<Agent> | null | undefined;
  workspaceDirectory: string | null | undefined;
}): SidebarCodexSession[] {
  const normalizedWorkspaceDirectory = normalizeWorkspacePath(input.workspaceDirectory);
  if (!normalizedWorkspaceDirectory) {
    return [];
  }

  const sessions: SidebarCodexSession[] = [];
  for (const agent of input.agents ?? []) {
    if (agent.provider !== "codex") {
      continue;
    }
    if (agent.archivedAt) {
      continue;
    }
    if (normalizeWorkspacePath(agent.cwd) !== normalizedWorkspaceDirectory) {
      continue;
    }
    sessions.push({
      id: agent.id,
      title: agent.title,
      status: agent.status,
      lastActivityAt: agent.lastActivityAt,
      createdAt: agent.createdAt,
    });
  }

  sessions.sort((left, right) => {
    const activityDelta = right.lastActivityAt.getTime() - left.lastActivityAt.getTime();
    if (activityDelta !== 0) {
      return activityDelta;
    }
    return right.createdAt.getTime() - left.createdAt.getTime();
  });

  return sessions;
}
