import { useCallback, useEffect, useMemo } from "react";
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PressableStateCallbackType,
} from "react-native";
import { router, type Href } from "expo-router";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Archive, ArrowLeft, ChevronRight } from "lucide-react-native";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { getProviderIcon } from "@/components/provider-icons";
import { SettingsSection } from "@/screens/settings/settings-section";
import type { AggregatedAgent } from "@/hooks/use-aggregated-agents";
import { useAgentHistory } from "@/hooks/use-agent-history";
import { useUnarchiveAgent } from "@/hooks/use-unarchive-agent";
import { useSessionStore, type Agent } from "@/stores/session-store";
import { useToast } from "@/contexts/toast-context";
import { settingsStyles } from "@/styles/settings";
import { formatTimeAgo } from "@/utils/time";
import { shortenPath } from "@/utils/shorten-path";
import { buildHostAgentDetailRoute, buildSettingsHostRoute } from "@/utils/host-routes";
import { resolveWorkspaceIdByExecutionDirectory } from "@/utils/workspace-execution";
import { prepareWorkspaceTab } from "@/utils/workspace-navigation";

interface ArchivedHostSessionsScreenProps {
  serverId: string;
}

function buildHistoricalAgentDetail(agent: AggregatedAgent): Agent {
  return {
    serverId: agent.serverId,
    id: agent.id,
    provider: agent.provider,
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.lastActivityAt,
    lastUserMessageAt: null,
    lastActivityAt: agent.lastActivityAt,
    capabilities: {
      supportsStreaming: false,
      supportsSessionPersistence: false,
      supportsDynamicModes: false,
      supportsMcpServers: false,
      supportsReasoningStream: false,
      supportsToolInvocations: false,
    },
    currentModeId: null,
    availableModes: [],
    pendingPermissions: [],
    persistence: null,
    runtimeInfo: {
      provider: agent.provider,
      sessionId: null,
    },
    title: agent.title,
    cwd: agent.cwd,
    model: null,
    thinkingOptionId: null,
    requiresAttention: agent.requiresAttention,
    attentionReason: agent.attentionReason,
    attentionTimestamp: agent.attentionTimestamp,
    archivedAt: agent.archivedAt,
    labels: agent.labels,
  };
}

function rememberArchivedAgentDetail(agent: AggregatedAgent): void {
  if (!agent.archivedAt) {
    return;
  }

  useSessionStore.getState().setAgentDetails(agent.serverId, (previous) => {
    const existing = previous.get(agent.id);
    const next = new Map(previous);
    next.set(agent.id, {
      ...buildHistoricalAgentDetail(agent),
      ...existing,
      archivedAt: existing?.archivedAt ?? agent.archivedAt,
      cwd: existing?.cwd ?? agent.cwd,
    });
    return next;
  });
}

function navigateBackToHost(serverId: string): void {
  router.navigate(buildSettingsHostRoute(serverId));
}

export default function ArchivedHostSessionsScreen({ serverId }: ArchivedHostSessionsScreenProps) {
  const { theme } = useUnistyles();
  const toast = useToast();
  const { unarchiveAgent, isUnarchivingAgent } = useUnarchiveAgent();
  const { agents, hasMore, isInitialLoad, isLoadingMore, loadMore } = useAgentHistory({
    serverId,
    enabled: serverId.trim().length > 0,
  });

  const archivedAgents = useMemo(
    () =>
      agents
        .filter((agent) => agent.archivedAt)
        .sort((left, right) => {
          const leftTime = left.archivedAt?.getTime() ?? 0;
          const rightTime = right.archivedAt?.getTime() ?? 0;
          return rightTime - leftTime;
        }),
    [agents],
  );

  useEffect(() => {
    if (!isInitialLoad && archivedAgents.length === 0 && hasMore && !isLoadingMore) {
      loadMore();
    }
  }, [archivedAgents.length, hasMore, isInitialLoad, isLoadingMore, loadMore]);

  const handleBack = useCallback(() => navigateBackToHost(serverId), [serverId]);
  const handleUnarchive = useCallback(
    (agent: AggregatedAgent) => {
      void unarchiveAgent({ serverId: agent.serverId, agentId: agent.id }).catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to unarchive conversation");
      });
    },
    [toast, unarchiveAgent],
  );

  const footer = hasMore ? (
    <View style={styles.footer}>
      <Button variant="ghost" onPress={loadMore} disabled={isLoadingMore}>
        {isLoadingMore ? "Loading..." : "Load older conversations"}
      </Button>
    </View>
  ) : null;

  return (
    <View style={styles.body} testID={`host-archived-sessions-${serverId}`}>
      <Button
        testID="host-archived-sessions-back-link"
        accessibilityLabel="Back to host"
        onPress={handleBack}
        variant="ghost"
        size="sm"
        leftIcon={ArrowLeft}
        style={styles.backButton}
      >
        Back to host
      </Button>

      {isInitialLoad ? (
        <View style={styles.centered}>
          <LoadingSpinner size="large" color={theme.colors.foregroundMuted} />
        </View>
      ) : null}

      {!isInitialLoad && archivedAgents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Archive size={theme.iconSize.lg} color={theme.colors.foregroundMuted} />
          <Text style={styles.emptyText}>No archived conversations</Text>
        </View>
      ) : null}

      {!isInitialLoad && archivedAgents.length > 0 ? (
        <SettingsSection title="Archived conversations">
          <View style={settingsStyles.card}>
            {archivedAgents.map((agent, index) => (
              <ArchivedSessionRow
                key={`${agent.serverId}:${agent.id}`}
                agent={agent}
                showBorder={index > 0}
                isUnarchiving={isUnarchivingAgent({
                  serverId: agent.serverId,
                  agentId: agent.id,
                })}
                onUnarchive={handleUnarchive}
              />
            ))}
          </View>
        </SettingsSection>
      ) : null}

      {footer}
    </View>
  );
}

