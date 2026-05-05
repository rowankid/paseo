import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getHostRuntimeStore } from "@/runtime/host-runtime";
import { useSessionStore } from "@/stores/session-store";
import { agentHistoryQueryKey } from "./agent-history-query-key";
import type { ArchiveAgentInput } from "./use-archive-agent";

export const UNARCHIVE_AGENT_PENDING_QUERY_KEY = ["unarchive-agent-pending"] as const;

type UnarchiveAgentPendingState = Record<string, true>;

interface AgentHistoryQueryAgent {
  id?: string | null;
  archivedAt?: Date | null;
}

interface AgentHistoryQueryPage {
  agents?: AgentHistoryQueryAgent[];
}

interface AgentHistoryQueryData {
  pages?: AgentHistoryQueryPage[];
}

interface UnarchiveAgentCacheSnapshot {
  agentHistory: AgentHistoryQueryData | undefined;
  agent: ReturnType<typeof getStoredAgentSnapshot>;
  agentDetail: ReturnType<typeof getStoredAgentDetailSnapshot>;
}

function toUnarchiveKey(input: ArchiveAgentInput): string {
  const serverId = input.serverId.trim();
  const agentId = input.agentId.trim();
  if (!serverId || !agentId) {
    return "";
  }
  return `${serverId}:${agentId}`;
}

function setAgentUnarchiving(input: {
  queryClient: QueryClient;
  serverId: string;
  agentId: string;
  isUnarchiving: boolean;
}): void {
  const key = toUnarchiveKey(input);
  if (!key) {
    return;
  }

  input.queryClient.setQueryData<UnarchiveAgentPendingState>(
    UNARCHIVE_AGENT_PENDING_QUERY_KEY,
    (current) => {
      const state = current ?? {};
      if (input.isUnarchiving) {
        if (state[key]) {
          return state;
        }
        return { ...state, [key]: true };
      }

      if (!state[key]) {
        return state;
      }
      const next = { ...state };
      delete next[key];
      return next;
    },
  );
}

function markAgentUnarchivedInHistoryPayload<T extends AgentHistoryQueryData | undefined>(
  payload: T,
  agentId: string,
): T {
  if (!payload || !Array.isArray(payload.pages) || !agentId) {
    return payload;
  }

  let changed = false;
  const pages = payload.pages.map((page) => {
    if (!Array.isArray(page.agents)) {
      return page;
    }

    let pageChanged = false;
    const agents = page.agents.map((agent) => {
      if (agent.id !== agentId || !agent.archivedAt) {
        return agent;
      }
      changed = true;
      pageChanged = true;
      return {
        ...agent,
        archivedAt: null,
      };
    });

    return pageChanged ? { ...page, agents } : page;
  });

  return changed ? ({ ...payload, pages } as T) : payload;
}

function markAgentUnarchivedInHistoryCache(
  queryClient: QueryClient,
  input: ArchiveAgentInput,
): void {
  queryClient.setQueryData<AgentHistoryQueryData | undefined>(
    agentHistoryQueryKey(input.serverId),
    (current) => markAgentUnarchivedInHistoryPayload(current, input.agentId),
  );
}

function getStoredAgentSnapshot(input: ArchiveAgentInput) {
  return useSessionStore.getState().sessions[input.serverId]?.agents.get(input.agentId);
}

function getStoredAgentDetailSnapshot(input: ArchiveAgentInput) {
  return useSessionStore.getState().sessions[input.serverId]?.agentDetails.get(input.agentId);
}

function markAgentUnarchivedInStore(input: ArchiveAgentInput): void {
  const store = useSessionStore.getState();
  store.setAgents(input.serverId, (prev) => {
    const existing = prev.get(input.agentId);
    if (!existing || !existing.archivedAt) {
      return prev;
    }
    const next = new Map(prev);
    next.set(input.agentId, {
      ...existing,
      archivedAt: null,
    });
    return next;
  });
  store.setAgentDetails(input.serverId, (prev) => {
    const existing = prev.get(input.agentId);
    if (!existing || !existing.archivedAt) {
      return prev;
    }
    const next = new Map(prev);
    next.set(input.agentId, {
      ...existing,
      archivedAt: null,
    });
    return next;
  });
}

