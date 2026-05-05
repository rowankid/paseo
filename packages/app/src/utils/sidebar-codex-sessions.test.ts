import { describe, expect, it } from "vitest";
import type { Agent } from "@/stores/session-store";
import { buildSidebarCodexSessionsForWorkspace } from "@/utils/sidebar-codex-sessions";

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    serverId: "srv",
    id: "agent-1",
    provider: "codex",
    status: "closed",
    createdAt: new Date("2026-04-01T03:00:00.000Z"),
    updatedAt: new Date("2026-04-01T03:00:00.000Z"),
    lastUserMessageAt: null,
    lastActivityAt: new Date("2026-04-01T03:00:00.000Z"),
    capabilities: {
      supportsStreaming: true,
      supportsSessionPersistence: true,
      supportsDynamicModes: true,
      supportsMcpServers: true,
      supportsReasoningStream: true,
      supportsToolInvocations: true,
    },
    currentModeId: null,
    availableModes: [],
    pendingPermissions: [],
    persistence: null,
    title: "Agent 1",
    cwd: "/repo",
    model: null,
    labels: {},
    archivedAt: null,
    ...overrides,
  };
}

describe("buildSidebarCodexSessionsForWorkspace", () => {
  it("returns unarchived Codex sessions whose cwd exactly matches the workspace", () => {
    const sessions = buildSidebarCodexSessionsForWorkspace({
      workspaceDirectory: "/repo",
      agents: [
        makeAgent({ id: "newer", lastActivityAt: new Date("2026-04-01T05:00:00.000Z") }),
        makeAgent({ id: "older", lastActivityAt: new Date("2026-04-01T04:00:00.000Z") }),
        makeAgent({ id: "trailing-slash", cwd: "/repo/" }),
        makeAgent({ id: "nested", cwd: "/repo/packages/app" }),
        makeAgent({ id: "claude", provider: "claude" }),
        makeAgent({ id: "archived", archivedAt: new Date("2026-04-01T06:00:00.000Z") }),
      ],
    });

    expect(sessions.map((session) => session.id)).toEqual(["newer", "older", "trailing-slash"]);
  });
});
