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

describe("component lib", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  test("enqueue and claim should respect queue flow", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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

  test("identity binding should resolve, rebind and revoke", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-a",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "agent-b",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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

  test("hydration bundle should include resolved agent-bridge runtime config", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "bridge-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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

  test("scheduler count includes queued and in-progress conversations", async () => {
    const t = initConvexTest();
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "support-agent",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: ["agent-bridge"],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: [],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: [],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: [],
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
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: [],
      secretsRef: [],
      enabled: true,
    });
    await t.mutation(api.queue.upsertAgentProfile, {
      agentKey: "broadcast-agent-b",
      version: "1.0.0",
      soulMd: "# Soul",
      clientMd: "# Client",
      skills: [],
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