function restoreAgentSnapshot(input: ArchiveAgentInput & UnarchiveAgentCacheSnapshot): void {
  const store = useSessionStore.getState();
  store.setAgents(input.serverId, (prev) => {
    const hasAgent = prev.has(input.agentId);
    if (!input.agent) {
      if (!hasAgent) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(input.agentId);
      return next;
    }
    const next = new Map(prev);
    next.set(input.agentId, input.agent);
    return next;
  });
  store.setAgentDetails(input.serverId, (prev) => {
    const hasAgent = prev.has(input.agentId);
    if (!input.agentDetail) {
      if (!hasAgent) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(input.agentId);
      return next;
    }
    const next = new Map(prev);
    next.set(input.agentId, input.agentDetail);
    return next;
  });
}

export function useUnarchiveAgent() {
  const queryClient = useQueryClient();

  const pendingQuery = useQuery({
    queryKey: UNARCHIVE_AGENT_PENDING_QUERY_KEY,
    queryFn: async (): Promise<UnarchiveAgentPendingState> => ({}),
    initialData: {} as UnarchiveAgentPendingState,
    staleTime: Infinity,
    gcTime: Infinity,
  });

  const unarchiveMutation = useMutation({
    mutationFn: async (input: ArchiveAgentInput): Promise<void> => {
      const client = useSessionStore.getState().sessions[input.serverId]?.client ?? null;
      if (!client) {
        throw new Error("Daemon client not available");
      }
      await client.refreshAgent(input.agentId);
    },
    onMutate: (input): UnarchiveAgentCacheSnapshot => {
      const snapshot = {
        agentHistory: queryClient.getQueryData<AgentHistoryQueryData | undefined>(
          agentHistoryQueryKey(input.serverId),
        ),
        agent: getStoredAgentSnapshot(input),
        agentDetail: getStoredAgentDetailSnapshot(input),
      };
      markAgentUnarchivedInStore(input);
      markAgentUnarchivedInHistoryCache(queryClient, input);
      setAgentUnarchiving({
        queryClient,
        serverId: input.serverId,
        agentId: input.agentId,
        isUnarchiving: true,
      });
      return snapshot;
    },
    onSuccess: (_result, input) => {
      markAgentUnarchivedInStore(input);
      void getHostRuntimeStore().refreshAgentDirectory({ serverId: input.serverId });
    },
    onError: (_error, input, context) => {
      if (!context) {
        return;
      }
      restoreAgentSnapshot({
        serverId: input.serverId,
        agentId: input.agentId,
        ...context,
      });
      if (context.agentHistory === undefined) {
        queryClient.removeQueries({ queryKey: agentHistoryQueryKey(input.serverId), exact: true });
      } else {
        queryClient.setQueryData(agentHistoryQueryKey(input.serverId), context.agentHistory);
      }
    },
    onSettled: (_result, _error, input) => {
      setAgentUnarchiving({
        queryClient,
        serverId: input.serverId,
        agentId: input.agentId,
        isUnarchiving: false,
      });
      void queryClient.invalidateQueries({
        queryKey: ["sidebarAgentsList", input.serverId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["allAgents", input.serverId],
      });
      void queryClient.invalidateQueries({
        queryKey: agentHistoryQueryKey(input.serverId),
      });
    },
  });

  const unarchiveMutateAsync = unarchiveMutation.mutateAsync;

  const unarchiveAgent = useCallback(
    async (input: ArchiveAgentInput): Promise<void> => {
      await unarchiveMutateAsync(input);
    },
    [unarchiveMutateAsync],
  );

  const isUnarchivingAgent = useCallback(
    (input: ArchiveAgentInput): boolean => {
      const key = toUnarchiveKey(input);
      if (!key) {
        return false;
      }
      return Boolean((pendingQuery.data ?? {})[key]);
    },
    [pendingQuery.data],
  );

  return {
    unarchiveAgent,
    isUnarchivingAgent,
  };
}

export const __private__ = {
  toUnarchiveKey,
  markAgentUnarchivedInHistoryPayload,
};