function ArchivedSessionRow({
  agent,
  showBorder,
  isUnarchiving,
  onUnarchive,
}: {
  agent: AggregatedAgent;
  showBorder: boolean;
  isUnarchiving: boolean;
  onUnarchive: (agent: AggregatedAgent) => void;
}) {
  const { theme } = useUnistyles();
  const ProviderIcon = getProviderIcon(agent.provider);
  const archivedTime = agent.archivedAt
    ? formatTimeAgo(agent.archivedAt)
    : formatTimeAgo(agent.lastActivityAt);
  const path = shortenPath(agent.cwd);

  const handlePress = useCallback(() => {
    const serverId = agent.serverId;
    const agentId = agent.id;
    const workspaceId = resolveWorkspaceIdByExecutionDirectory({
      workspaces: useSessionStore.getState().sessions[serverId]?.workspaces?.values(),
      workspaceDirectory: agent.cwd,
    });

    rememberArchivedAgentDetail(agent);

    if (!workspaceId) {
      router.navigate(buildHostAgentDetailRoute(serverId, agentId) as Href);
      return;
    }

    router.navigate(
      prepareWorkspaceTab({
        serverId,
        workspaceId,
        target: { kind: "agent", agentId },
        pin: true,
      }),
    );
  }, [agent]);

  const rowStyle = useCallback(
    ({ pressed, hovered = false }: PressableStateCallbackType & { hovered?: boolean }) => [
      settingsStyles.row,
      showBorder && settingsStyles.rowBorder,
      styles.sessionRow,
      hovered && styles.sessionRowHovered,
      pressed && styles.sessionRowPressed,
    ],
    [showBorder],
  );

  const handleUnarchivePressIn = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation?.();
  }, []);

  const handleUnarchivePress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation?.();
      if (isUnarchiving) {
        return;
      }
      onUnarchive(agent);
    },
    [agent, isUnarchiving, onUnarchive],
  );

  return (
    <Pressable
      style={rowStyle}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Open ${agent.title || "archived conversation"}`}
      testID={`host-archived-session-row-${agent.serverId}-${agent.id}`}
    >
      <View style={styles.sessionMain}>
        <View style={styles.providerIcon}>
          <ProviderIcon size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
        </View>
        <View style={styles.sessionText}>
          <Text style={settingsStyles.rowTitle} numberOfLines={1}>
            {agent.title || "New session"}
          </Text>
          <Text style={settingsStyles.rowHint} numberOfLines={1}>
            {path} · Archived {archivedTime}
          </Text>
        </View>
      </View>
      <Button
        variant="outline"
        size="sm"
        onPressIn={handleUnarchivePressIn}
        onPress={handleUnarchivePress}
        disabled={isUnarchiving}
        testID={`host-archived-session-unarchive-${agent.serverId}-${agent.id}`}
      >
        {isUnarchiving ? "Restoring..." : "Unarchive"}
      </Button>
      <ChevronRight size={theme.iconSize.sm} color={theme.colors.foregroundMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  body: {
    gap: theme.spacing[4],
  },
  backButton: {
    alignSelf: "flex-start",
  },
  centered: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    minHeight: 180,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    padding: theme.spacing[6],
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface1,
  },
  emptyText: {
    color: theme.colors.foregroundMuted,
    fontSize: theme.fontSize.sm,
  },
  sessionRow: {
    gap: theme.spacing[3],
  },
  sessionRowHovered: {
    backgroundColor: theme.colors.surface2,
  },
  sessionRowPressed: {
    backgroundColor: theme.colors.surface3,
  },
  sessionMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[3],
  },
  providerIcon: {
    width: theme.iconSize.md,
    alignItems: "center",
    justifyContent: "center",
  },
  sessionText: {
    flex: 1,
    minWidth: 0,
  },
  footer: {
    alignItems: "center",
    paddingVertical: theme.spacing[2],
  },
}));
