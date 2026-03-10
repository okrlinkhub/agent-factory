/// <reference types="vite/client" />

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api.js";
import { initConvexTest } from "./setup.test.js";

const TEST_PROVIDER_CONFIG = {
  kind: "fly" as const,
  appName: "agent-factory-workers-test",
  organizationSlug: "personal",
  image: "registry.fly.io/agent-factory-workers-test:test-image",
  region: "iad",
  volumeName: "openclaw_data_test",
  volumePath: "/data",
  volumeSizeGb: 10,
};

function stableHashBase36(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function buildDedicatedVolumeName(prefix: string, workerId: string) {
  const sanitize = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  const normalizedPrefix = sanitize(prefix) || "openclaw";
  const normalizedWorker = sanitize(workerId) || "worker";
  const workerHash = stableHashBase36(normalizedWorker).slice(0, 8);
  const maxPrefixLen = 30 - 1 - workerHash.length;
  return `${normalizedPrefix.slice(0, Math.max(1, maxPrefixLen))}_${workerHash}`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function emptyResponse(status = 204) {
  return new Response(null, { status });
}

describe("component lib", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  test("enqueue and claim should respect queue flow", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: ["telegram.botToken"],
      enabled: true,
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u1",
        messageText: "Ciao",
      },
    });
    expect(messageId).toBeDefined();

    const claimed = await t.mutation(api.lib.claim, {
      workerId: "worker-1",
    });
    expect(claimed).not.toBeNull();
    expect(claimed?.conversationId).toBe("telegram:chat:1");
  });

  test("minimal agent profile should work when payload provides providerUserId", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "minimal-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:minimal",
      agentKey: "minimal-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-minimal-1",
        messageText: "hello",
      },
    });

    const claim = await t.mutation(api.lib.claim, {
      workerId: "worker-minimal-1",
    });
    expect(claim?.messageId).toBe(messageId);
    expect(claim?.payload.providerUserId).toBe("u-minimal-1");

    const bundle = await t.query(api.lib.getHydrationBundle, {
      messageId,
      workspaceId: "default",
    });
    expect(bundle).not.toBeNull();
    expect(bundle?.payload.providerUserId).toBe("u-minimal-1");
    expect(bundle?.bridgeRuntimeConfig).toBeNull();
  });

  test("enqueue should append global system prompt to queued message", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "system-prompt-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.lib.setMessageRuntimeConfig, {
      messageConfig: {
        systemPrompt: "  Rispondi sempre con un breve riassunto finale.  ",
      },
    });

    const storedMessageConfig = await t.query(api.lib.messageRuntimeConfig, {});
    expect(storedMessageConfig).toEqual({
      systemPrompt: "Rispondi sempre con un breve riassunto finale.",
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:system-prompt",
      agentKey: "system-prompt-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-system-prompt-1",
        messageText: "Come va?",
      },
    });

    const claim = await t.mutation(api.lib.claim, {
      workerId: "worker-system-prompt-1",
    });
    expect(claim?.messageId).toBe(messageId);
    expect(claim?.payload.messageText).toBe(
      "Come va?\n\nRispondi sempre con un breve riassunto finale.",
    );
  });

  test("blank global system prompt should not modify queued messages", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "blank-system-prompt-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.lib.setMessageRuntimeConfig, {
      messageConfig: {
        systemPrompt: "   ",
      },
    });

    const storedMessageConfig = await t.query(api.lib.messageRuntimeConfig, {});
    expect(storedMessageConfig).toBeNull();

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:blank-system-prompt",
      agentKey: "blank-system-prompt-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-blank-system-prompt-1",
        messageText: "hello",
      },
    });

    const claim = await t.mutation(api.lib.claim, {
      workerId: "worker-blank-system-prompt-1",
    });
    expect(claim?.messageId).toBe(messageId);
    expect(claim?.payload.messageText).toBe("hello");
  });

  test("enqueue should fail when providerUserId is blank in payload", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "missing-provider-user-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });

    await expect(
      t.mutation(api.queue.enqueueMessage, {
        conversationId: "telegram:chat:missing-provider-user",
        agentKey: "missing-provider-user-agent",
        payload: {
          provider: "telegram",
          providerUserId: "   ",
          messageText: "hello",
        },
      }),
    ).rejects.toThrow("providerUserId is required but missing in payload");
  });

  test("identity binding should resolve, rebind and revoke", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-a",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-b",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });

    const first = await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "u-1",
      agentKey: "agent-a",
      source: "telegram_pairing",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });
    expect(first.agentKey).toBe("agent-a");

    const byUser = await t.query(api.lib.resolveAgentForUser, {
      consumerUserId: "u-1",
    });
    expect(byUser.agentKey).toBe("agent-a");

    const byTelegram = await t.query(api.lib.resolveAgentForTelegram, {
      telegramUserId: "tg-user-1",
    });
    expect(byTelegram.agentKey).toBe("agent-a");

    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "u-1",
      agentKey: "agent-b",
      source: "manual",
      telegramUserId: "tg-user-1",
      telegramChatId: "tg-chat-1",
    });

    const rebound = await t.query(api.lib.resolveAgentForUser, {
      consumerUserId: "u-1",
    });
    expect(rebound.agentKey).toBe("agent-b");

    const revokeResult = await t.mutation(api.lib.revokeUserAgentBinding, {
      consumerUserId: "u-1",
    });
    expect(revokeResult.revoked).toBe(1);

    const afterRevoke = await t.query(api.lib.resolveAgentForTelegram, {
      telegramChatId: "tg-chat-1",
    });
    expect(afterRevoke.agentKey).toBeNull();
  });

  test("worker scheduling should set idle shutdown from last claim time", async () => {
    const t = initConvexTest();
    const now = Date.now();
    vi.setSystemTime(now);
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:2",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u2",
        messageText: "ciao",
      },
    });
    const claim = await t.mutation(api.lib.claim, { workerId: "worker-2" });
    expect(claim).not.toBeNull();
    expect(claim?.messageId).toBe(messageId);

    const completionTime = now + 60_000;
    vi.setSystemTime(completionTime);
    const completed = await t.mutation(api.lib.complete, {
      workerId: "worker-2",
      messageId,
      leaseId: claim?.leaseId ?? "",
    });
    expect(completed).toBe(true);
    const workers = await t.query((internal.queue as any).listWorkersForScheduler, {});
    const worker = workers.find((row: { workerId: string }) => row.workerId === "worker-2");
    expect(worker?.status).toBe("active");
    expect(worker?.load).toBe(0);
    expect(worker?.scheduledShutdownAt).toBe(now + 300_000);
  });

  test("idle shutdown should force worker to stopped and prevent reactivation", async () => {
    const t = initConvexTest();
    const claimTime = Date.UTC(2026, 0, 1, 12, 0, 0);
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.endsWith(`/apps/${TEST_PROVIDER_CONFIG.appName}/machines`) && method === "GET") {
          return jsonResponse([]);
        }
        if (url.endsWith(`/apps/${TEST_PROVIDER_CONFIG.appName}/volumes`) && method === "GET") {
          return jsonResponse([]);
        }
        throw new Error(`Unexpected fetch ${method} ${url}`);
      }),
    );
    vi.setSystemTime(claimTime);
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:forced-stop",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-stop",
        messageText: "stop me",
      },
    });
    const claim = await t.mutation(api.lib.claim, { workerId: "worker-stop-force-1" });
    expect(claim?.messageId).toBe(messageId);

    const completionTime = claimTime + 60_000;
    vi.setSystemTime(completionTime);
    await t.mutation(api.lib.complete, {
      workerId: "worker-stop-force-1",
      messageId,
      leaseId: claim?.leaseId ?? "",
      providerConfig: TEST_PROVIDER_CONFIG,
    } as any);

    const dueTime = claimTime + 300_001;
    vi.setSystemTime(dueTime);
    const shutdown = await t.action(api.scheduler.checkIdleShutdowns, {
      nowMs: dueTime,
      flyApiToken: "fly-token",
      providerConfig: TEST_PROVIDER_CONFIG,
    });
    expect(shutdown.stopped).toBe(1);

    const workers = await t.query((internal.queue as any).listWorkersForScheduler, {});
    const worker = workers.find((row: { workerId: string }) => row.workerId === "worker-stop-force-1");
    expect(worker?.status).toBe("stopped");
    expect(worker?.stoppedAt).toBe(dueTime);

    const control = await t.query(api.queue.getWorkerControlState as any, {
      workerId: "worker-stop-force-1",
    });
    expect(control.shouldStop).toBe(true);

    const newMessageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:forced-stop:2",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-stop",
        messageText: "new message",
      },
    });
    expect(newMessageId).toBeDefined();

    const reactivatedClaim = await t.mutation(api.lib.claim, {
      workerId: "worker-stop-force-1",
    });
    expect(reactivatedClaim).toBeNull();
  });

  test("hydration bundle should include resolved agent-bridge runtime config", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "bridge-agent",
      version: "1.0.0",
      secretsRef: [],
      bridgeConfig: {
        enabled: true,
        baseUrl: "https://consumer.example.com",
        serviceId: "openclaw-prod",
        appKey: "crm",
      },
      enabled: true,
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "agent-bridge.serviceKey.bridge-agent",
      plaintextValue: "abs_live_bridge_key",
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "agent-bridge.baseUrlMapJson.bridge-agent",
      plaintextValue: '{"crm":"https://consumer.example.com","billing":"https://billing.example.com"}',
    });

    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "bridge:chat:1",
      agentKey: "bridge-agent",
      payload: {
        provider: "telegram",
        providerUserId: "bridge-user",
        messageText: "test",
      },
    });
    const claim = await t.mutation(api.lib.claim, {
      workerId: "worker-bridge-1",
    });
    expect(claim?.messageId).toBe(messageId);

    const bundle = await t.query(api.lib.getHydrationBundle, {
      messageId,
      workspaceId: "default",
    });
    expect(bundle).not.toBeNull();
    expect(bundle?.bridgeRuntimeConfig).toEqual({
      baseUrl: "https://consumer.example.com",
      appBaseUrlMapJson: '{"crm":"https://consumer.example.com","billing":"https://billing.example.com"}',
      serviceId: "openclaw-prod",
      appKey: "crm",
      serviceKey: "abs_live_bridge_key",
      serviceKeySecretRef: "agent-bridge.serviceKey.bridge-agent",
    });
  });

  test("worker control state should signal stop for stopped worker", async () => {
    const t = initConvexTest();
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-stop-1",
      provider: "fly",
      status: "stopped",
      load: 0,
    });
    const control = await t.query(api.queue.getWorkerControlState as any, {
      workerId: "worker-stop-1",
    });
    expect(control.shouldStop).toBe(true);

    const controlUnknown = await t.query(api.queue.getWorkerControlState as any, {
      workerId: "worker-nonexistent",
    });
    expect(controlUnknown.shouldStop).toBe(true);
  });

  test("worker control state should stop active workers past scheduled shutdown", async () => {
    const t = initConvexTest();
    const nowMs = Date.UTC(2026, 0, 1, 14, 0, 0);
    vi.setSystemTime(nowMs);
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-overdue-1",
      provider: "fly",
      status: "active",
      load: 0,
      nowMs: nowMs - 60_000,
      scheduledShutdownAt: nowMs - 1,
    });
    const control = await t.query(api.queue.getWorkerControlState as any, {
      workerId: "worker-overdue-1",
    });
    expect(control.shouldStop).toBe(true);
  });

  test("shutdown teardown should wait for final snapshot before deleting worker volume", async () => {
    const t = initConvexTest();
    const workerId = "worker-cleanup-1";
    const machineId = "machine-cleanup-1";
    const volumeId = "vol-cleanup-1";
    const volumeName = buildDedicatedVolumeName(TEST_PROVIDER_CONFIG.volumeName, workerId);
    const claimTime = Date.UTC(2026, 0, 1, 15, 0, 0);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith(`/apps/${TEST_PROVIDER_CONFIG.appName}/machines`) && method === "GET") {
        return jsonResponse([
          {
            id: machineId,
            name: workerId,
            region: TEST_PROVIDER_CONFIG.region,
            state: "started",
            config: { image: TEST_PROVIDER_CONFIG.image },
          },
        ]);
      }
      if (url.endsWith(`/machines/${machineId}/cordon`) && method === "POST") {
        return emptyResponse();
      }
      if (url.endsWith(`/machines/${machineId}/stop`) && method === "POST") {
        return emptyResponse();
      }
      if (url.endsWith(`/machines/${machineId}`) && method === "DELETE") {
        return emptyResponse();
      }
      if (url.endsWith(`/machines/${machineId}`) && method === "GET") {
        return jsonResponse({
          id: machineId,
          config: {
            mounts: [{ volume: volumeId, path: TEST_PROVIDER_CONFIG.volumePath }],
          },
        });
      }
      if (url.endsWith(`/apps/${TEST_PROVIDER_CONFIG.appName}/volumes`) && method === "GET") {
        return jsonResponse([
          {
            id: volumeId,
            name: volumeName,
            region: TEST_PROVIDER_CONFIG.region,
          },
        ]);
      }
      if (url.endsWith(`/volumes/${volumeId}`) && method === "DELETE") {
        return emptyResponse();
      }
      throw new Error(`Unexpected fetch ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.setSystemTime(claimTime);

    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    const messageId = await t.mutation(api.lib.enqueue, {
      conversationId: "telegram:chat:cleanup",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-clean",
        messageText: "cleanup",
      },
    });
    const claim = await t.mutation(api.lib.claim, { workerId });
    expect(claim?.messageId).toBe(messageId);

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId,
      provider: "fly",
      status: "active",
      load: 1,
      nowMs: claimTime,
      machineId,
      appName: TEST_PROVIDER_CONFIG.appName,
      region: TEST_PROVIDER_CONFIG.region,
    });

    const completionTime = claimTime + 60_000;
    vi.setSystemTime(completionTime);
    await t.mutation(api.queue.completeJob as any, {
      workerId,
      messageId,
      leaseId: claim?.leaseId ?? "",
      nowMs: completionTime,
      providerConfig: TEST_PROVIDER_CONFIG,
    });

    const dueTime = claimTime + 300_001;
    vi.setSystemTime(dueTime);
    const firstPass = await t.action(api.scheduler.checkIdleShutdowns, {
      nowMs: dueTime,
      flyApiToken: "fly-token",
      providerConfig: TEST_PROVIDER_CONFIG,
    });
    expect(firstPass.stopped).toBe(1);
    expect(firstPass.pending).toBe(1);

    const prematureDeleteCalls = fetchMock.mock.calls.filter((call) =>
      String(call[0]).includes(`/volumes/${volumeId}`),
    );
    expect(prematureDeleteCalls).toHaveLength(0);

    const snapshot = await t.mutation(api.queue.prepareDataSnapshotUpload as any, {
      workerId,
      workspaceId: "default",
      agentKey: "support-agent",
      conversationId: "telegram:chat:cleanup",
      reason: "drain",
      nowMs: dueTime + 1,
    });
    const storageId = await t.run(async (ctx) => {
      return await ctx.storage.store(new Blob(["snapshot-ready"]));
    });
    const finalized = await t.mutation(api.queue.finalizeDataSnapshotUpload as any, {
      workerId,
      snapshotId: snapshot.snapshotId,
      storageId,
      sha256: "deadbeef",
      sizeBytes: 14,
      nowMs: dueTime + 2,
    });
    expect(finalized).toBe(true);

    const secondPass = await t.action(api.scheduler.checkIdleShutdowns, {
      nowMs: dueTime + 10_000,
      flyApiToken: "fly-token",
      providerConfig: TEST_PROVIDER_CONFIG,
    });
    expect(secondPass.pending).toBe(0);

    const deleteMachineCalls = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]).endsWith(`/machines/${machineId}`) &&
        ((call[1] as RequestInit | undefined)?.method ?? "GET") === "DELETE",
    );
    const deleteVolumeCalls = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]).endsWith(`/volumes/${volumeId}`) &&
        ((call[1] as RequestInit | undefined)?.method ?? "GET") === "DELETE",
    );
    expect(deleteMachineCalls).toHaveLength(1);
    expect(deleteVolumeCalls).toHaveLength(1);
  });

  test("cleanup should remove orphan worker volumes when the machine is already gone", async () => {
    const t = initConvexTest();
    const workerId = "worker-orphan-1";
    const volumeId = "vol-orphan-1";
    const volumeName = buildDedicatedVolumeName(TEST_PROVIDER_CONFIG.volumeName, workerId);
    const nowMs = Date.UTC(2026, 0, 1, 16, 0, 0);
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.endsWith(`/apps/${TEST_PROVIDER_CONFIG.appName}/machines`) && method === "GET") {
        return jsonResponse([]);
      }
      if (url.endsWith(`/machines/machine-orphan-1`) && method === "GET") {
        return new Response("not found", { status: 404 });
      }
      if (url.endsWith(`/apps/${TEST_PROVIDER_CONFIG.appName}/volumes`) && method === "GET") {
        return jsonResponse([
          {
            id: volumeId,
            name: volumeName,
            region: TEST_PROVIDER_CONFIG.region,
          },
        ]);
      }
      if (url.endsWith(`/volumes/${volumeId}`) && method === "DELETE") {
        return emptyResponse();
      }
      throw new Error(`Unexpected fetch ${method} ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId,
      provider: "fly",
      status: "active",
      load: 0,
      nowMs,
      scheduledShutdownAt: nowMs - 1,
      machineId: "machine-orphan-1",
      appName: TEST_PROVIDER_CONFIG.appName,
      region: TEST_PROVIDER_CONFIG.region,
    });

    const result = await t.action(api.scheduler.checkIdleShutdowns, {
      nowMs,
      flyApiToken: "fly-token",
      providerConfig: TEST_PROVIDER_CONFIG,
    });
    expect(result.stopped).toBe(1);
    expect(result.pending).toBe(0);

    const deleteVolumeCalls = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]).endsWith(`/volumes/${volumeId}`) &&
        ((call[1] as RequestInit | undefined)?.method ?? "GET") === "DELETE",
    );
    expect(deleteVolumeCalls).toHaveLength(1);
  });

  test("scheduler count includes queued and in-progress conversations", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });

    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:active-1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-active-1",
        messageText: "uno",
      },
    });
    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:active-2",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-active-2",
        messageText: "due",
      },
    });

    const claimed = await t.mutation(api.lib.claim, { workerId: "worker-active-1" });
    expect(claimed).not.toBeNull();

    const readyCount = await t.query((internal.queue as any).getReadyConversationCountForScheduler, {
      nowMs: Date.now(),
      limit: 1000,
    });
    const activeCount = await t.query((internal.queue as any).getActiveConversationCountForScheduler, {
      nowMs: Date.now(),
      limit: 1000,
    });

    expect(readyCount).toBe(1);
    expect(activeCount).toBe(2);
  });

  test("upsertWorkerState should preserve heartbeat for stopped workers", async () => {
    const t = initConvexTest();
    const firstHeartbeat = 1_700_000_000_000;
    const stoppedAt = firstHeartbeat + 120_000;

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-heartbeat-1",
      provider: "fly",
      status: "active",
      load: 0,
      nowMs: firstHeartbeat,
    });

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-heartbeat-1",
      provider: "fly",
      status: "stopped",
      load: 0,
      nowMs: stoppedAt,
      scheduledShutdownAt: stoppedAt,
    });

    const workers = await t.query((internal.queue as any).listWorkersForScheduler, {});
    const worker = workers.find(
      (row: { workerId: string }) => row.workerId === "worker-heartbeat-1",
    );

    expect(worker?.status).toBe("stopped");
    expect(worker?.heartbeatAt).toBe(firstHeartbeat);
    expect(worker?.scheduledShutdownAt).toBe(stoppedAt);
    expect(worker?.stoppedAt).toBe(stoppedAt);
  });

  test("scheduler caps desired workers by distinct ready conversations", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "fly.apiToken",
      plaintextValue: "fly-token",
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "convex.url",
      plaintextValue: "https://example.convex.cloud",
    });

    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap",
        messageText: "first",
      },
    });
    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-1",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap",
        messageText: "second",
      },
    });

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-1",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-2",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-3",
      provider: "fly",
      status: "active",
      load: 0,
    });

    const reconcile = await t.action(api.scheduler.reconcileWorkerPool, {
      scalingPolicy: {
        maxWorkers: 5,
        queuePerWorkerTarget: 1,
        spawnStep: 1,
        idleTimeoutMs: 300_000,
        reconcileIntervalMs: 15_000,
      },
      providerConfig: TEST_PROVIDER_CONFIG,
    });
    expect(reconcile.activeWorkers).toBe(3);
    expect(reconcile.spawned).toBe(0);
    expect(reconcile.terminated).toBe(0);
  });

  test("scheduler desired workers increases with distinct ready conversations", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "fly.apiToken",
      plaintextValue: "fly-token",
    });
    await t.mutation(api.queue.importPlaintextSecret, {
      secretRef: "convex.url",
      plaintextValue: "https://example.convex.cloud",
    });

    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-a",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap-a",
        messageText: "hello",
      },
    });
    await t.mutation(api.queue.enqueueMessage, {
      conversationId: "telegram:chat:cap-b",
      agentKey: "support-agent",
      payload: {
        provider: "telegram",
        providerUserId: "u-cap-b",
        messageText: "hello",
      },
    });

    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-4",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-5",
      provider: "fly",
      status: "active",
      load: 0,
    });
    await t.mutation(internal.queue.upsertWorkerState, {
      workerId: "worker-cap-6",
      provider: "fly",
      status: "active",
      load: 0,
    });

    const reconcile = await t.action(api.scheduler.reconcileWorkerPool, {
      scalingPolicy: {
        maxWorkers: 5,
        queuePerWorkerTarget: 1,
        spawnStep: 1,
        idleTimeoutMs: 300_000,
        reconcileIntervalMs: 15_000,
      },
      providerConfig: TEST_PROVIDER_CONFIG,
    });
    expect(reconcile.activeWorkers).toBe(3);
    expect(reconcile.spawned).toBe(0);
    expect(reconcile.terminated).toBe(0);
  });

  test("push jobs should dispatch scheduled messages with fallback user conversation id", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "push-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "user-push-1",
      agentKey: "push-agent",
      source: "manual",
      metadata: { companyId: "co-1" },
    });

    const baseMs = Date.UTC(2026, 0, 1, 7, 59, 0);
    const jobId = await t.mutation((api.lib as any).createPushJobCustom, {
      companyId: "co-1",
      consumerUserId: "user-push-1",
      title: "Daily check",
      text: "Ping automatico",
      periodicity: "daily",
      timezone: "UTC",
      schedule: {
        kind: "daily",
        time: "08:00",
      },
      nowMs: baseMs,
    });

    const dispatch = await t.mutation((api.lib as any).dispatchDuePushJobs, {
      nowMs: baseMs + 6 * 60_000,
      limit: 50,
    });
    expect(dispatch.enqueued).toBe(1);
    expect(dispatch.failed).toBe(0);

    const queueStats = await t.query(api.lib.queueStats, {});
    expect(queueStats.queuedReady).toBe(1);
    const claim = await t.mutation(api.lib.claim, { workerId: "worker-push-fallback-1" });
    expect(claim?.conversationId).toBe("user:user-push-1");
    expect(claim?.payload.provider).toBe("system_push");
    expect(claim?.payload.providerUserId).toBe("user-push-1");

    const jobDispatches = await t.query((api.lib as any).listPushDispatchesByJob, {
      jobId,
      limit: 10,
    });
    expect(jobDispatches.length).toBe(1);
    expect(jobDispatches[0].status).toBe("enqueued");
  });

  test("triggerPushJobNow should reuse telegram chat conversation id", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "push-telegram-manual-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "user-push-telegram-manual",
      agentKey: "push-telegram-manual-agent",
      source: "telegram_pairing",
      telegramUserId: "tg-user-manual-1",
      telegramChatId: "8246761447",
    });

    const nowMs = Date.UTC(2026, 0, 1, 8, 0, 0);
    const jobId = await t.mutation((api.lib as any).createPushJobCustom, {
      companyId: "co-tg-manual",
      consumerUserId: "user-push-telegram-manual",
      title: "Manual push",
      text: "Messaggio manuale",
      periodicity: "manual",
      timezone: "UTC",
      schedule: {
        kind: "manual",
      },
      nowMs,
    });

    await t.mutation((api.lib as any).triggerPushJobNow, {
      jobId,
      nowMs,
    });

    const claim = await t.mutation(api.lib.claim, { workerId: "worker-push-telegram-manual-1" });
    expect(claim?.conversationId).toBe("telegram:8246761447");
    expect(claim?.payload.provider).toBe("telegram");
    expect(claim?.payload.providerUserId).toBe("tg-user-manual-1");
    expect(claim?.payload.metadata?.telegramChatId).toBe("8246761447");
    expect(claim?.payload.metadata?.telegramUserId).toBe("tg-user-manual-1");
  });

  test("dispatchDuePushJobs should reuse telegram chat conversation id when available", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "push-telegram-scheduled-agent",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "user-push-telegram-scheduled",
      agentKey: "push-telegram-scheduled-agent",
      source: "telegram_pairing",
      telegramUserId: "tg-user-scheduled-1",
      telegramChatId: "9988776655",
    });

    const baseMs = Date.UTC(2026, 0, 1, 7, 59, 0);
    await t.mutation((api.lib as any).createPushJobCustom, {
      companyId: "co-tg-scheduled",
      consumerUserId: "user-push-telegram-scheduled",
      title: "Daily telegram check",
      text: "Ping telegram",
      periodicity: "daily",
      timezone: "UTC",
      schedule: {
        kind: "daily",
        time: "08:00",
      },
      nowMs: baseMs,
    });

    const dispatch = await t.mutation((api.lib as any).dispatchDuePushJobs, {
      nowMs: baseMs + 6 * 60_000,
      limit: 50,
    });
    expect(dispatch.enqueued).toBe(1);
    expect(dispatch.failed).toBe(0);

    const claim = await t.mutation(api.lib.claim, { workerId: "worker-push-telegram-scheduled-1" });
    expect(claim?.conversationId).toBe("telegram:9988776655");
    expect(claim?.payload.provider).toBe("telegram");
    expect(claim?.payload.providerUserId).toBe("tg-user-scheduled-1");
    expect(claim?.payload.metadata?.telegramChatId).toBe("9988776655");
    expect(claim?.payload.metadata?.telegramUserId).toBe("tg-user-scheduled-1");
  });

  test("admin broadcast should enqueue to all active company agents", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "broadcast-agent-a",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "broadcast-agent-b",
      version: "1.0.0",
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "company-user-a",
      agentKey: "broadcast-agent-a",
      source: "manual",
      metadata: { companyId: "company-broadcast" },
    });
    await t.mutation(api.lib.bindUserAgent, {
      consumerUserId: "company-user-b",
      agentKey: "broadcast-agent-b",
      source: "manual",
      metadata: { companyId: "company-broadcast" },
    });

    const result = await t.mutation((api.lib as any).sendBroadcastToAllActiveAgents, {
      companyId: "company-broadcast",
      title: "Aggiornamento policy",
      text: "Sincronizza le nuove istruzioni",
      requestedBy: "admin-1",
    });
    expect(result.totalTargets).toBe(2);
    expect(result.enqueued).toBe(2);
    expect(result.failed).toBe(0);

    const queueStats = await t.query(api.lib.queueStats, {});
    expect(queueStats.queuedReady).toBe(2);
  });
});
